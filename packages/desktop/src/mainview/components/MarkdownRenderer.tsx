import { useMemo } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import rehypeReact from "rehype-react";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

const processor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkRehype)
	.use(rehypeSanitize, defaultSchema)
	.use(rehypeReact, {
		Fragment,
		jsx,
		jsxs,
		components: {
			h1: (props: React.ComponentProps<"h1">) => (
				<h1
					className="text-[14px] font-semibold leading-[1.3] text-rv-text-primary mb-4"
					{...props}
				/>
			),
			h2: (props: React.ComponentProps<"h2">) => (
				<h2
					className="text-[14px] font-semibold leading-[1.3] text-rv-text-primary mb-2"
					{...props}
				/>
			),
			h3: (props: React.ComponentProps<"h3">) => (
				<h3
					className="text-[13px] font-semibold leading-[1.3] text-rv-text-primary mb-2"
					{...props}
				/>
			),
			p: (props: React.ComponentProps<"p">) => (
				<p
					className="text-[13px] leading-[1.7] text-rv-text-secondary mb-2"
					{...props}
				/>
			),
			a: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
				<a
					href={href}
					className="text-rv-accent no-underline hover:underline"
					{...rest}
				>
					{children}
				</a>
			),
			code: ({
				children,
				className,
				...rest
			}: React.ComponentProps<"code">) => {
				if (className) {
					return (
						<code
							className={`text-[11px] font-[Space_Grotesk] ${className}`}
							{...rest}
						>
							{children}
						</code>
					);
				}
				return (
					<code
						className="text-[11px] font-[Space_Grotesk] bg-rv-bg-elevated text-rv-accent rounded-[3px] px-1 py-0.5"
						{...rest}
					>
						{children}
					</code>
				);
			},
			pre: ({ children, ...rest }: React.ComponentProps<"pre">) => (
				<pre
					className="text-[11px] font-[Space_Grotesk] bg-rv-bg-elevated border border-rv-border rounded-[6px] p-2 mb-2 overflow-x-auto"
					{...rest}
				>
					{children}
				</pre>
			),
			ul: (props: React.ComponentProps<"ul">) => (
				<ul className="ml-4 mb-2 list-disc" {...props} />
			),
			ol: (props: React.ComponentProps<"ol">) => (
				<ol className="ml-4 mb-2 list-decimal" {...props} />
			),
			li: (props: React.ComponentProps<"li">) => (
				<li
					className="text-[13px] leading-[1.7] text-rv-text-secondary mb-1"
					{...props}
				/>
			),
			blockquote: (props: React.ComponentProps<"blockquote">) => (
				<blockquote
					className="border-l-[3px] border-rv-accent pl-4 text-rv-text-secondary italic mb-2"
					{...props}
				/>
			),
			table: (props: React.ComponentProps<"table">) => (
				<table className="w-full border-collapse mb-2" {...props} />
			),
			th: (props: React.ComponentProps<"th">) => (
				<th
					className="text-[11px] font-semibold uppercase bg-rv-bg-elevated p-2 text-left border-b border-rv-border-subtle"
					{...props}
				/>
			),
			td: (props: React.ComponentProps<"td">) => (
				<td
					className="text-[12px] p-2 border-b border-rv-border-subtle"
					{...props}
				/>
			),
			del: (props: React.ComponentProps<"del">) => (
				<del className="text-rv-text-tertiary" {...props} />
			),
			input: ({ type, checked, ...rest }: React.ComponentProps<"input">) => {
				if (type === "checkbox") {
					return (
						// biome-ignore lint/a11y/useSemanticElements: custom styled checkbox for markdown task lists
						// biome-ignore lint/a11y/useFocusableInteractive: read-only display checkbox in rendered markdown
						<span
							className={`inline-block w-[14px] h-[14px] border border-rv-border rounded-[2px] mr-1.5 align-middle ${checked ? "bg-rv-accent" : ""}`}
							aria-checked={!!checked}
							role="checkbox"
							tabIndex={0}
						/>
					);
				}
				return <input type={type} {...rest} />;
			},
		},
	});

export function MarkdownRenderer({ content }: { content: string }) {
	const rendered = useMemo(() => {
		const file = processor.processSync(content);
		return file.result as React.ReactNode;
	}, [content]);

	return <div className="markdown-notes">{rendered}</div>;
}
