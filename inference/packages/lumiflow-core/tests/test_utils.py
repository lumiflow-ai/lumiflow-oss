from lumiflow_core import utils


class TestDatePrefix:
    def test_date_prefix(self):
        prefix = utils.date_prefix()
        assert len(prefix) == 12
        assert prefix.isalnum()
        assert int(prefix) > 0


class TestEllipsize:
    def test_ellipsize(self):
        assert utils.ellipsize("a", 1000) == "a"
        assert utils.ellipsize("abc", 3) == "abc"
        assert utils.ellipsize("abcd", 3) == "..."
        assert utils.ellipsize("abcde", 4) == "a..."
        assert utils.ellipsize("abcd", 1) == "..."


class TestOneLine:
    def test_one_line(self):
        assert utils.one_line("a   b") == "a b"
        assert utils.one_line("a\n\n\nb") == "a b"


class TestAddExtensionPrefix:
    def test_add_extension_prefix(self):
        assert utils.add_extension_prefix("a.txt", "b") == "a.b.txt"
        assert utils.add_extension_prefix("a.txt", ".b") == "a.b.txt"
        assert utils.add_extension_prefix("/a/b/c/d.txt", "e") == "/a/b/c/d.e.txt"


class TestFindQuotes:
    def test_find_quotes_empty_text(self):
        text = ""
        quotes = ["a", "b"]
        assert utils.find_quotes(text, quotes) == []

    def test_find_quotes_empty_quotes(self):
        text = "a b"
        quotes = []
        assert utils.find_quotes(text, quotes) == []

    def test_find_quotes_match_too_short(self):
        text = "a b c d"
        quotes = ["b c"]
        assert utils.find_quotes(text, quotes, 3) == []

    def test_find_quotes_match(self):
        text = "a b c d"
        quotes = ["b c d"]
        assert utils.find_quotes(text, quotes, 3) == ["b c d"]

    def test_find_quotes_match_case(self):
        text = "a b C d"
        quotes = ["B c d"]
        assert utils.find_quotes(text, quotes, 3) == ["B c d"]

    def test_find_quotes_match_punctuation(self):
        text = "a b, c. d"
        quotes = ["b: c d"]
        assert utils.find_quotes(text, quotes, 3) == ["b: c d"]


class TestFindCommonQuotes:
    def test_find_common_quotes_emptys(self):
        s1 = ""
        s2 = ""
        assert utils.find_common_quotes(s1, s2, min_words=2) == []

    def test_find_common_quotes_empty(self):
        s1 = "ab cd"
        s2 = ""
        assert utils.find_common_quotes(s1, s2, min_words=2) == []

    def test_find_common_quotes_exact(self):
        s1 = "ab cd"
        s2 = "ab cd"
        assert utils.find_common_quotes(s1, s2, min_words=2) == ["ab cd"]

    def test_find_common_quotes_shorter(self):
        s1 = "ab"
        s2 = "ab"
        assert utils.find_common_quotes(s1, s2, min_words=2) == []

    def test_find_common_quotes_longer(self):
        s1 = "ab cd ef"
        s2 = "ab cd ef"
        assert utils.find_common_quotes(s1, s2, min_words=2) == ["ab cd ef"]

    def test_find_common_quotes_mix(self):
        s1 = "z ab cd"
        s2 = "ab cd z"
        assert utils.find_common_quotes(s1, s2, min_words=2) == ["ab cd"]

    def test_find_common_quotes_multiple(self):
        s1 = "ab cd x ef gh"
        s2 = "ab cd z ef gh"
        assert set(utils.find_common_quotes(s1, s2, min_words=2)) == {"ab cd", "ef gh"}

    def test_find_common_quotes_inverted(self):
        s1 = "ab cd x ef gh"
        s2 = "ef gh z ab cd"
        assert set(utils.find_common_quotes(s1, s2, min_words=2)) == {"ab cd", "ef gh"}


class TestNormalizeText:
    def test_empty_text(self):
        input_text = ""
        expected = ""
        assert utils.normalize_text(input_text) == expected

    def test_normalize_text(self):
        input_text = "  Hello, World! This is a Test.  "
        expected = "hello world this is a test"
        assert utils.normalize_text(input_text) == expected

    def test_normalize_text_with_numbers(self):
        input_text = "123 Main St. Apt #4"
        expected = "123 main st apt 4"
        assert utils.normalize_text(input_text) == expected

    def test_normalize_text_with_special_characters(self):
        input_text = "Hello! @World #2023 $Test %"
        expected = "hello world 2023 test"
        assert utils.normalize_text(input_text) == expected

    def test_normalize_text_with_unicode(self):
        input_text = "Café Münchén - résumé"
        expected = "café münchén résumé"
        assert utils.normalize_text(input_text) == expected

    def test_normalize_text_with_punctuation(self):
        input_text = "Hello... World!!!"
        expected = "hello world"
        assert utils.normalize_text(input_text) == expected

    def test_normalize_text_with_newlines(self):
        input_text = "Hello\nWorld\nThis is a Test"
        expected = "hello world this is a test"
        assert utils.normalize_text(input_text) == expected

    def test_normalize_text_with_tabs(self):
        input_text = "Hello\tWorld\tThis is a Test"
        expected = "hello world this is a test"
        assert utils.normalize_text(input_text) == expected

    def test_normalize_text_with_multiple_spaces(self):
        input_text = "Hello    World    This is a Test"
        expected = "hello world this is a test"
        assert utils.normalize_text(input_text) == expected

    def test_normalize_text_with_mixed_case(self):
        input_text = "Hello World THIS is a Test"
        expected = "hello world this is a test"
        assert utils.normalize_text(input_text) == expected

    def test_normalize_text_with_accented_characters(self):
        input_text = "Café Crème - résumé"
        expected = "café crème résumé"
        assert utils.normalize_text(input_text) == expected

    def test_normalize_text_with_emojis(self):
        input_text = "Hello 😊 World 🌍"
        expected = "hello world"
        assert utils.normalize_text(input_text) == expected


class TestFilterSubstringsInString:
    def test_filter_substrings_in_string_empty(self):
        subs = []
        s = ""
        filtered = utils.filter_substrings_in_string(subs, s)
        assert filtered == []

    def test_filter_substrings_in_string(self):
        subs = ["a", "b", "c"]
        s = "a b c"
        filtered = utils.filter_substrings_in_string(subs, s)
        assert filtered == ["a", "b", "c"]

    def test_filter_substrings_in_string_mixed_case(self):
        subs = ["a", "b", "c"]
        s = "a c"
        filtered = utils.filter_substrings_in_string(subs, s)
        assert filtered == ["a", "c"]

    def test_filter_substrings_in_string_not_present(self):
        subs = ["a", "b", "c"]
        s = "d e f"
        filtered = utils.filter_substrings_in_string(subs, s)
        assert filtered == []
