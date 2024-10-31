import chalk from 'chalk';
import OutputBuffer from './outputBuffer.mjs';
const bufferedConsole=new OutputBuffer();

// Color mapping for digits 0-9
const colorMap = {
  0: chalk.black,
  1: chalk.red,
  2: chalk.green,
  3: chalk.yellow,
  4: chalk.blue,
  5: chalk.magenta,
  6: chalk.cyan,
  7: chalk.white,
  8: chalk.gray,
  9: chalk.magentaBright,
  '?': chalk.white
};



function displayMatrix(matrix, label = "") {
  bufferedConsole.log("examples", '\n' + chalk.bold(label));
  
  // Calculate the maximum width needed for each column
  const colWidths = matrix[0].map((_, colIndex) => {
    return Math.max(...matrix.map(row => String(row[colIndex]).length));
  });
  
  // Create horizontal border
  const border = '+-' + colWidths.map(w => '-'.repeat(w)).join('-+-') + '-+';
  
  bufferedConsole.log("examples", border);
  
  // Display each row
  matrix.forEach(row => {
    const displayRow = row.map((cell, colIndex) => {
      const colorFn = colorMap[cell] || chalk.white;
      return colorFn(String(cell).padStart(colWidths[colIndex]));
    });
    bufferedConsole.log("examples", '| ' + displayRow.join(' | ') + ' |');
    bufferedConsole.log("examples", border);
  });
}

function displayQAPair(qaPair, isTest = false) {
  bufferedConsole.log("examples", chalk.bold('\n' + '='.repeat(50)));
  bufferedConsole.log("examples", chalk.bold(isTest ? 'CHALLENGE QUESTION' : 'TRAINING EXAMPLE'));
  bufferedConsole.log("examples", chalk.bold('='.repeat(50)));
  
  displayMatrix(qaPair.input, 'Input:');
  
  if (isTest) {
    bufferedConsole.log("examples", 'Output: ?????????');
  } else {
    displayMatrix(qaPair.output, 'Output:');
  }


}

