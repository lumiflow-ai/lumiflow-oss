import json
import re

import pytest
from pydantic import BaseModel, Field, ValidationError

from lumiflow_ai_models import parsing

_RE_ALL_WHITESPACE = re.compile(r"\s+")


def simplify_whitespaces(text):
    return _RE_ALL_WHITESPACE.sub(" ", text).strip()


class TestParsers:
    def test_get_example_dict_recursive(self):
        class A(BaseModel):
            name: str = Field(examples=["a"])

        class B(BaseModel):
            name: str = Field(examples=["b"])
            a: A

        assert parsing.get_example_dict_recursive(B) == {"name": "b", "a": {"name": "a"}}

    def test_get_example_dict_recursive_list(self):
        class A(BaseModel):
            name: str = Field(examples=["a"])

        class B(BaseModel):
            name: str = Field(examples=["b"])
            a: list[A]

        assert parsing.get_example_dict_recursive(B) == {"name": "b", "a": [{"name": "a"}]}

    def test_get_example_dict_recursive_missing_example(self):
        class A(BaseModel):
            name: str = Field()

        with pytest.raises(parsing.ParserError):
            parsing.get_example_dict_recursive(A)

    def test_parseable_prompt(self):
        class A(BaseModel):
            name: str = Field(examples=["a"])

        assert simplify_whitespaces(parsing.prompt_for_model(A)) == simplify_whitespaces(
            'Answer in JSON with the following format: { "name": "a" }'
        )

    def test_extract_last_json(self):
        assert parsing.extract_last_json('abc {"test": 123} xyz') == '{"test": 123}'

    def test_extract_last_json_no_match(self):
        with pytest.raises(parsing.ParserError):
            parsing.extract_last_json("abc")

    def test_extract_last_json_multiple_matches(self):
        assert parsing.extract_last_json('abc {"test": 123} {"test": 456} xyz') == '{"test": 123}'

    def test_parse_dict(self):
        data = json.dumps({"test": "ok"})
        d = parsing.parse_dict(data)
        assert isinstance(d, dict)
        assert d["test"] == "ok"

    def test_parse_dict_zero_length(self):
        with pytest.raises(parsing.ParserError):
            parsing.parse_dict("")

    def test_parse_model(self):
        class A(BaseModel):
            name: str = Field(examples=["a"])

        class B(BaseModel):
            name: str = Field(examples=["b"])
            a: A

        data = json.dumps({"name": "bbb", "a": {"name": "aaa"}})
        d = parsing.parse_model(data, B)
        assert isinstance(d, B)
        assert d.name == "bbb"
        assert isinstance(d.a, A)
        assert d.a.name == "aaa"

    def test_parse_model_list(self):
        class A(BaseModel):
            name: str = Field(examples=["a"])

        class B(BaseModel):
            name: str = Field(examples=["b"])
            a: list[A]

        data = json.dumps({"name": "bbb", "a": [{"name": "aaa"}]})
        d = parsing.parse_model(data, B)
        assert isinstance(d, B)
        assert d.name == "bbb"
        assert isinstance(d.a, list)
        assert d.a[0].name == "aaa"

    def test_parse_model_invalid(self):
        class A(BaseModel):
            name: str = Field(examples=["a"])

        with pytest.raises(ValidationError):
            parsing.parse_model("{}", A)
