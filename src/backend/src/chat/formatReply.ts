// ---------------------------------------------------------------------------
// Turns the model's reply into plain text for the chat widget.
//
// The system prompt asks for plain text, but smaller models still answer in
// markdown, so the final reply is cleaned here as well:
//   - **bold**, __bold__ and *italic* markers are removed
//   - "# Heading" lines lose the #s
//   - [text](url) becomes "text: url"
//   - markdown tables become "- a, b, c" lines
//   - every http(s) URL goes on its own line, without trailing punctuation
//   - runs of blank lines collapse to one
// Plain "- " lists and numbered lists pass through unchanged, as does a URL
// that already sits alone on its line.
// Single underscores are left alone: ids such as 2025_R13 contain them.
// ---------------------------------------------------------------------------

const TABLE_SEPARATOR_CELL = /^:?-{1,}:?$/;

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith("|") || /\S\s*\|\s*\S/.test(line);
}

function isSeparatorRow(line: string): boolean {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => TABLE_SEPARATOR_CELL.test(cell));
}

/**
 * Rewrites each markdown table (a run of `|` rows that includes a
 * `|---|---|` separator) as one "- " line per data row. The header row,
 * when there is one, is kept as a plain line ending in ":" so the columns
 * still have names.
 */
function flattenTables(lines: readonly string[]): string[] {
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!isTableRow(line)) {
      output.push(line);
      index += 1;
      continue;
    }

    let end = index;
    while (end < lines.length && isTableRow(lines[end] ?? "")) end += 1;
    const block = lines.slice(index, end);
    const separatorAt = block.findIndex(isSeparatorRow);

    if (separatorAt === -1) {
      // Pipes, but not a table: leave the text as written.
      output.push(...block);
    } else {
      for (const [rowIndex, row] of block.entries()) {
        if (isSeparatorRow(row)) continue;
        const text = tableCells(row).filter(Boolean).join(", ");
        if (text === "") continue;
        output.push(rowIndex < separatorAt ? `${text}:` : `- ${text}`);
      }
    }

    index = end;
  }

  return output;
}

function cleanLine(line: string): string {
  return (
    line
      // "# Heading" -> "Heading" (and any closing #s)
      .replace(/^\s{0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/, "$1")
      // "* item" / "+ item" bullets -> "- item", before * is read as italic
      .replace(/^(\s*)[*+]\s+/, "$1- ")
      // [text](url) -> "text: url", or just the url when they match
      .replace(/\[([^\]\n]+)\]\((\S+?)\)/g, (_match, text: string, url: string) =>
        text.trim() === url ? url : `${text.trim()}: ${url}`
      )
      // **bold** and __bold__
      .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "$1")
      .replace(/(?<![\w_])__(?=\S)(.+?)(?<=\S)__(?![\w_])/g, "$1")
      // *italic*
      .replace(/(?<![\w*])\*(?=\S)([^*\n]+?)(?<=\S)\*(?![\w*])/g, "$1")
      // Empty pairs left behind, e.g. "** **"
      .replace(/\*\*\s*\*\*|(?<![\w_])__\s*__(?![\w_])/g, "")
      .replace(/\s+$/, "")
  );
}

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/g;
const URL_TRAILING_PUNCTUATION = new Set([",", ".", ";", ":", ")", "!"]);
const LIST_MARKER = /^\s*(?:-|\d+\.)\s*$/;

function countChar(text: string, char: string): number {
  return text.split(char).length - 1;
}

/**
 * Splits trailing sentence punctuation off a URL. A ")" stays when it closes
 * a "(" inside the URL, as in .../wiki/Spa_(circuit).
 */
export function trimUrl(raw: string): string {
  let url = raw;
  for (;;) {
    const last = url.slice(-1);
    if (!URL_TRAILING_PUNCTUATION.has(last)) break;
    if (last === ")" && countChar(url, "(") >= countChar(url, ")")) break;
    url = url.slice(0, -1);
  }
  return url;
}

/** Text before a URL: keep it, ending in a colon unless it already ends a sentence. */
function leadIn(text: string): string | undefined {
  const trimmed = text.trimEnd();
  if (trimmed === "") return undefined;
  return /[:.!?]$/.test(trimmed) ? trimmed : `${trimmed}:`;
}

/** Text after a URL: drop the punctuation left behind and start it with a capital. */
function followOn(text: string): string | undefined {
  const trimmed = text.replace(/^[\s,.;:!)]+/, "").trim();
  if (trimmed === "") return undefined;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Puts every URL in the line on a line of its own. "See the list: URL, or
 * ask..." becomes "See the list:", "URL", "Or ask...". A line that is only a
 * URL, or a list marker and a URL, is returned as it is apart from trailing
 * punctuation.
 */
function isolateUrls(line: string): string[] {
  const matches = [...line.matchAll(URL_PATTERN)];
  if (matches.length === 0) return [line];

  const output: string[] = [];
  let cursor = 0;

  for (const [index, match] of matches.entries()) {
    const url = trimUrl(match[0]);
    const before = line.slice(cursor, match.index);

    if (index === 0 && LIST_MARKER.test(before)) {
      output.push(`${before}${url}`);
    } else {
      const text = index === 0 ? leadIn(before) : followOn(before);
      if (text !== undefined) output.push(index === 0 ? text : (leadIn(text) ?? text));
      output.push(url);
    }

    cursor = match.index + url.length;
  }

  const rest = followOn(line.slice(cursor));
  if (rest !== undefined) output.push(rest);

  return output;
}

export function formatReply(reply: string): string {
  const lines = reply.replace(/\r\n?/g, "\n").split("\n");

  return flattenTables(lines)
    .map(cleanLine)
    .flatMap(isolateUrls)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Every http(s) URL in some text, without trailing sentence punctuation. */
export function extractUrls(text: string): string[] {
  return [...text.matchAll(URL_PATTERN)].map((match) => trimUrl(match[0]));
}

/** "https://x" alone on a line, or after a list marker ("- https://x"). */
const URL_LINE = /^\s*(?:(?:-|\d+\.)\s+)?(https?:\/\/\S+)\s*$/;

/**
 * Removes every URL that is not in `allowed` (the URLs the tools returned in
 * this request), so the assistant can never hand out an invented link.
 *
 * Runs on formatReply's output, where each URL already sits on its own line,
 * so a removed URL takes its whole line with it. A lead-in line ending in ":"
 * ("Download:", "Full list:") is dropped too when every URL it introduced was
 * removed, so nothing is left dangling. Text without URLs is unchanged.
 */
export function removeUnknownUrls(reply: string, allowed: ReadonlySet<string>): string {
  const lines = reply.split("\n");
  const isUrlLine = (line: string) => URL_LINE.test(line);
  const isAllowed = (line: string) => {
    const url = URL_LINE.exec(line)?.[1];
    return url !== undefined && allowed.has(trimUrl(url));
  };

  const output: string[] = [];
  for (const [index, line] of lines.entries()) {
    if (isUrlLine(line)) {
      if (isAllowed(line)) output.push(line);
      continue;
    }

    if (line.trimEnd().endsWith(":")) {
      // The URL lines this one introduces: keep it only if one survives.
      const introduced: string[] = [];
      for (const next of lines.slice(index + 1)) {
        if (!isUrlLine(next)) break;
        introduced.push(next);
      }
      if (introduced.length > 0 && !introduced.some(isAllowed)) continue;
    }

    output.push(line);
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
