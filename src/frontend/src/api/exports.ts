import { API_BASE_URL } from "./submissions";

export type ExportDataset =
  | "races"
  | "drivers"
  | "constructors"
  | "results"
  | "laps";

export type ExportFormat = "csv" | "json";

/**
 * URL for GET /export/:dataset. The API sends it as an attachment, so a plain
 * link downloads the file — no fetch needed.
 */
export function buildExportUrl(
  dataset: ExportDataset,
  format: ExportFormat,
  season: string
): string {
  const params = new URLSearchParams({ format, season });
  return `${API_BASE_URL}/export/${dataset}?${params.toString()}`;
}
