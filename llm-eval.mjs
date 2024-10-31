#!/usr/bin/env node

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { program } from 'commander';
import chalk from 'chalk';
import _ from 'lodash';

// Format the evaluation prompt from a question JSON
function formatEvalPrompt(data) {
    let prompt = `Based on the patterns that relate input and output, as demonstrated by the 2 Training Examples, determine the output for the Challenge Question. 

If you can solve this, you will make history - feel free to try as many different approaches as you llike! 

Training Examples: `;

    data.train.slice(0, 2).forEach((example) => {
        prompt += `
"input": ${JSON.stringify(example.input)} -> 
"output": ${JSON.stringify(example.output)} 

`;
    });

    prompt += `Challenge Question: 
"input": ${JSON.stringify(data.test[0].input)} ->
 "output": ???`;

    return prompt;
}

// Validate model's answer against the correct output
function validateAnswer(answer, correctOutput) {
    try {
        // Extract the array from the model's response
        const answerMatch = answer.match(/\[\[.*?\]\]/s);
        if (!answerMatch) return false;
        
        const parsedAnswer = JSON.parse(answerMatch[0]);
        return _.isEqual(parsedAnswer, correctOutput);
    } catch (error) {
        console.error(chalk.red('Error parsing model answer:', error.message));
        return false;
    }
}

// Get random questions from the evaluation set
async function getRandomQuestions(numQuestions, evaluationDir) {
    const files = await fs.readdir(evaluationDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    return _.sampleSize(jsonFiles, numQuestions);
}

// Main evaluation function
async function evaluateModel(modelId, systemMessagePath, evalPath, outputPath, numQuestions) {
    console.log(chalk.blue(`Starting evaluation of model ${modelId} on ${numQuestions} questions...`));
    
    const results = [];
    const questions = await getRandomQuestions(numQuestions, evalPath);

    for (const [index, questionFile] of questions.entries()) {
        console.log(chalk.yellow(`\nQuestion ${index + 1}/${numQuestions} (${questionFile})`));
        
        const questionData = JSON.parse(
            await fs.readFile(path.join(evalPath, questionFile), 'utf8')
        );
        const prompt = formatEvalPrompt(questionData);
        const systemPrompt = systemMessagePath ? await fs.readFile(systemMessagePath, 'utf8') : "You are a helpful assistant";
        
        const correctOutput = questionData.test[0].output;
        
        let solved = false;
        let attempts = 0;
        
        while (!solved && attempts < 1) {
            attempts++;
            console.log(chalk.cyan(`Attempt ${attempts}/3`));
            
            try {
                const answer = await getChatCompletion(modelId, systemPrompt, prompt);
                console.log(chalk.blue('Model answer:', answer));
                console.log(chalk.green('Correct output:', JSON.stringify(correctOutput)));
                console.log()
                if (validateAnswer(answer, correctOutput)) {
                    solved = true;
                    console.log(chalk.green('✓ Correct answer!'));
                } else {
                    console.log(chalk.red('✗ Incorrect answer'));
                    if (attempts < 1) {
                        const retryResponse = await getChatCompletion(
                            modelId,
                            systemPrompt,
                            "That's incorrect. Please try again with a different approach."
                        );
                    }
                }
            } catch (error) {
                console.error(chalk.red('Error during evaluation:', error.message));
                break;
            }
        }
        
        results.push({
            filename: questionFile,
            correct: solved,
            attempts: attempts
        });
    }

    return results;
}

// CLI setup
program
    .name('arc-eval')
    .description('Evaluate AI models on the ARC AGI evaluation set')
    .requiredOption('-m, --model <id>', 'OpenRouter model ID')
    .requiredOption('-e, --evals <directory>', 'Directory to evaluation JSON files')
    .requiredOption('-o, --output <path>', 'Where to save the evaluation results')
    .option('-s, --system <path>', 'Path to system prompt text file')
    .option('-n, --num <number>', 'Number of questions to test', parseInt, 5)
    .parse(process.argv);

const options = program.opts();

// Main execution
async function main() {
    try {
        if (!process.env.OPENROUTER_API_KEY) {
            throw new Error('OPENROUTER_API_KEY environment variable is required');
        }

        const results = await evaluateModel(options.model, options.system, options.evals, options.output, options.num);
        
        // Calculate and display summary statistics
        const totalCorrect = results.filter(r => r.correct).length;
        const averageAttempts = results.reduce((sum, r) => sum + (r.correct ? r.attempts : 3), 0) / results.length;
        
        console.log('\n' + chalk.blue('Evaluation Results:'));
        console.log(chalk.green(`Correct: ${totalCorrect}/${results.length} (${(totalCorrect/results.length*100).toFixed(1)}%)`));
        console.log(chalk.yellow(`Average attempts: ${averageAttempts.toFixed(2)}`));
        console.log('\nDetailed results:');
        console.log(JSON.stringify(results, null, 2));

        // Save results to a file
        const resultsFilePath = options.output
        await fs.writeFile(resultsFilePath, JSON.stringify(results, null, 2));
        console.log(chalk.blue(`Results saved to ${resultsFilePath}`));
        
        
    } catch (error) {
        console.error(chalk.red('Error:', error.message));
        process.exit(1);
    }
}

main();
