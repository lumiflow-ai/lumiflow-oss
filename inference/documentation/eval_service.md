# Eval service

The eval service is a FastAPI application that serves the models for evaluation. It can call various AI services, such as AWS Bedrock or GCP Vertex AI.

## Authentication

To authenticate with these services, follow the instructions in the [AWS](aws.md) and [GCP](gcp.md) documentation.

## Running 

Run the eval service with one of the following commands:

with `uv`:

```bash
uv run eval_service
```

or, with `python`:

```bash
python -m uvicorn lumiflow_eval_service.main:app --reload 
```

## Development mode

You can set `DEV=1` as an env var to enable development mode (for verbose logging).

