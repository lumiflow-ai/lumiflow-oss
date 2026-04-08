"""This module contains various utility functions."""

import os
import re
import zipfile
from datetime import datetime
from functools import cache


def date_prefix() -> str:
    """Generate a date prefix string in the format 'YYYYMMDDHHMM'."""
    return str(datetime.now().strftime("%Y%m%d%H%M"))


def ellipsize(text: str, max_length: int = 100) -> str:
    """Ellipsize text to a maximum length."""
    ellipsis = "..."
    if len(text) <= max_length:
        return text
    if max_length <= len(ellipsis):
        return ellipsis
    if len(text) > max_length:
        d = max_length - len(ellipsis)
        return text[:d] + ellipsis
    return text


def one_line(text: str) -> str:
    """Remove newlines and extra spaces from text."""
    return re.sub(r"\s+", " ", text).strip()


def add_extension_prefix(filepath: str, prefix: str) -> str:
    """
    Add a prefix to an extension, or secondary extension, to a filename.
    Example: add_extension_prefix('file.txt', 'bak') -> 'file.bak.txt'
    Args:
        filepath: the file path to modify.
        prefix: the prefix to add.
    Returns:
        The filename with the prefix added.
    """
    if prefix.startswith("."):
        prefix = prefix[1:]
    root, ext = os.path.splitext(filepath)
    return root + "." + prefix + ext


def find_common_quotes(str1, str2, min_words=2):
    """
    Finds the longest common substrings at the word level between 2 strings.
    Ensures non-overlapping longest matches.
    """

    def tokenize_words(text):
        """Splits text into words while preserving indexes."""
        words = re.findall(r"\b\w+\b", text.lower())  # Extract words (normalize to lowercase)
        word_positions = {i: words[i] for i in range(len(words))}
        return words, word_positions

    words_1, positions_1 = tokenize_words(str1)
    words_2, positions_2 = tokenize_words(str2)

    len_t, len_r = len(words_1), len(words_2)

    # Build a DP table for Longest Common Substring
    dp = [[0] * (len_r + 1) for _ in range(len_t + 1)]
    common_substrings = []

    # Track longest common substrings
    for i in range(1, len_t + 1):
        for j in range(1, len_r + 1):
            if words_1[i - 1] == words_2[j - 1]:  # Match found
                dp[i][j] = dp[i - 1][j - 1] + 1
                if dp[i][j] >= min_words:
                    start_idx_t = i - dp[i][j]
                    common_phrase = " ".join(words_1[start_idx_t:i])
                    common_substrings.append((start_idx_t, i, common_phrase))

    # Sort by length (longest phrases first)
    common_substrings.sort(key=lambda x: x[1] - x[0], reverse=True)

    # Select non-overlapping phrases
    selected_quotes = []
    occupied_positions = set()

    for start, end, quote in common_substrings:
        if not any(pos in occupied_positions for pos in range(start, end)):  # Check for overlap
            selected_quotes.append(quote)
            occupied_positions.update(range(start, end))  # Mark words as used

    return selected_quotes


# Find quotes longer than n words
# Normalize text to lowercase and remove punctuation
# Check if normalized quote is a substring of normalized text
# Return quotes that meet the criteria
def find_quotes(text: str, quotes: list[str], n: int = 5) -> list[str]:
    if not text or not quotes:
        return []
    normalized_text = " ".join(re.findall(r"\b\w+\b", text.lower()))
    return [
        quote
        for quote in quotes
        if len(re.findall(r"\b\w+\b", quote)) >= n  # Check if quote has at least n words
        and " ".join(re.findall(r"\b\w+\b", quote.lower())) in normalized_text
    ]


@cache
def load_wordlist(filepath: str) -> set[str]:
    """Load words from a file and return them as a set."""
    with open(filepath, "r") as f:
        stopwords = {line.strip().lower() for line in f if not line.strip().startswith("#")}
    return stopwords


def filter_stopwords(lst: [str], stopwords: set[str]) -> [str]:
    """Remove stopwords from list of strings."""
    if not lst or not stopwords:
        return lst
    return [s for s in lst if s.lower().strip() not in stopwords]


def zip_dir(folder_path, output_path):
    """Zips the contents of a folder to a specified output path.

    Args:
        folder_path (str): The path to the folder to be zipped.
        output_path (str): The path where the zip file will be created.
    """
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(folder_path):
            for file in files:
                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, folder_path)
                zipf.write(file_path, relative_path)


def normalize_text(text: str) -> str:
    """
    Normalize text by converting to lowercase, and keeping only letters and numbers.
    """
    return " ".join(re.findall(r"\b\w+\b", text.lower()))


def filter_substrings_in_string(subs: list[str], s: str) -> list[str]:
    """Filter out substrings that are not present in the string"""
    if not isinstance(s, str) or not isinstance(subs, list) or not all(isinstance(s, str) for s in subs):
        return []
    normalized_s = normalize_text(s)
    return [sub for sub in subs if normalize_text(sub) in normalized_s]
