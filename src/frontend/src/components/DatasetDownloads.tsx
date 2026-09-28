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
}

const FORMATS: ReadonlyArray<{ format: ExportFormat; text: string }> = [
  { format: "csv", text: "CSV" },
  { format: "json", text: "JSON" },
];

function DatasetDownloads({ dataset, season, label }: DatasetDownloadsProps) {
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
          Download {text}
        </a>
      ))}
    </div>
  );
}

export default DatasetDownloads;
