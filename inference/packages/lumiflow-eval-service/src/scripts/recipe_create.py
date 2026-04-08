import argparse
import pprint

import requests

from lumiflow_eval_service.types import RecipeCreate

DEFAULT_QUESTION = "Are any medications mentioned?"
DEFAULT_MODEL = None  # Use service-side default model when unset.
DEFAULT_HOST = "http://127.0.0.1:8000"
RECIPE_CREATE_PATH = "/recipe/create"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a recipe via the eval service.")
    parser.add_argument(
        "--defaults",
        "-d",
        action="store_true",
        help="Use built-in defaults without prompting for input.",
    )
    parser.add_argument(
        "--host",
        default=DEFAULT_HOST,
        help=f"Eval service host (path {RECIPE_CREATE_PATH} is appended). Default: {DEFAULT_HOST}",
    )
    parser.add_argument(
        "--output",
        "-o",
        choices=["json", "text"],
        default="json",
        help="Response format to print (default: json).",
    )
    return parser.parse_args()


def prompt_user(default_question: str, default_model: str | None) -> tuple[str, str | None]:
    question = input(f"Question [{default_question}]: ").strip() or default_question
    model_prompt = "Model (leave blank for " + (default_model if default_model else "service default") + "): "
    model = input(model_prompt).strip() or default_model
    return question, model


def main():
    args = parse_args()

    if args.defaults:
        question, model = DEFAULT_QUESTION, DEFAULT_MODEL
    else:
        question, model = prompt_user(DEFAULT_QUESTION, DEFAULT_MODEL)

    question_mapping = RecipeCreate(
        question=question,
        parameters={"model": model} if model else None,
    )

    endpoint = args.host.rstrip("/") + RECIPE_CREATE_PATH
    r = requests.post(endpoint, json=question_mapping.model_dump(mode="json"))
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
