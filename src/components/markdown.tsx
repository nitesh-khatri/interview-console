import { Fragment, type ReactNode } from "react";

/**
 * A deliberately small Markdown renderer: bold, italic, inline code, fenced
 * code blocks, unordered lists and links. Nothing else.
 *
 * It returns React elements, never an HTML string, and never touches
 * dangerouslySetInnerHTML — so a note containing `<script>` renders as visible
 * text and executes nothing. The report is a public page; this is the property
 * that matters most.
 */
export function Markdown({
  source,
  className,
}: {
  source: string | null | undefined;
  className?: string;
}) {
  return (
    <div
      data-testid="notes-preview"
      className={className ?? "space-y-2 text-sm leading-relaxed"}
    >
      {renderBlocks(source ?? "")}
    </div>
  );
}

/** Only http(s), mailto and relative links; a javascript: URL becomes inert. */
function safeHref(url: string): string | undefined {
  const trimmed = url.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed;
  return undefined;
}

function renderBlocks(source: string): ReactNode[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    if (line.trimStart().startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        body.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume the closing fence if present
      blocks.push(
        <pre
          key={key++}
          className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs"
        >
          <code>{body.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Unordered list — a run of "- " / "* " lines.
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc space-y-0.5 pl-5">
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Blank line — paragraph separator.
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph: consecutive non-blank, non-special lines, keeping line breaks.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trimStart().startsWith("```") &&
      !/^\s*[-*]\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++}>
        {para.map((l, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {renderInline(l)}
          </Fragment>
        ))}
      </p>
    );
  }

  return blocks;
}

/**
 * Inline formatting. Code spans are handled first so `**` inside backticks is
 * left literal; an unmatched marker (`**bold`) is simply rendered as text.
 */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let key = 0;

  // Ordered so the earliest match in the string wins.
  const patterns: Array<{
    re: RegExp;
    render: (m: RegExpExecArray) => ReactNode;
  }> = [
    { re: /`([^`]+)`/, render: (m) => <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{m[1]}</code> },
    {
      re: /\[([^\]]+)\]\(([^)]+)\)/,
      render: (m) => {
        const href = safeHref(m[2]);
        return href ? (
          <a key={key} href={href} className="text-primary underline underline-offset-2" target="_blank" rel="noreferrer noopener">
            {m[1]}
          </a>
        ) : (
          // Unsafe URL: show the link text as plain text, drop the href.
          <Fragment key={key}>{m[1]}</Fragment>
        );
      },
    },
    { re: /\*\*([^*]+)\*\*/, render: (m) => <strong key={key}>{m[1]}</strong> },
    { re: /\*([^*]+)\*/, render: (m) => <em key={key}>{m[1]}</em> },
  ];

  while (rest.length > 0) {
    let best: { index: number; length: number; node: ReactNode } | null = null;
    for (const { re, render } of patterns) {
      const m = re.exec(rest);
      if (m && (best === null || m.index < best.index)) {
        best = { index: m.index, length: m[0].length, node: render(m) };
      }
    }
    if (!best) {
      nodes.push(rest);
      break;
    }
    if (best.index > 0) nodes.push(rest.slice(0, best.index));
    nodes.push(best.node);
    key++;
    rest = rest.slice(best.index + best.length);
  }

  return nodes;
}
