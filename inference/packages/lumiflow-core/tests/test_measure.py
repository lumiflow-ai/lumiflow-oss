import time

import pytest

from lumiflow_core import measure


class TestTime:
    def test_elapsed_during(self):
        sleep_time = 0.3
        with measure.time(do_print=False) as timing:
            time.sleep(sleep_time)
            assert timing.elapsed == pytest.approx(sleep_time, rel=0.05)
            time.sleep(sleep_time)
            assert timing.elapsed == pytest.approx(sleep_time * 2, rel=0.05)

    def test_elapsed_after(self):
        sleep_time = 0.7
        with measure.time(do_print=False) as timing:
            time.sleep(sleep_time)
        assert timing.elapsed == pytest.approx(sleep_time, rel=0.05)
        assert f"{sleep_time}" in str(timing)
        assert "seconds" in str(timing)
