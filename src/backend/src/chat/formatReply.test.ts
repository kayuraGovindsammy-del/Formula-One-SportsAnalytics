import { describe, expect, it } from "vitest";
import { formatReply } from "./formatReply.js";

describe("formatReply", () => {
  it("leaves an already-plain reply unchanged", () => {
    const plain = [
      "Using the 2025 season: Oscar Piastri has 7 wins and 12 podiums.",
      "",
      "- Fastest stop: Norris, lap 18, 21.9 s",
      "- Busiest laps: 16 to 20",
      "",
      "Full list:",
      "https://example.test/api/v1/races/2025_R13/events?type=PIT_STOP&per_page=100",
    ].join("\n");

    expect(formatReply(plain)).toBe(plain);
  });

  it("strips **bold** and __bold__ markers", () => {
    expect(formatReply("**Lando Norris** won, __Piastri__ was 2nd.")).toBe(
      "Lando Norris won, Piastri was 2nd."
    );
  });

  it("removes empty bold pairs", () => {
    expect(formatReply("Result: ** ** done")).toBe("Result:  done");
    expect(formatReply("**  **")).toBe("");
  });

  it("strips *italic* markers", () => {
    expect(formatReply("That was *very* close, a *0.2 s* gap.")).toBe(
      "That was very close, a 0.2 s gap."
    );
  });

  it("does not treat underscores in ids, or arithmetic stars, as markup", () => {
    const text = "Race 2025_R13 (driver_id NOR): 2 * 3 stops, file f1__data.csv";
    expect(formatReply(text)).toBe(text);
  });

  it("removes # heading markers", () => {
    expect(formatReply("## Belgian GP pit stops\nThere were 40 stops.")).toBe(
      "Belgian GP pit stops\nThere were 40 stops."
    );
    expect(formatReply("# Summary #")).toBe("Summary");
  });

  it("turns [text](url) into text: url", () => {
    expect(
      formatReply("Download the [results CSV](https://example.test/export/results?format=csv).")
    ).toBe("Download the results CSV: https://example.test/export/results?format=csv.");
  });

  it("does not repeat a link whose text is the url", () => {
    expect(formatReply("[https://example.test/a](https://example.test/a)")).toBe(
      "https://example.test/a"
    );
  });

  it("turns a markdown table into - lines, keeping the header as a label", () => {
    const table = [
      "Fastest stops:",
      "",
      "| Driver | Lap | Time |",
      "|:-------|----:|------|",
      "| **NOR** | 18 | 21.9 s |",
      "| PIA | 19 | 22.4 s |",
      "",
      "That's all.",
    ].join("\n");

    expect(formatReply(table)).toBe(
      [
        "Fastest stops:",
        "",
        "Driver, Lap, Time:",
        "- NOR, 18, 21.9 s",
        "- PIA, 19, 22.4 s",
        "",
        "That's all.",
      ].join("\n")
    );
  });

  it("handles a table written without outer pipes", () => {
    expect(formatReply("Driver | Lap\n--- | ---\nNOR | 18")).toBe("Driver, Lap:\n- NOR, 18");
  });

  it("leaves pipes that are not part of a table alone", () => {
    expect(formatReply("Use the | key to separate values.")).toBe(
      "Use the | key to separate values."
    );
  });

  it("collapses runs of blank lines to one", () => {
    expect(formatReply("First.\n\n\n\nSecond.\n\n\nThird.")).toBe(
      "First.\n\nSecond.\n\nThird."
    );
  });

  it("keeps - lists and numbered lists, and turns * bullets into -", () => {
    expect(formatReply("- one\n- two\n1. first\n* three\n+ four")).toBe(
      "- one\n- two\n1. first\n- three\n- four"
    );
  });

  it("keeps bare URLs exactly as they are", () => {
    const url = "https://example.test/api/v1/export/results?format=csv&season=2025";
    expect(formatReply(`Here you go:\n${url}`)).toBe(`Here you go:\n${url}`);
  });

  it("trims trailing spaces and surrounding blank lines", () => {
    expect(formatReply("\n\nAnswer.   \n\n")).toBe("Answer.");
  });
});
