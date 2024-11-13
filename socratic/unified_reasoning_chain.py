from dataclasses import dataclass
from typing import Generator, Optional, List, Union, Callable
from enum import Enum
import requests
import json
import os
import time
from datetime import datetime
from pydantic import BaseModel
from dotenv import load_dotenv
import os

# Import from our coaching module
from reasoning_coach import ReasoningStep, CoachingStep, evaluate_progress

class EvaluationStrategy(Enum):
    """Defines the type of evaluation to use"""
    SOCRATIC = "socratic"  # External coach evaluation
    NARCISSISTIC = "narcissistic"  # Self reflection

class StepResponse(BaseModel):
    """Base model for LLM responses during reasoning"""
    title: str
    content: str
    next_action: str
    confidence: float

class SelfEvalResponse(BaseModel):
    """Model for self-evaluation responses"""
    reasoning_score: float
    evaluation_results: str
    flag_for_removal: bool
    ready_to_finalize: bool

class UnifiedReasoningChain:
    """Reasoning chain that supports both external coaching and self-reflection"""
    
    def __init__(
        self, 
        model_id: str,
        evaluation_strategy: EvaluationStrategy = EvaluationStrategy.SOCRATIC,
        coach_model_id: Optional[str] = "anthropic/claude-3-sonnet-20240320",
        api_key: Optional[str] = None,
        eval_frequency: int = 3  # Evaluate every N steps
    ):
        self.model_id = model_id
        self.api_key = api_key or os.getenv('OPENROUTER_API_KEY')
        self.evaluation_strategy = evaluation_strategy
        self.coach_model_id = coach_model_id
        self.eval_frequency = eval_frequency
        
        if not self.api_key:
            raise ValueError("API key must be provided or set in OPENROUTER_API_KEY environment variable")

    def _make_api_call(self, system_prompt: str, messages: list, max_tokens: int,
                    response_model: BaseModel, is_final_answer: bool = False) -> BaseModel:
        """Make API call to OpenRouter"""
        headers = {
            "HTTP-Referer": "https://github.com/your-repo",
            "X-Title": "Unified Reasoning Chain",
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        url = "https://openrouter.ai/api/v1/chat/completions"
        
        request_body = {
            "model": self.model_id,
            "messages": [
                {"role": "system", "content": system_prompt},
                *messages
            ],
            "max_tokens": max_tokens,
            "temperature": 0.2,
            "response_format": {"type": "json_object"}
        }
        
        for attempt in range(3):
            try:
                response = requests.post(url, headers=headers, json=request_body)
                response.raise_for_status()
                
                result = response.json()
                message_content = result['choices'][0]['message']['content']
                
                try:
                    if (response_model is None):
                        return message_content
                    

                    response_data = json.loads(message_content)
                    return response_model(**response_data)
                    
                except json.JSONDecodeError as e:
                    raise ValueError(f"Failed to parse JSON response: {str(e)}")
                    
            except Exception as e:
                if attempt == 2:
                    if response_model == StepResponse:
                        return StepResponse(
                            title="Error",
                            content=f"Failed to generate {'final answer' if is_final_answer else 'step'} after 3 attempts. Error: {str(e)}",
                            next_action="final_answer",
                            confidence=0.5
                        )
                    else:
                        raise
                time.sleep(1)

    def self_evaluate_progress(
        self,
        user_request: str,
        reasoning_chain: List[Union[ReasoningStep, CoachingStep]]
    ) -> CoachingStep:
        """Perform self-evaluation of reasoning progress"""
        
        system_prompt = """You are performing a critical self-evaluation of your reasoning process.
Analyze your recent steps and provide a detailed assessment of your progress.

Your response must be valid JSON with these fields:
{
    "reasoning_score": float (0-1),  # Quality score for current reasoning block
    "evaluation_results": string,    # Detailed self-reflection and insights
    "flag_for_removal": boolean,     # True if current approach should be abandoned
    "ready_to_finalize": boolean     # True if solution is complete/correct
}"""

        # Format recent steps for evaluation
        #recent_steps = [
        #    step for step in reasoning_chain 
        #    if isinstance(step, ReasoningStep)
        #][-self.eval_frequency:]
        
        # it works better to use the whole chain, don't compress the tail
        steps_text = "\n\n".join([
            f"Step {step.step_number}: {step.title}\n{step.content}"
            for step in reasoning_chain
        ])

        eval_prompt = f"""Original Request: {user_request}

Recent Reasoning Steps to Evaluate:
{steps_text}

Perform a detailed self-evaluation of these steps, considering:
1. Logical consistency and progress toward the goal
2. Potential blind spots or biases
3. Alternative approaches that should be considered
4. Whether the current line of reasoning should continue or be abandoned
5. Whether a final answer has been reached"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": eval_prompt}
        ]

        eval_response = self._make_api_call(
            system_prompt, messages, 1024, SelfEvalResponse
        )

        return CoachingStep(
            step_number=reasoning_chain[-1].step_number + 1,
            title="Self-Reflection",
            content=eval_response.evaluation_results,
            confidence=eval_response.reasoning_score,
            is_final=False,
            reasoning_score=eval_response.reasoning_score,
            evaluation_results=eval_response.evaluation_results,
            flag_for_removal=eval_response.flag_for_removal,
            ready_to_finalize=eval_response.ready_to_finalize,
            suggested_resources=[],
            knowledge_contributions=[]
        )

    REASONING_SYSTEM_PROMPT = """You are an AI assistant that explains your reasoning step by step, incorporating dynamic Chain of Thought (CoT) reasoning. IMPORTANT: You must output exactly ONE step of reasoning at a time:

1. Each response must contain ONE single step of the reasoning and creation process... Steps may contain <thinking> tags - your thoughts - keep it to one reasoning step per tag</thinking> and/or <output> blocks - these are full text responses... if you are writing long form content, an output block should be a complete section or chapter</output>
2. For each step, enclose your thoughts within <thinking> tags as you explore that specific step.
3. After completing your current step, indicate whether you need another step or are ready for the final answer.
4. Do not try to complete multiple steps or the entire analysis in one response.
5. Regularly evaluate your progress, being critical and honest about your reasoning process.
6. Assign a quality score between 0.0 and 1.0 to guide your approach:
   - 0.8+: Continue current approach
   - 0.5-0.7: Consider minor adjustments
   - Below 0.5: Seriously consider backtracking and trying a different approach

IMPORTANT: Your response must be a valid JSON object with the following structure:
{
    "title": "Step title or topic",
    "content": "Detailed step content",
    "next_action": "One of: continue, reflect, or final_answer",
    "confidence": float between 0.0 and 1.0
}"""

    def generate(self, prompt: str) -> Generator[Union[ReasoningStep, CoachingStep], None, None]:
        """Generate reasoning chain steps with periodic evaluation"""
        messages = [{"role": "user", "content": prompt}]
        step_count = 1
        reasoning_chain: List[Union[ReasoningStep, CoachingStep]] = []
        
        while True:
            # Generate next reasoning step
            step_data = self._make_api_call(
                self.REASONING_SYSTEM_PROMPT, messages, 8192, StepResponse
            )
            
            # Create and yield reasoning step
            reasoning_step = ReasoningStep(
                step_number=step_count,
                title=step_data.title,
                content=step_data.content,
                confidence=step_data.confidence,
                is_final=False,
                timestamp=datetime.now(),
                references=[],
                subtasks_completed=[]
            )
            reasoning_chain.append(reasoning_step)
            yield reasoning_step
            
            messages.append({
                "role": "assistant",
                "content": json.dumps(step_data.model_dump())
            })
            
            # Determine if evaluation is needed
            needs_evaluation = (
                step_count % self.eval_frequency == 0 or
                step_data.next_action == "reflect"
            )
            
            if needs_evaluation:
                # Choose evaluation method based on strategy
                if self.evaluation_strategy == EvaluationStrategy.SOCRATIC:
                    coaching_step = evaluate_progress(
                        prompt, reasoning_chain, self.coach_model_id
                    )
                else:  # NARCISSISTIC
                    coaching_step = self.self_evaluate_progress(prompt, reasoning_chain)
                
                reasoning_chain.append(coaching_step)
                # Add results of coaching step
                formatted_results = f"""Coaching Evaluation:
Reasoning Score: {coaching_step.reasoning_score}
Evaluation Results: {coaching_step.evaluation_results}"""
                messages.append({"role": "assistant", "content": formatted_results})


                yield coaching_step
                
                # Handle evaluation results
                if coaching_step.flag_for_removal:
                    # Remove steps since last evaluation
                    reasoning_chain = reasoning_chain[:-self.eval_frequency-1]
                    messages = messages[:-self.eval_frequency]
                elif coaching_step.ready_to_finalize:
                    break
            
            # Check if we should continue
            if step_data.next_action == 'final_answer' and step_count >= 15:
                break
            
            # Add appropriate follow-up prompt
            if coaching_step.flag_for_removal if needs_evaluation else False:
                messages.append({
                    "role": "user",
                    "content": "The previous approach was incorrect. Please try a different strategy."
                })
            elif step_data.next_action == 'final_answer':
                messages.append({
                    "role": "user",
                    "content": "Please continue your analysis with at least 5 more steps before providing the final answer."
                })
            else:
                messages.append({
                    "role": "user",
                    "content": "Please continue with the next step in your analysis."
                })
            
            step_count += 1

        # Generate final answer
        final_data = self._make_api_call(
            self.REASONING_SYSTEM_PROMPT, messages, 8192,
            None, is_final_answer=True
        )
        
        print("FINAL ANSWER:", final_data)

        print("DEBUG: Complete reasoning chain")
        print(json.dumps(messages, indent=2))

        # final_step = ReasoningStep(
        #     step_number=step_count + 1,
        #     title="Final Answer",
        #     content=final_data.content,
        #     confidence=final_data.confidence,
        #     is_final=True,
        #     timestamp=datetime.now(),
        #     references=[],
        #     subtasks_completed=[]
        # )
        
        # reasoning_chain.append(final_step)
        # yield final_step 

def main():
    load_dotenv()

    """Example usage from command line"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Unified Reasoning Chain")
    parser.add_argument("prompt", help="The query or problem to analyze")
    parser.add_argument("--model", default="openai/gpt-4o-mini",
                      help="OpenRouter model ID for reasoning")
    parser.add_argument("--eval-strategy", choices=['socratic', 'narcissistic'],
                      default='socratic', help="Evaluation strategy to use")
    parser.add_argument("--coach-model", default="openai/gpt-4o-mini",help="Model ID for coaching (Socratic only)")
    args = parser.parse_args()
    
    chain = UnifiedReasoningChain(
        model_id=args.model,
        evaluation_strategy=EvaluationStrategy(args.eval_strategy),
        coach_model_id=args.coach_model
    )
    
    try:
        for step in chain.generate(args.prompt):
            # Simple console output - you might want to use rich for better formatting
            print(f"\n{'='*50}")
            print(f"Step {step.step_number}: {step.title}")
            print(f"{'='*50}")
            print(step.content)
            print(f"\nConfidence: {step.confidence}")
            
            if isinstance(step, CoachingStep):
                print(f"\nReasoning Score: {step.reasoning_score}")
                if step.flag_for_removal:
                    print("\n⚠️ Previous reasoning block flagged for removal")
                if step.ready_to_finalize:
                    print("\n✅ Ready for final answer")
            
    except KeyboardInterrupt:
        print("\nProcess interrupted by user")
    except Exception as e:
        print(f"\nError: {str(e)}")

if __name__ == "__main__":
    main()

# Example usage:python3 unified_reasoning_chain.py "develop the logical framework and detailed book outline for a serious yet reasonably approachable philosophy book called 'F(*& That, I Want To Live! Demolishing the Myth of Sisyphus'"