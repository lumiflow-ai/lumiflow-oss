# GCP

## GCP CLI

### Install

First make sure the GCP CLI is installed.

### Initialize

```sh
gcloud init
```

### Authenticate with the gcloud CLI

```sh
gcloud auth application-default login
```

This is the recommended setup for local development. The resulting credentials may expire and need to be refreshed.

### Authenticate with a service account

For non-interactive environments, set `GOOGLE_APPLICATION_CREDENTIALS` to a service account key file or use your platform's workload identity mechanism.

```sh
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```
