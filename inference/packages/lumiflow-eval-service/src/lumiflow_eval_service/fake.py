import random
import re
import json


def extract_artifact_from_prompt(prompt: str) -> str:
    match = re.search(
        r"###\s*START Artifact\s*(.*?)\s*###\s*END Artifact",
        prompt,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if match:
        return match.group(1).strip()
    return prompt


def random_evidence_from_text(text: str) -> list[str]:
    normalized_text = re.sub(r"\s+", " ", text).strip()
    if not normalized_text:
        return []

    words = normalized_text.split(" ")
    max_quotes = min(3, len(words))
    quote_count = random.randint(1, max_quotes)
    evidence: list[str] = []

    for _ in range(quote_count):
        span_length = random.randint(1, min(12, len(words)))
        start_index = random.randint(0, len(words) - span_length)
        quote = " ".join(words[start_index : start_index + span_length]).strip()
        if quote and quote not in evidence:
            evidence.append(quote)

    return evidence


def func_evaluation_response(prompt: str, **kwargs) -> str:
    del kwargs
    artifact_text = extract_artifact_from_prompt(prompt)
    value = random.choice([True, False])
    evidence = random_evidence_from_text(artifact_text) if value else []
    return json.dumps({"value": value, "evidence": evidence})
