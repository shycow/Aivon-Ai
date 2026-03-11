import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, ThumbsUp, ThumbsDown, RefreshCw, Edit3 } from "lucide-react";
import { motion } from "framer-motion";

function CodeBlock({ inline, className, children }) {
  const match = /language-(\w+)/.exec(className || "");
  const code = String(children).replace(/\n$/, "");
  const language = match ? match[1] : "text";

  if (inline) {
    return <code className="inline-code">{children}</code>;
  }

  return (
    <div className="code-block">
      <div className="code-header">
        <span>{language}</span>
        <button
          onClick={() => navigator.clipboard.writeText(code)}
          title="Copy code"
          type="button"
        >
          <Copy size={14} />
        </button>
      </div>
      <SyntaxHighlighter language={language} style={oneDark} customStyle={{ margin: 0 }}>
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export function MessageItem({ message, onRegenerate, onEditPrompt }) {
  const isUser = message.role === "user";
  const alignment = isUser ? "user" : "assistant";
  const isStreaming = Boolean(message.streaming);

  const content = useMemo(() => message.content || "", [message.content]);

  return (
    <motion.div
      className={`message ${alignment}`}
      initial={{ opacity: 0, x: isUser ? 24 : -8, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="avatar">{isUser ? "YOU" : "AI"}</div>
      <div className="bubble">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code: CodeBlock,
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            )
          }}
        >
          {content}
        </ReactMarkdown>
        {isStreaming ? <span className="typing-cursor" /> : null}
        {message.sources?.length ? (
          <div className="sources">
            <strong>Sources</strong>
            <ul>
              {message.sources.map((source, idx) => (
                <li key={`${source.url}-${idx}`}>[{idx + 1}] {source.url}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {!isUser && !isStreaming ? (
          <div className="message-actions">
            <button type="button" title="Copy response" onClick={() => navigator.clipboard.writeText(content)}>
              <Copy size={14} />
            </button>
            <button type="button" title="Regenerate" onClick={onRegenerate}>
              <RefreshCw size={14} />
            </button>
            <button type="button" title="Like">
              <ThumbsUp size={14} />
            </button>
            <button type="button" title="Dislike">
              <ThumbsDown size={14} />
            </button>
            <button type="button" title="Edit prompt" onClick={onEditPrompt}>
              <Edit3 size={14} />
            </button>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
