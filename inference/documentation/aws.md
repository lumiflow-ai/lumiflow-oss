# AWS

## AWS CLI 

### Install

First make sure the AWS cli is installed.

### Configure

Configure a named SSO profile:

```sh
aws configure sso --profile your-profile
```

### Log in

Log in with:

```sh
aws sso login --profile your-profile
```

Select the same profile in the shell before running Python code:

```sh
export AWS_PROFILE=your-profile
export AWS_DEFAULT_REGION=us-east-1
```

Verify that credentials are available:

```sh
aws sts get-caller-identity
```

If that command fails, `boto3` will fail too.

### VS Code launch config

If you run the service from the debugger, add the same values in `inference/.env`:

```sh
AWS_PROFILE=your-profile
AWS_DEFAULT_REGION=us-east-1
```
