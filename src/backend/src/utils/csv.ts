/**
 * RFC 4180 serialisation for the dataset exports (GET /export/:dataset).
 *
 * Pure: no I/O and no Express, so the escaping rules are testable on their
 * own. Records are CRLF-terminated per the RFC, including the last one.
 */

const LINE_END = "\r\n";

/**
 * One CSV field. `null`/`undefined` become an empty field so a missing value
 * is distinguishable from the literal string "null" once loaded into a
 * spreadsheet or pandas. A field containing a comma, a double quote, CR or LF
 * is quoted, with any embedded quotes doubled.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";

  const text = typeof value === "string" ? value : String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

/**
 * A header row of `columns`, then one record per row with its values in the
 * same order. `columns` is explicit rather than read from the first row so an
 * empty result still produces a header, and so column order is part of the
 * export's contract rather than an accident of the SQL.
 */
export function toCsv<Row>(
  columns: readonly (keyof Row & string)[],
  rows: readonly Row[]
): string {
  const lines = [columns.map(escapeCsvField).join(",")];

  for (const row of rows) {
    lines.push(columns.map((column) => escapeCsvField(row[column])).join(","));
  }

  return lines.join(LINE_END) + LINE_END;
}
