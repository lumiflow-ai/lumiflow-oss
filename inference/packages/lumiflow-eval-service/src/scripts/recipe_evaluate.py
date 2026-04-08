import argparse
import pprint
import uuid
from datetime import datetime

import requests

from lumiflow_eval_service.types import RecipeEvaluate

DEFAULT_TEMPLATE = """\
You are evaluating the quality of the following artifact:

### START Artifact

INPUT_ARTIFACT

### END Artifact

Does the artifact explicitly mention any symptom?

Answer in JSON with the following format:
{
    "value": "true/false",
    "evidence": [
        "A verbatim quote from the artifact"
    ]
}
"""

DEFAULT_INPUT_VALUE = "Patient has severe pain in the abdomen and nausea that started 2 days ago after eating lunch."
DEFAULT_MODEL = ""
DEFAULT_HOST = "http://127.0.0.1:8000"
RECIPE_EVALUATE_PATH = "/recipe/evaluate"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate a recipe via the eval service.")
    parser.add_argument(
        "--defaults",
        "-d",
        action="store_true",
        help="Use built-in defaults without prompting for input.",
    )
    parser.add_argument(
        "--host",
        default=DEFAULT_HOST,
        help=f"Eval service host (path {RECIPE_EVALUATE_PATH} is appended). Default: {DEFAULT_HOST}",
    )
    parser.add_argument(
        "--template",
        help="Prompt template. If provided, skips the template question.",
    )
    parser.add_argument(
        "--input-value",
        help="Input value/text. If provided, skips the input value question.",
    )
    parser.add_argument(
        "--model",
        help="Model name. If provided, skips the model question.",
    )
    parser.add_argument(
        "--output",
        "-o",
        choices=["json", "text"],
        default="json",
        help="Response format to print (default: json).",
    )
    return parser.parse_args()


def prompt_user(
    default_template: str,
    default_input_value: str,
    default_model: str,
    template: str | None = None,
    input_value: str | None = None,
    model: str | None = None,
) -> tuple[str, str, str]:
    if template is None:
        template = input("Prompt template [press Enter for default]: ").strip() or default_template

    if input_value is None:
        input_value = input(f"Input value/text [{default_input_value}]: ").strip() or default_input_value

    if model is None:
        model_prompt = "Model (leave blank for " + (default_model if default_model else "service default") + "): "
        model = input(model_prompt).strip() or default_model

    return template, input_value, model


def main():
    args = parse_args()

    if args.defaults:
        template = args.template if args.template is not None else DEFAULT_TEMPLATE
        input_value = args.input_value if args.input_value is not None else DEFAULT_INPUT_VALUE
        model = args.model if args.model is not None else DEFAULT_MODEL
    else:
        template, input_value, model = prompt_user(
            DEFAULT_TEMPLATE,
            DEFAULT_INPUT_VALUE,
            DEFAULT_MODEL,
            template=args.template,
            input_value=args.input_value,
            model=args.model,
        )

    recipe = RecipeEvaluate(
        prompt=RecipeEvaluate.Prompt(
            template=template,
            input_name="INPUT_ARTIFACT",
            input_value=input_value,
        ),
        model=RecipeEvaluate.Model(
            name=model,
            temperature=None,
            top_p=None,
            max_new_tokens=None,
        ),
        timestamp=datetime.now(),
        event_summary_id=uuid.uuid4(),
        generation_id=str(uuid.uuid4()),
        org_id=uuid.uuid4(),
    )

    endpoint = args.host.rstrip("/") + RECIPE_EVALUATE_PATH
    r = requests.post(endpoint, json=recipe.model_dump(mode="json"))
    print("Status code:", r.status_code)
    if args.output == "text":
        print("Response (text):")
        print(r.text)
    else:
        print("Response (json parsed):")
        try:
            pprint.pprint(r.json())
        except ValueError:
            print("Failed to parse JSON; raw response:")
            print(r.text)


if __name__ == "__main__":
    main()
