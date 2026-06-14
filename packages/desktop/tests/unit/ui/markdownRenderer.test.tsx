import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "../../../src/mainview/components/MarkdownRenderer";

// @vitest-environment jsdom

describe("MarkdownRenderer", () => {
	it("renders basic markdown", () => {
		render(<MarkdownRenderer content="**bold text**" />);
		const bold = screen.getByText("bold text");
		expect(bold.tagName).toBe("STRONG");
	});

	it("renders GFM tables", () => {
		const md = "| A | B |\n|---|---|\n| 1 | 2 |";
		const { container } = render(<MarkdownRenderer content={md} />);
		expect(container.querySelector("table")).not.toBeNull();
		expect(container.querySelector("th")).not.toBeNull();
		expect(container.querySelector("td")).not.toBeNull();
	});

	it("renders GFM task lists", () => {
		const md = "- [x] Done\n- [ ] Todo";
		const { container } = render(<MarkdownRenderer content={md} />);
		const checkboxes = container.querySelectorAll('[role="checkbox"]');
		expect(checkboxes.length).toBe(2);
	});

	it("renders inline code", () => {
		render(<MarkdownRenderer content="Use `foo()` here" />);
		const code = screen.getByText("foo()");
		expect(code.tagName).toBe("CODE");
	});

	it("renders code blocks", () => {
		const md = "```js\nconst x = 1;\n```";
		const { container } = render(<MarkdownRenderer content={md} />);
		expect(container.querySelector("pre")).not.toBeNull();
		expect(container.querySelector("code")).not.toBeNull();
	});

	it("blocks javascript: hrefs (T-02-08 security)", () => {
		const md = "[click me](javascript:alert(1))";
		const { container } = render(<MarkdownRenderer content={md} />);
		const link = container.querySelector("a");
		expect(link).not.toBeNull();
		// href should be removed/undefined, not javascript:
		expect(link?.getAttribute("href")).toBeNull();
	});

	it("allows normal https: hrefs", () => {
		const md = "[link](https://example.com)";
		const { container } = render(<MarkdownRenderer content={md} />);
		const link = container.querySelector("a");
		expect(link?.getAttribute("href")).toBe("https://example.com");
	});

	it("renders blockquotes", () => {
		const md = "> quoted text";
		const { container } = render(<MarkdownRenderer content={md} />);
		expect(container.querySelector("blockquote")).not.toBeNull();
	});

	it("handles empty content", () => {
		const { container } = render(<MarkdownRenderer content="" />);
		expect(container.querySelector(".markdown-notes")).not.toBeNull();
	});
});
