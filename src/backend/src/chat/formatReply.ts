// ---------------------------------------------------------------------------
// Turns the model's reply into plain text for the chat widget.
//
// The system prompt asks for plain text, but smaller models still answer in
// markdown, so the final reply is cleaned here as well:
//   - **bold**, __bold__ and *italic* markers are removed
//   - "# Heading" lines lose the #s
//   - [text](url) becomes "text: url"
//   - markdown tables become "- a, b, c" lines
//   - runs of blank lines collapse to one
// Plain "- " lists, numbered lists and bare URLs pass through unchanged.
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

export function formatReply(reply: string): string {
  const lines = reply.replace(/\r\n?/g, "\n").split("\n");

  return flattenTables(lines)
    .map(cleanLine)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
