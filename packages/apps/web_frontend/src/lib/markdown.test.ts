// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isMarkdown, renderMarkdown } from "./markdown";

describe("isMarkdown", () => {
  it("recognizes Markdown file names", () => {
    expect(isMarkdown("README.md")).toBe(true);
    expect(isMarkdown("docs/a.MARKDOWN")).toBe(true);
    expect(isMarkdown("page.mdx")).toBe(true);
  });

  it("refuses other files and empty values", () => {
    expect(isMarkdown("a.ts")).toBe(false);
    expect(isMarkdown("md")).toBe(false);
    expect(isMarkdown(null)).toBe(false);
  });
});

describe("renderMarkdown", () => {
  it("renders headings, emphasis and lists", () => {
    const html = renderMarkdown("# Title\n\n**bold** and *italic*\n\n- one\n- two");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<li>two</li>");
  });

  it("renders GitHub tables", () => {
    expect(renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |")).toContain("<table>");
  });

  it("renders task list boxes as disabled checkboxes", () => {
    const html = renderMarkdown("- [x] done\n- [ ] todo");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("disabled");
  });

  it("highlights fenced code of a known language", () => {
    const html = renderMarkdown("```js\nconst a = 1;\n```");
    expect(html).toContain('<pre class="md-code">');
    expect(html).toContain("hljs-keyword");
  });

  it("escapes fenced code of an unknown language", () => {
    expect(renderMarkdown("```\n<b>x</b>\n```")).toContain("&lt;b&gt;");
  });

  it("removes scripts", () => {
    expect(renderMarkdown("<script>alert(1)</script>hello")).not.toContain("<script");
  });

  it("removes event handlers", () => {
    expect(renderMarkdown('<a href="#" onclick="evil()">x</a>')).not.toContain("onclick");
  });

  it("removes iframes, forms and styles", () => {
    const html = renderMarkdown('<iframe src="https://x"></iframe><form><button>go</button></form><style>a{}</style>');
    expect(html).not.toMatch(/<(iframe|form|button|style)/);
  });

  it("removes inputs that are not checkboxes", () => {
    expect(renderMarkdown('<input type="text" value="x">')).not.toContain("<input");
  });

  it("removes javascript links", () => {
    expect(renderMarkdown("[x](javascript:alert(1))")).not.toContain("javascript:");
  });

  it("turns an image from an unknown host into a link", () => {
    const html = renderMarkdown("![logo](https://tracker.example/pixel.png)", { project: "https://gitlab.com/g/a", imgHosts: [] });
    expect(html).not.toContain("<img");
    expect(html).toContain('href="https://tracker.example/pixel.png"');
    expect(html).toContain("logo");
  });

  it("keeps an image from an allowed host", () => {
    const html = renderMarkdown("![logo](https://cdn.example/a.png)", { project: "https://gitlab.com/g/a", imgHosts: ["cdn.example"] });
    expect(html).toContain('<img src="https://cdn.example/a.png"');
  });

  it("keeps an image given as a data URL", () => {
    expect(renderMarkdown("![x](data:image/png;base64,AAAA)")).toContain("<img");
  });

  it("resolves a relative link against the project", () => {
    const html = renderMarkdown("[doc](docs/a.md)", { project: "https://gitlab.com/g/a", imgHosts: [] });
    expect(html).toContain('href="https://gitlab.com/g/a/docs/a.md"');
  });

  it("resolves an absolute path against the host", () => {
    const html = renderMarkdown("[x](/other/repo)", { project: "https://gitlab.com/g/a", imgHosts: [] });
    expect(html).toContain('href="https://gitlab.com/other/repo"');
  });

  it("resolves an upload path under the project", () => {
    const html = renderMarkdown("[f](/uploads/abc/f.pdf)", { project: "https://gitlab.com/g/a/", imgHosts: [] });
    expect(html).toContain('href="https://gitlab.com/g/a/uploads/abc/f.pdf"');
  });

  it("leaves absolute URLs and anchors alone", () => {
    const html = renderMarkdown("[a](https://x.io/p) [b](#top)", { project: "https://gitlab.com/g/a", imgHosts: [] });
    expect(html).toContain('href="https://x.io/p"');
    expect(html).toContain('href="#top"');
  });

  it("does not keep the context of a previous call", () => {
    renderMarkdown("[a](x)", { project: "https://gitlab.com/g/a", imgHosts: [] });
    expect(renderMarkdown("[a](x)")).toContain('href="x"');
  });
});
