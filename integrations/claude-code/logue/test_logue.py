"""What the skill's tool has to get right, pinned.

Nearly all of it is the two conversions, because that is where a mistake is
silent: a write goes through, the Host is happy, and the person finds their
document reformatted the next time they open it.
"""

from __future__ import annotations

import re
import sys
import unittest
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from logue import html_to_markdown, markdown_to_html, read_link  # noqa: E402


class _Visible(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.seen: list[str] = []

    def handle_data(self, data: str) -> None:
        self.seen.append(data)


def visible(html: str) -> str:
    """Every character a person can read, tags gone and whitespace ignored."""
    parser = _Visible()
    parser.feed(html)
    parser.close()
    return re.sub(r"\s+", "", "".join(parser.seen))


class WhatAnAgentWrites(unittest.TestCase):
    def test_markdown_becomes_the_editor_s_markup(self) -> None:
        html = markdown_to_html("# Title\n\nA line.\n- one\n- two")
        self.assertEqual(
            html,
            "<h1>Title</h1><div><br></div><div>A line.</div><ul><li>one</li><li>two</li></ul>",
        )

    def test_a_blank_line_survives_as_a_blank_line(self) -> None:
        self.assertEqual(markdown_to_html("a\n\n\nb").count("<div><br></div>"), 2)

    def test_adjacent_lines_stay_two_blocks(self) -> None:
        self.assertEqual(markdown_to_html("a\nb"), "<div>a</div><div>b</div>")

    def test_inline_marks(self) -> None:
        html = markdown_to_html("**bold** *soft* `code` [text](http://x.test) ==lit==")
        self.assertIn("<strong>bold</strong>", html)
        self.assertIn("<em>soft</em>", html)
        self.assertIn("<code>code</code>", html)
        self.assertIn('<a href="http://x.test">text</a>', html)
        self.assertIn("<mark>lit</mark>", html)

    def test_a_document_is_never_a_way_to_run_html(self) -> None:
        html = markdown_to_html("<script>alert(1)</script> a & b")
        self.assertNotIn("<script>", html)
        self.assertIn("&lt;script&gt;", html)
        self.assertIn("a &amp; b", html)

    def test_a_lone_backtick_stays_a_backtick(self) -> None:
        self.assertEqual(markdown_to_html("```"), "<div>```</div>")

    def test_a_stray_fence_does_not_swallow_what_follows_it(self) -> None:
        # It used to pair with the next backtick on the line and eat the text
        # in between, bold and all.
        html = markdown_to_html("孤立的 ``` 被吃掉。现在 **零差异**,见 `npm test`。")
        self.assertIn("孤立的 ``` 被吃掉", html)
        self.assertIn("<strong>零差异</strong>", html)
        self.assertIn("<code>npm test</code>", html)

    def test_code_may_hold_a_backtick(self) -> None:
        self.assertIn("<code>a ` b</code>", markdown_to_html("``a ` b``"))


class WhatAnAgentReads(unittest.TestCase):
    def test_the_editor_s_markup_becomes_markdown(self) -> None:
        markdown = html_to_markdown("<h2>Head</h2><div>Body</div><ul><li>one</li><li>two</li></ul>")
        self.assertEqual(markdown, "## Head\nBody\n- one\n- two")

    def test_a_blank_line_is_a_br_and_nothing_else(self) -> None:
        # Two adjacent blocks are two lines; only `<div><br></div>` is a gap.
        self.assertEqual(html_to_markdown("<div>a</div><div>b</div>"), "a\nb")
        self.assertEqual(html_to_markdown("<div>a</div><div><br></div><div>b</div>"), "a\n\nb")

    def test_inline_tags(self) -> None:
        markdown = html_to_markdown('<div><strong>b</strong> <em>i</em> <a href="http://x.test">t</a></div>')
        self.assertEqual(markdown, "**b** *i* [t](http://x.test)")

    def test_an_ordered_list_keeps_counting(self) -> None:
        self.assertEqual(html_to_markdown("<ol><li>a</li><li>b</li></ol>"), "1. a\n2. b")

    def test_a_typed_nbsp_is_a_character_not_padding(self) -> None:
        self.assertIn("\xa0", html_to_markdown("<div>done.&nbsp;</div>"))


class TextThatOnlyLooksLikeMarkup(unittest.TestCase):
    """The rule that cost the most to find: real documents are full of this.

    Logue's editor has no headings, so `## 需求` typed into it is four
    characters. A document made straight from a generation is plain Markdown
    text with no tags at all, for the same reason. Reading either as markup and
    writing it back would rewrite somebody's document while passing through.
    """

    def unchanged(self, content: str) -> None:
        markdown = html_to_markdown(content)
        back = markdown_to_html(markdown)
        self.assertEqual(visible(content), visible(back), f"text moved: {markdown!r} -> {back!r}")
        self.assertEqual(markdown, html_to_markdown(back), "reading it again gives something else")

    def test_a_hash_typed_into_the_editor_stays_a_hash(self) -> None:
        self.unchanged("<div>## 需求</div><div>设计一个小的产品。</div>")

    def test_stars_typed_into_the_editor_do_not_become_bold(self) -> None:
        self.unchanged("<div>* **保存与写入顺序**：先保存</div>")

    def test_a_numbered_line_is_not_promoted_to_a_list(self) -> None:
        self.unchanged("<div>1. 执行前验证参数。</div><div>2. 可重试操作。</div>")

    def test_a_document_stored_as_plain_text_with_newlines(self) -> None:
        self.unchanged("## 目标\n\n让工具调用具备明确意图。\n\n1. 执行前验证参数。")

    def test_a_fence_and_a_quote_and_a_dash(self) -> None:
        self.unchanged("<div>```</div><div>&gt; quoted</div><div>- dashed</div>")

    def test_a_backslash_is_a_backslash(self) -> None:
        self.unchanged("<div>C:\\path\\to and \\*not bold\\*</div>")

    def test_inside_code_there_are_no_escapes(self) -> None:
        # `tab === "talk"` came back as `tab \=\== "talk"`, and a code span
        # holding `* **顺序**` came back with four backslashes in it.
        self.unchanged('<div>代码里 <code>tab === "talk"</code> 这类标识</div>')
        self.unchanged("<div>所以 <code>* **顺序**</code> 在真文档里就是字</div>")
        self.unchanged("<div>路径 <code>C:\\temp</code> 照抄</div>")

    def test_code_holding_a_backtick_comes_back_whole(self) -> None:
        self.unchanged("<div>写作 <code>a ` b</code> 的时候</div>")

    def test_citations_are_left_exactly_as_they_are(self) -> None:
        self.unchanged("<div>Evidence stays traceable [Source 1], [Source 2, 7].</div>")


class RoundTrip(unittest.TestCase):
    def test_markdown_an_agent_wrote_reads_back_as_itself(self) -> None:
        written = (
            "# Findings\n"
            "\n"
            "The build fails in **two** places, see `app.py`.\n"
            "\n"
            "## Where\n"
            "- one\n"
            "- two\n"
            "\n"
            "1. first\n"
            "2. second\n"
            "\n"
            "> a quotation\n"
            "\n"
            "A [link](http://example.test) and a ==highlight==.\n"
        )
        self.assertEqual(html_to_markdown(markdown_to_html(written)), written.strip())


class Links(unittest.TestCase):
    def test_a_document_link(self) -> None:
        self.assertEqual(
            read_link("http://127.0.0.1:8787/documents/doc_1a2b3c"),
            ("http://127.0.0.1:8787", "doc_1a2b3c"),
        )

    def test_a_link_from_somewhere_the_api_is_not(self) -> None:
        self.assertEqual(read_link("http://localhost:5173/documents/doc_9f"), ("http://localhost:5173", "doc_9f"))

    def test_a_bare_id_names_no_host(self) -> None:
        self.assertEqual(read_link("doc_1a2b3c"), ("", "doc_1a2b3c"))

    def test_anything_else_is_refused(self) -> None:
        self.assertIsNone(read_link("http://127.0.0.1:8787/projects/prj_1"))
        self.assertIsNone(read_link("the document about pricing"))


if __name__ == "__main__":
    unittest.main()