// Display training examples
const arcData = {
  "train": [
    {"input":[[0,1,0,5,0,0,0,0,4,0,0],[3,3,3,5,0,0,0,0,0,0,0],[0,1,0,5,4,0,0,0,4,0,4],[2,1,2,5,0,0,0,0,0,0,0],[0,1,0,5,0,0,0,0,0,0,0],[5,5,5,5,4,0,0,0,4,0,4],[5,5,5,5,0,0,0,0,0,0,0],[5,5,5,5,0,0,0,0,0,0,0],[5,5,5,5,0,0,0,0,4,0,0]],"output":[[0,0,0,0,1,0,0],[0,0,0,0,1,0,0],[3,3,3,3,3,3,3],[0,0,0,0,1,0,0],[0,0,0,0,1,0,0],[2,2,2,2,1,2,2],[0,0,0,0,1,0,0],[0,0,0,0,1,0,0],[0,0,0,0,1,0,0]]},
    {"input":[[0,2,0,1,0,5,0,4,0,0,0,4,0],[3,3,3,3,3,5,4,4,0,0,0,4,4],[0,2,0,1,0,5,0,0,0,0,0,0,0],[3,3,3,3,3,5,0,0,0,0,0,0,0],[0,2,0,1,0,5,0,0,0,0,0,0,0],[5,5,5,5,5,5,0,0,0,0,0,0,0],[5,5,5,5,5,5,4,4,0,0,0,4,4],[5,5,5,5,5,5,0,0,0,0,0,0,0],[5,5,5,5,5,5,0,4,0,0,0,4,0]],"output":[[0,2,0,0,0,1,0],[3,3,3,3,3,3,3],[0,2,0,0,0,1,0],[0,2,0,0,0,1,0],[0,2,0,0,0,1,0],[0,2,0,0,0,1,0],[3,3,3,3,3,3,3],[0,2,0,0,0,1,0],[0,2,0,0,0,1,0]]},
    {"input":[[0,1,0,1,0,5,0,0,4,0,0,4,0],[2,1,2,1,2,5,0,0,0,0,0,0,0],[0,1,0,1,0,5,0,0,0,0,0,0,0],[3,1,3,1,3,5,4,0,4,0,0,4,4],[0,1,0,1,0,5,0,0,0,0,0,0,0],[5,5,5,5,5,5,0,0,0,0,0,0,0],[5,5,5,5,5,5,0,0,0,0,0,0,0],[5,5,5,5,5,5,4,0,4,0,0,4,4],[5,5,5,5,5,5,0,0,0,0,0,0,0],[5,5,5,5,5,5,0,0,0,0,0,0,0],[5,5,5,5,5,5,0,0,4,0,0,4,0]],"output":[[0,0,1,0,0,1,0],[0,0,1,0,0,1,0],[0,0,1,0,0,1,0],[2,2,1,2,2,1,2],[0,0,1,0,0,1,0],[0,0,1,0,0,1,0],[0,0,1,0,0,1,0],[3,3,1,3,3,1,3],[0,0,1,0,0,1,0],[0,0,1,0,0,1,0],[0,0,1,0,0,1,0]]},
    {"input":[[0,0,4,0,4,0,0,5,0,2,0,3,0],[0,0,0,0,0,0,0,5,1,2,1,3,1],[0,0,0,0,0,0,0,5,0,2,0,3,0],[0,0,0,0,0,0,0,5,5,5,5,5,5],[4,0,4,0,4,0,4,5,5,5,5,5,5],[0,0,0,0,0,0,0,5,5,5,5,5,5],[0,0,4,0,4,0,0,5,5,5,5,5,5]],"output":[[0,0,2,0,3,0,0],[0,0,2,0,3,0,0],[0,0,2,0,3,0,0],[0,0,2,0,3,0,0],[1,1,2,1,3,1,1],[0,0,2,0,3,0,0],[0,0,2,0,3,0,0]]}
  ],
  "test": [
    {"input":[[0,4,0,4,0,4,0,5,0,2,0,2,0,2,0],[0,0,0,0,0,0,0,5,3,2,3,3,3,2,3],[0,0,0,0,0,0,0,5,0,2,0,2,0,2,0],[0,0,0,0,0,0,0,5,1,1,1,2,1,1,1],[4,4,0,4,0,4,4,5,0,2,0,2,0,2,0],[0,0,0,0,0,0,0,5,5,5,5,5,5,5,5],[0,0,0,0,0,0,0,5,5,5,5,5,5,5,5],[0,0,0,0,0,0,0,5,5,5,5,5,5,5,5],[0,0,0,0,0,0,0,5,5,5,5,5,5,5,5],[4,4,0,4,0,4,4,5,5,5,5,5,5,5,5],[0,0,0,0,0,0,0,5,5,5,5,5,5,5,5],[0,4,0,4,0,4,0,5,5,5,5,5,5,5,5]],"output":[[0,2,0,2,0,2,0],[0,2,0,2,0,2,0],[0,2,0,2,0,2,0],[0,2,0,2,0,2,0],[3,2,3,3,3,2,3],[0,2,0,2,0,2,0],[0,2,0,2,0,2,0],[0,2,0,2,0,2,0],[0,2,0,2,0,2,0],[1,1,1,2,1,1,1],[0,2,0,2,0,2,0],[0,2,0,2,0,2,0]]}
  ]
};


const formatEvalPrompt = (arcData) => {
  // Display all training examples
  arcData.train.forEach((example, index) => {
    displayQAPair(example, false);
  });
  displayQAPair(arcData.test[0], true)
  const result= bufferedConsole.getFromBuffer("examples");
  console.log(result)
  bufferedConsole.flush();
  return result;

}
export { formatEvalPrompt };

// test
formatEvalPrompt(arcData);