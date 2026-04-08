"""
Function to download data from a URL to a file path.
"""

import os
from urllib.parse import urlparse

import requests
from tqdm import tqdm

from lumiflow_core import measure


def download(
    url: str,
    filepath: str,
    force: bool = False,
    chunk_size: int = 1024,
):
    """
    Download data from a URL to a file path, skipping the download if the file already exists.

    Args:
        url: the url to download from.
        filepath: the file path to save the data to. If the path is a directory, the file will be saved in that
            directory with the same name as the file in the URL.
        force: whether to force download the data even if it already exists.
        chunk_size: the size of the chunks to download the data in.

    Returns:
        The file path where the data was saved.
    """

    if os.path.exists(filepath):
        if os.path.isfile(filepath) and not force:
            print(f"Data already exists at {filepath}, skipping download")
            return filepath
        elif os.path.isdir(filepath):
            filename = os.path.basename(urlparse(url).path)
            filepath = os.path.join(filepath, filename)

    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    print(f"Downloading {url}")
    with measure.time("Data downloading"):
        resp = requests.get(url, stream=True)
        total = int(resp.headers.get("content-length", 0))
        with (
            open(filepath, "wb") as file,
            tqdm(
                desc=filepath,
                total=total,
                unit="iB",
                unit_scale=True,
                unit_divisor=1024,
            ) as bar,
        ):
            for data in resp.iter_content(chunk_size=chunk_size):
                size = file.write(data)
                bar.update(size)
    print(f"Downloaded data to {filepath}")
    return filepath
