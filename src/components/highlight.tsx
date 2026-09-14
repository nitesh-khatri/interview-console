export type HighlightPart = {
  text: string;
  match: boolean;
};

export function splitOnMatches(
  text: string,
  query: string,
): HighlightPart[] {
  if (!query) {
    return [{ text, match: false }];
  }

  const parts: HighlightPart[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  let start = 0;

  while (true) {
    const index = lowerText.indexOf(lowerQuery, start);

    if (index === -1) {
      if (start < text.length) {
        parts.push({
          text: text.slice(start),
          match: false,
        });
      }
      break;
    }

    if (index > start) {
      parts.push({
        text: text.slice(start, index),
        match: false,
      });
    }

    parts.push({
      text: text.slice(index, index + query.length),
      match: true,
    });

    start = index + query.length;
  }

  return parts;
}

export function Highlight({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const parts = splitOnMatches(text, query);

  return (
    <>
      {parts.map((part, index) =>
        part.match ? (
          <mark
            key={index}
            className="rounded-sm bg-accent px-0.5 text-accent-foreground"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}