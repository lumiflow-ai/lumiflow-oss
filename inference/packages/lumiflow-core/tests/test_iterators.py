import os
import tempfile

from lumiflow_core.iterators import ResumableIterator


class TestResumableIterator:
    def test_resumable_skip(self):
        data = [1, 2, 3, 4, 5]
        skipped = ["1", "3", "5"]
        assert list(ResumableIterator(data, skipped=skipped)) == [2, 4]

    def test_resumable_generate_id(self):
        data = [1, 2, 3, 4, 5]
        skipped = ["2", "4"]
        get_id = lambda x: str(x * 2)
        assert list(ResumableIterator(data, skipped=skipped, get_id=get_id)) == [3, 4, 5]

    def test_resumable_filepath(self):
        data = [1, 2, 3, 4, 5]
        _, filepath = tempfile.mkstemp(text=True)
        with open(filepath, "r+") as tmp:
            tmp.write("2\n4\n")
            tmp.seek(0)
            resumable = ResumableIterator(data, filepath=tmp.name)
            assert next(resumable) == 1
            resumable.mark(1)
            assert next(resumable) == 3
            resumable.mark(3)
            assert next(resumable) == 5
            # not marking on purpose
            tmp.seek(0)
            assert tmp.read() == "2\n4\n1\n3\n"  # 1 and 3 are added, 5 not added
        os.remove(filepath)
