# Inference

This directory contains code for running inference on the models. It includes the `eval_service` which is a FastAPI application that serves the models for evaluation.

## Dependencies

First make sure `uv` (Universal Virtualenv) is installed.

Then, from this directory, install the dependencies for the Lumiflow inference workspace:

```sh
uv sync --all-packages
```

## Git hooks

To set up git hooks, run:

```sh
bash scripts/install-git-hooks.sh
```

In the full repository, this installs the shared root pre-commit hook, which
runs the inference hook suite and any other checked-out project hook suites. In
an inference-only checkout, it installs only the inference hook.

## Running the Evaluation Service

The evaluation service can be run with:

```sh
uv run eval_service
```

To run it with development settings, set the environment variable `DEV` to `1`.

You can also run the service in Docker:

```sh
docker build -f packages/lumiflow-eval-service/Dockerfile -t lumiflow-eval-service .
docker run --rm -p 8000:8000 lumiflow-eval-service
```

In another shell, you can run the evaluation recipe with:

```sh
uv run recipe_evaluate
```

## Configuration

By default, the evaluation service will only offer a fake model. This fake model returns random results and is used for testing purposes. 

To use real models, you can create a new configuration file and specify the providers and models you want to use. Then, set the `EVAL_CONFIG_PATH` environment variable to the path of your configuration file before running the evaluation service. See `example_eval_config.json` for an example of how to specify real models in the configuration.

For more information, see [documentation/eval_service.md](./documentation/eval_service.md).

## Tests

To run the tests, use the following command:

```sh
uv run pytest
```

## More Information

For more information, see the [documentation](./documentation) directory.
