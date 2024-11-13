from dataclasses import dataclass
from typing import List, Optional, Dict, Any
import json
import requests
import os
from datetime import datetime
from enum import Enum
from pydantic import BaseModel
@dataclass
class ChainStep:
    """Represents a single step in the reasoning chain"""
    step_number: int
    title: str
    content: str
    confidence: float
    is_final: bool

# Inherit from the ChainStep class (imported from main module)
@dataclass
class ReasoningStep(ChainStep):
    """Represents a step in the agent's reasoning process"""
    timestamp: datetime = datetime.now()
    references: List[str] = None  # Optional citations or references used
    subtasks_completed: List[str] = None  # Optional list of completed subtasks

@dataclass
class CoachingStep(ChainStep):
    """Represents an evaluation/coaching intervention"""
    reasoning_score: float
    evaluation_results: str
    flag_for_removal: bool
    ready_to_finalize: bool
    suggested_resources: List[str] = None
    knowledge_contributions: List[str] = None

class CoachingResponse(BaseModel):
    """Pydantic model for parsing coach responses"""
    reasoning_score: float
    evaluation_results: str
    flag_for_removal: bool
    ready_to_finalize: bool
    suggested_resources: Optional[List[str]]
    knowledge_contributions: Optional[List[str]]

COACHING_SYSTEM_PROMPT = """You are an expert reasoning coach assisting AI agents with complex analytical and problem-solving tasks. Your role is to:

1. Evaluate the agent's current reasoning block for:
   - Logical coherence and validity
   - Progress toward the goal
   - Knowledge gaps or misconceptions
   - Effective problem decomposition
   - Appropriate use of prior conclusions

2. Provide specific, actionable guidance on:
   - Areas needing deeper analysis
   - Alternative approaches to consider
   - Relevant domain knowledge
   - Potential logical fallacies
   - Connection to previous reasoning blocks

3. Share your own expert knowledge when relevant:
   - Clearly distinguish between facts and opinions
   - Explain your confidence level and reasoning
   - Provide verifiable claims where possible
   - Suggest specific methods for verification

Your response must be valid JSON with these fields:
{
    "reasoning_score": float (0-1),  # Quality score for current reasoning block
    "evaluation_results": string,    # Detailed feedback and suggestions
    "flag_for_removal": boolean,     # True if current block should be discarded
    "ready_to_finalize": boolean,    # True if solution is complete/correct
    "suggested_resources": [string], # Optional relevant references
    "knowledge_contributions": [string] # Optional key facts/concepts shared
}"""

def make_llm_call(model: str, messages: List[Dict[str, str]], response_model: Any) -> Any:
    """Generic function to make API calls to OpenRouter"""
    headers = {
        "HTTP-Referer": "https://github.com/your-repo",
        "X-Title": "Reasoning Coach",
        "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
        "Content-Type": "application/json"
    }
    
    url = "https://openrouter.ai/api/v1/chat/completions"
    
    request_body = {
        "model": model,
        "messages": messages,
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
        "max_tokens": 1024
    }
    
    response = requests.post(url, headers=headers, json=request_body)
    response.raise_for_status()
    
    content = response.json()['choices'][0]['message']['content']
    return response_model.parse_raw(content)

def summarize_reasoning_blocks(
    user_request: str,
    past_blocks: List[List[ChainStep]],
    summarizer_model: str = "openai/gpt-4-turbo"
) -> str:
    """Summarize past reasoning blocks using specified LLM"""
    if not past_blocks:
        return ""
        
    # Convert blocks to readable format
    blocks_text = []
    for i, block in enumerate(past_blocks, 1):
        block_steps = [
            f"Step {step.step_number}: {step.title}\n{step.content}"
            for step in block[:-1]  # Exclude the coaching step
        ]
        coaching_step = block[-1]  # Get the coaching step
        blocks_text.append(
            f"Reasoning Block {i}:\n" + 
            "\n\n".join(block_steps) +
            f"\n\nCoach Evaluation (score: {coaching_step.reasoning_score}):\n{coaching_step.evaluation_results}"
        )
    
    summary_prompt = f"""Please create a concise yet detailed summary of this problem-solving transcript.

Original Task: {user_request}

Previous Reasoning Blocks:
{blocks_text}

Focus on:
1. Key insights and conclusions reached
2. Major course corrections or strategy shifts
3. Critical feedback from the coach that influenced the reasoning
4. Current state of progress toward the solution

Keep the summary focused and actionable for the next phase of reasoning."""

    messages = [
        {"role": "system", "content": "You are a precise and analytical summarizer."},
        {"role": "user", "content": summary_prompt}
    ]
    
    response = make_llm_call(summarizer_model, messages, str)
    return response

def evaluate_progress(
    user_request: str,
    reasoning_chain: List[ChainStep],
    evaluator_model: str = "anthropic/claude-3-sonnet-20240320",
    jit_learning_materials: str = ""
) -> CoachingStep:
    """Evaluate reasoning progress and provide coaching feedback"""
     #it works better to use the whole chain, don't compress the tail
    steps_text = "\n\n".join([
            f"Step {step.step_number}: {step.title}\n{step.content}\n---\n{f'Evaluation: {step.evaluation_results}' if isinstance(step, CoachingStep) else ''}"
            for step in reasoning_chain
        ])

    # Prepare evaluation prompt
    evaluation_prompt = f"""User Request: {user_request}


Additional Learning Materials:
{jit_learning_materials}

Reasoning Chain (with evaluations):
{steps_text}"""

    #debug
    print(steps_text)
    messages = [
        {"role": "system", "content": COACHING_SYSTEM_PROMPT},
        {"role": "user", "content": evaluation_prompt}
    ]
    
    # Get coaching response
    coach_response = make_llm_call(evaluator_model, messages, CoachingResponse)
    
    # Create and return coaching step
    return CoachingStep(
        step_number=reasoning_chain[-1].step_number + 1,
        title="Coaching Evaluation",
        content=coach_response.evaluation_results,
        confidence=coach_response.reasoning_score,  # Use reasoning_score as confidence
        is_final=False,
        reasoning_score=coach_response.reasoning_score,
        evaluation_results=coach_response.evaluation_results,
        flag_for_removal=coach_response.flag_for_removal,
        ready_to_finalize=coach_response.ready_to_finalize,
        suggested_resources=coach_response.suggested_resources,
        knowledge_contributions=coach_response.knowledge_contributions
    )