interface PostBodyProps {
  body: string;
}

export default function PostBody({ body }: PostBodyProps) {
  return (
    <div
      className="tw-article-body"
      style={{
        lineHeight: "1.75",
        color: "var(--tw-dark)",
        maxWidth: "65ch",
        fontSize: "1rem",
      }}
    >
      <style>{`
        .tw-article-body h1,
        .tw-article-body h2,
        .tw-article-body h3,
        .tw-article-body h4 {
          font-weight: 700;
          line-height: 1.3;
          margin-top: 1.75em;
          margin-bottom: 0.75em;
          color: var(--tw-dark);
        }
        .tw-article-body h1 { font-size: 1.875rem; }
        .tw-article-body h2 { font-size: 1.5rem; }
        .tw-article-body h3 { font-size: 1.25rem; }
        .tw-article-body h4 { font-size: 1.125rem; }
        .tw-article-body p {
          margin-bottom: 1.25em;
        }
        .tw-article-body ul,
        .tw-article-body ol {
          margin-bottom: 1.25em;
          padding-left: 1.5em;
        }
        .tw-article-body ul { list-style-type: disc; }
        .tw-article-body ol { list-style-type: decimal; }
        .tw-article-body li {
          margin-bottom: 0.375em;
        }
        .tw-article-body a {
          color: var(--tw-blue);
          text-decoration: underline;
        }
        .tw-article-body a:hover {
          opacity: 0.8;
        }
        .tw-article-body strong { font-weight: 700; }
        .tw-article-body em { font-style: italic; }
        .tw-article-body code {
          background: #f3f4f6;
          border-radius: 0.25rem;
          padding: 0.125em 0.375em;
          font-size: 0.875em;
          font-family: ui-monospace, monospace;
        }
        .tw-article-body pre {
          background: #1e293b;
          color: #e2e8f0;
          border-radius: 0.5rem;
          padding: 1em 1.25em;
          overflow-x: auto;
          margin-bottom: 1.25em;
          font-size: 0.875rem;
          font-family: ui-monospace, monospace;
        }
        .tw-article-body pre code {
          background: none;
          padding: 0;
          font-size: inherit;
          color: inherit;
        }
        .tw-article-body blockquote {
          border-left: 4px solid var(--tw-blue);
          margin-left: 0;
          padding-left: 1rem;
          color: var(--tw-mid);
          font-style: italic;
          margin-bottom: 1.25em;
        }
        .tw-article-body hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 2em 0;
        }
        .tw-article-body table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1.25em;
          font-size: 0.875rem;
        }
        .tw-article-body th,
        .tw-article-body td {
          border: 1px solid #e5e7eb;
          padding: 0.5rem 0.75rem;
          text-align: left;
        }
        .tw-article-body th {
          background: #f9fafb;
          font-weight: 600;
        }
      `}</style>
      <article dangerouslySetInnerHTML={{ __html: body }} />
    </div>
  );
}
