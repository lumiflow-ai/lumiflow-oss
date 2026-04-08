"""Functions to log in to AWS and check if the user is logged in."""

import boto3


def select_sso_profile(profile_name: str):
    """
    Select a configured profile from the AWS SSO.
    Args:
        profile_name: The name of the profile to use.
    Returns:
        None
    """
    boto3.setup_default_session(profile_name=profile_name)


def check_logged_in(exception: bool = True):
    """
    Check if the user is logged in to AWS.
    Args:
        exception: Whether to raise an exception if not logged in.
    Returns:
        None
    """
    try:
        identity = boto3.client("sts").get_caller_identity()
        print(identity)
    except Exception as e:
        message = "Not logged in to AWS"
        print("You might need to call `sso_profile()` to login to AWS. See documentation.")
        if exception:
            raise Exception(message)
        else:
            print(message)
            print(e)
