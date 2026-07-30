/**
 * Wraps every case-insensitive occurrence of `query` in `text` with a <mark>.
 *
 * Returns React elements rather than an HTML string, so a candidate named
 * `<script>` renders as visible text. Nothing here goes near
 * dangerouslySetInnerHTML — the search query is user input, and so is the text.
 */
export function Highlight({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}) {
  const q = query.trim();
  if (!q) return <>{text}</>;

  const parts = splitOnMatches(text, q);
  if (parts.length === 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className={
              className ?? "rounded-sm bg-warning/30 text-foreground"
            }
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

/**
 * Splits `text` into alternating unmatched/matched runs.
 *
 * Uses indexOf on lower-cased copies rather than a RegExp, so regex
 * metacharacters in the query (`.`, `*`, `(`, `[`) are treated as literal text
 * and there is nothing to escape. The slices come from the original string, so
 * the displayed casing is preserved.
 */
export function splitOnMatches(text: string, query: string): HighlightPart[] {
  const q = query.trim();
  if (!q) return [{ text, match: false }];

  const haystack = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: HighlightPart[] = [];

  let cursor = 0;
  let found = haystack.indexOf(needle, cursor);

  while (found !== -1) {
    if (found > cursor) {
      parts.push({ text: text.slice(cursor, found), match: false });
    }
    parts.push({ text: text.slice(found, found + needle.length), match: true });
    cursor = found + needle.length;
    found = haystack.indexOf(needle, cursor);
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), match: false });
  }
  return parts;
}
