"""
Module to check Google Cloud Platform (GCP) authentication status and details."""

import google.auth
from google.auth.exceptions import DefaultCredentialsError


def check_gcp_authentication(verbose=False):
    """
    Checks the active Google Cloud authentication credentials and prints details.
    """
    try:
        credentials, project = google.auth.default()
        if verbose:
            print("--- Google Cloud Authentication Status ---")
            print(f"Credentials found: {credentials is not None}")
        if credentials:
            if verbose:
                print(f"Type of credentials: {type(credentials).__name__}")
                print(f"Project ID (from credentials or environment): {project}")
            try:
                credentials.refresh(google.auth.transport.requests.Request())
                if verbose:
                    print("Credentials are valid and refreshed.")
                    print(f"Token expiry: {credentials.expiry}")
                    if hasattr(credentials, "service_account_email") and credentials.service_account_email:
                        print(f"Authenticated as Service Account: {credentials.service_account_email}")
                    elif hasattr(credentials, "id_token") and credentials.id_token:
                        print("Authenticated as User Account (via ADC token/gcloud login)")
                    else:
                        print("Authenticated via other means (e.g., Compute Engine metadata service)")
            except Exception as e:
                print(f"Warning: Could not refresh credentials or get token info: {e}")
                print("This might indicate expired or invalid credentials, or a network issue.")
                raise
        else:
            print("No Google Cloud credentials found via Application Default Credentials.")
            print("Please ensure you have authenticated your environment:")
            print("  - Run `gcloud auth application-default login` for local development.")
            print("  - Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable to a service account key file.")
            print("  - Deploy to a Google Cloud environment with an attached service account.")
    except DefaultCredentialsError as e:
        print(f"Authentication Error (DefaultCredentialsError): {e}")
        print("This usually means no suitable credentials were found in any standard location.")
        raise
    except Exception as e:
        print(f"An unexpected error occurred during authentication check: {e}")
        raise
