"""
Detects the current environment where the code is running.
"""

import os
import socket

UNKNOWN = "unknown"
GOOGLE_COLAB = "Google Colab"
AWS_EC2 = "AWS EC2"
AWS_SAGEMAKER = "AWS SageMaker"


class Environment:
    """
    Detects the current environment where the code is running.
    """

    _current = None

    @classmethod
    def current(cls) -> str:
        if cls._current is None:
            # noinspection PyUnresolvedReferences
            if "get_ipython" in globals() and "google.colab" in str(get_ipython()):  # noqa: F821
                cls._current = GOOGLE_COLAB
            # Note: SageMaker runs on EC2, so it needs to be detected first
            elif "SageMaker" in os.getcwd():
                cls._current = AWS_SAGEMAKER
            elif "ec2" in socket.gethostname():
                cls._current = AWS_EC2
            else:
                cls._current = UNKNOWN
            print(f"Running on {cls._current}")
        return cls._current


def current() -> str:
    return Environment.current()


def is_colab() -> bool:
    return Environment.current() == GOOGLE_COLAB


def is_sagemaker() -> bool:
    return Environment.current() == AWS_SAGEMAKER


def is_ec2() -> bool:
    return Environment.current() == AWS_EC2


def is_unknown() -> bool:
    return Environment.current() == UNKNOWN
