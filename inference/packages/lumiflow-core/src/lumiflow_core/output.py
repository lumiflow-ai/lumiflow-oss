"""Helpers for output."""

import sys

import colorama

DEFAULT_COLORED_OUTPUT = True


def print_color(color: colorama.Fore, *args, file: str = None, **kwargs):
    if DEFAULT_COLORED_OUTPUT and not file:
        print(color + colorama.Style.BRIGHT, end="")
        print(*args, **kwargs)
        print(colorama.Style.RESET_ALL, end="")
    else:
        print(*args, file=file, **kwargs)


def print_status(*args, **kwargs):
    print_color(colorama.Fore.GREEN, *args, **kwargs)


def print_header(*args, **kwargs):
    print_color(
        colorama.Fore.CYAN,
        "=== 🔵",
        *args,
        "===",
        **kwargs,
    )


def print_error(*args, **kwargs):
    print_color(colorama.Fore.RED, *args, file=sys.stderr, **kwargs)
