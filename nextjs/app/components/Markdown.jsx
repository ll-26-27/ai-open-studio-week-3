import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { markdownHref } from "../../lib/content.mjs";
import CodeBlock from "./CodeBlock.jsx";

// Renders a document's Markdown with the leading H1 removed (the page supplies its own title).
export default function Markdown({ doc, copyButtons = true }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} components={{
      a: ({ href, children }) => <a href={markdownHref(href, doc.href)}>{children}</a>,
      pre: ({ children }) => copyButtons ? <CodeBlock>{children}</CodeBlock> : <pre>{children}</pre>,
    }}>{doc.content.replace(/^\s*#\s+[^\n]+(?:\r?\n|$)/, "")}</ReactMarkdown>
  );
}
