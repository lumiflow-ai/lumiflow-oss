import logging
from textwrap import dedent
from typing import Tuple, List, Optional

from lumiflow_ai_models import wrappers, parsing
from pydantic import BaseModel, Field

from lumiflow_core.utils import filter_substrings_in_string

logger = logging.getLogger(__name__)


class EvalResponse(BaseModel):
    value: bool = Field(examples=["true/false"])
    evidence: list[str] = Field(examples=[["A verbatim quote from the artifact"]])


class QuestionMappingRunner:
    def run(self, question: str) -> Tuple[str, str, str]:
        input_name = "__INPUT_ARTIFACT__"  # Note: do not use str.format() as JSON interferes with it

        mapped_prompt = dedent(f"""
            You are evaluating the quality of the following artifact:

            ### START Artifact

            {input_name}

            ### END Artifact

            {question}

            Answer the question by true or false. If true, provide relevant verbatim quotes from the artifact as
            evidence for your answer. If false, leave evidence empty.

            {parsing.prompt_for_model(EvalResponse)}
        """).strip()

        return mapped_prompt, input_name, "boolean"


class EvaluationRunner:
    def run(
        self,
        template: str,
        input_name: str,
        input_value: str,
        model: wrappers.ModelOrWrappedModel,
        stream: bool = True,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        max_new_tokens: Optional[int] = None,
        verbose=False,
    ) -> Tuple[bool, List[str]]:
        prompt = template.replace(input_name, input_value)

        if verbose:
            print("EvaluationRunner: prompt:")
            print(prompt)

        eval_response, error = model.generate(
            prompt,
            stream=stream,
            output_model=EvalResponse,
            temperature=temperature,
            top_p=top_p,
            max_new_tokens=max_new_tokens,
        )

        if error:
            # TODO change `Retry`'s model.generate to raise an exception instead of returning an error and re-raising
            raise Exception(error)

        # Ensure consistency: apply business rules for evidence based on value
        if not eval_response.value and eval_response.evidence:
            # If answer is false but evidence provided, remove evidence (skip filtering)
            final_evidence = []
            logger.warning("LLM provided evidence for false answer. Removing evidence to ensure consistency.")
        elif eval_response.value and not eval_response.evidence:
            # If answer is true but no evidence provided, use entire artifact
            final_evidence = [input_value]
            logger.warning(
                "LLM provided true answer without evidence. Using entire artifact as evidence to ensure consistency."
            )
        else:
            # Only filter evidence if value is true and evidence exists
            final_evidence = filter_substrings_in_string(eval_response.evidence, input_value)

        if verbose:
            print("EvaluationRunner: evaluation_response:")
            print(eval_response)

        return (eval_response.value, final_evidence) if eval_response else (False, [])
