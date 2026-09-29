import {
  buildExportUrl,
  type ExportDataset,
  type ExportFormat,
} from "../api/exports";

interface DatasetDownloadsProps {
  dataset: ExportDataset;
  season: string;
  /** Plain-language name for screen readers, e.g. "races". */
  label: string;
  /**
   * Show the season and dataset in the link text ("Download 2025 results
   * (CSV)") rather than just the format. Use it when a page offers more than
   * one dataset, so sighted users can tell the links apart too.
   */
  describe?: boolean;
}

const FORMATS: ReadonlyArray<{ format: ExportFormat; text: string }> = [
  { format: "csv", text: "CSV" },
  { format: "json", text: "JSON" },
];

function DatasetDownloads({
  dataset,
  season,
  label,
  describe = false,
}: DatasetDownloadsProps) {
  return (
    <div className="dataset-downloads">
      {FORMATS.map(({ format, text }) => (
        <a
          key={format}
          className="dashboard-secondary-button"
          href={buildExportUrl(dataset, format, season)}
          download
          aria-label={`Download ${season} ${label} as ${text}`}
        >
          {describe ? `Download ${season} ${label} (${text})` : `Download ${text}`}
        </a>
      ))}
    </div>
  );
}

export default DatasetDownloads;
