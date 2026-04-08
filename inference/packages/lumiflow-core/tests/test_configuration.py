import os
import tempfile
import textwrap

from lumiflow_core import configuration


class TestConfiguration:
    def test_load_config(self):
        _, filepath = tempfile.mkstemp(suffix=".py", text=True)
        with open(filepath, "w") as tmp:
            tmp.write(
                textwrap.dedent("""\
                A = 'a'
                I = 1
                def f():
                    return 'f'
                F = f()
            """)
            )
            tmp.flush()
            config = configuration.load(tmp.name)
            assert config.A == "a"
            assert config.I == 1
            assert config.F == "f"
        os.remove(filepath)

    def test_load_config_defaults(self):
        _, filepath = tempfile.mkstemp(suffix=".py", text=True)
        with open(filepath, "w") as tmp:
            tmp.write(
                textwrap.dedent("""\
                A = 'a'
                B = 'b'
                I = 1
                def f():
                    return 'f'
                F = f()
            """)
            )
            tmp.flush()
            config = configuration.load(
                tmp.name,
                defaults={
                    "A": "d_a",
                    "C": "d_c",
                    "I": 0,
                    "F": "d_f",
                },
            )
            assert config.A == "a"
            assert config.B == "b"
            assert config.C == "d_c"
            assert config.I == 1
            assert config.F == "f"
        os.remove(filepath)

    def test_load_config_defaults_no_file(self):
        config = configuration.load(
            "nonexistent.py",
            defaults={
                "A": "d_a",
                "C": "d_c",
                "I": 0,
                "F": "d_f",
            },
        )
        assert config.A == "d_a"
        assert config.C == "d_c"
        assert config.I == 0
        assert config.F == "d_f"
