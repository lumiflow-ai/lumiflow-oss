import threading
from pathlib import Path
from typing import Iterable, Callable, TypeVar, Optional, Iterator

D = TypeVar("D")


class ThreadSafeIterator:
    """A thread-safe wrapper around an iterator."""

    def __init__(self, iterator):
        self.iterator = iter(iterator)
        self.lock = threading.Lock()

    def __iter__(self):
        return self

    def __next__(self):
        with self.lock:
            return next(self.iterator)


class ResumableIterator(Iterator[D]):
    """Iterator that remembers marked items and skips them on subsequent runs."""

    def __init__(
        self,
        data: Iterable[D],
        get_id: Optional[Callable[[D], str]] = None,
        skipped: Optional[Iterable[str]] = None,
        filepath: Optional[str] = None,
    ):
        """
        Args:
            data: The data to process.
            get_id: A function that generates a str identifier from an item.
            skipped: A list of identifiers to skip.
            filepath: The path to a file containing identifiers to skip.
        """
        self.data = iter(data)
        self.get_id = get_id or str
        self.skipped = set(skipped) if skipped else set()
        self._filepath = Path(filepath) if filepath else None
        self._initialized = False

    def _initialize(self):
        if not self._initialized:
            if self._filepath and self._filepath.exists():
                with self._filepath.open("r", encoding="utf-8") as f:
                    self.skipped.update(line.strip() for line in f)
            self._initialized = True

    def __iter__(self) -> Iterator[D]:
        return self

    def __next__(self):
        self._initialize()
        while True:
            item = next(self.data)
            job_id = self.get_id(item)
            if job_id not in self.skipped:
                return item

    def mark(self, item: D):
        """Mark an item to be skipped on subsequent runs."""
        job_id = self.get_id(item)
        self.skipped.add(job_id)

        if self._filepath:
            self._filepath.parent.mkdir(parents=True, exist_ok=True)
            with self._filepath.open("a", encoding="utf-8") as f:
                f.write(job_id + "\n")
