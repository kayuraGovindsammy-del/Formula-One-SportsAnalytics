import { describe, expect, it } from "vitest";
import { extractUrls, formatReply, removeUnknownUrls, trimUrl } from "./formatReply.js";

const LIST_URL =
  "https://example.test/api/v1/races/2025_R13/events?type=PIT_STOP&per_page=100";

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

  it("drops an ordinal suffix from a decimal average, but keeps real places", () => {
    expect(formatReply("His average finish was 2.77th, and he was 3rd at Spa.")).toBe(
      "His average finish was 2.77, and he was 3rd at Spa."
    );
    expect(formatReply("an average of 3.61st place")).toBe("an average of 3.61 place");
    expect(formatReply("He finished 1st and 22nd.")).toBe("He finished 1st and 22nd.");
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

  it("turns [text](url) into text: url, with the url on its own line", () => {
    expect(
      formatReply("Download the [results CSV](https://example.test/export/results?format=csv).")
    ).toBe("Download the results CSV:\nhttps://example.test/export/results?format=csv");
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

  it("moves a mid-sentence URL onto its own line and keeps the sentence readable", () => {
    expect(formatReply(`See the full list: ${LIST_URL}, or ask about a specific driver.`)).toBe(
      `See the full list:\n${LIST_URL}\nOr ask about a specific driver.`
    );
  });

  it("drops the full stop after a URL that ends a sentence", () => {
    expect(formatReply(`The full list is at ${LIST_URL}.`)).toBe(
      `The full list is at:\n${LIST_URL}`
    );
    expect(formatReply(`Here it is: ${LIST_URL}!`)).toBe(`Here it is:\n${LIST_URL}`);
  });

  it("strips each trailing punctuation mark that is not part of the URL", () => {
    expect(trimUrl("https://example.test/a,")).toBe("https://example.test/a");
    expect(trimUrl("https://example.test/a.")).toBe("https://example.test/a");
    expect(trimUrl("https://example.test/a;")).toBe("https://example.test/a");
    expect(trimUrl("https://example.test/a:")).toBe("https://example.test/a");
    expect(trimUrl("https://example.test/a)")).toBe("https://example.test/a");
    expect(trimUrl("https://example.test/a!")).toBe("https://example.test/a");
    expect(trimUrl("https://example.test/a).")).toBe("https://example.test/a");
  });

  it("keeps a closing parenthesis that belongs to the URL", () => {
    const url = "https://en.wikipedia.org/wiki/Circuit_de_Spa-Francorchamps_(track)";
    expect(trimUrl(`${url}.`)).toBe(url);
    expect(formatReply(`About the track: ${url}.`)).toBe(`About the track:\n${url}`);
  });

  it("splits two URLs in one line onto separate lines", () => {
    expect(
      formatReply("CSV: https://example.test/a.csv and JSON: https://example.test/a.json.")
    ).toBe("CSV:\nhttps://example.test/a.csv\nAnd JSON:\nhttps://example.test/a.json");
  });

  it("adds a colon when the text before a URL does not end a sentence", () => {
    expect(formatReply(`Download it from ${LIST_URL} to get every stop.`)).toBe(
      `Download it from:\n${LIST_URL}\nTo get every stop.`
    );
  });

  it("leaves a list item that is just a URL on its line", () => {
    expect(formatReply(`- ${LIST_URL}\n1. ${LIST_URL}`)).toBe(
      `- ${LIST_URL}\n1. ${LIST_URL}`
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

describe("removeUnknownUrls", () => {
  const REAL = "http://localhost:3001/api/v1/export/results?format=csv&season=2025";
  const FAKE = "https://example.com/driver_standings_2025.csv";
  const allowed = new Set([REAL]);
  // As the assistant uses it: formatReply first, then the guard.
  const guard = (text: string) => removeUnknownUrls(formatReply(text), allowed);

  it("removes a made-up URL and the label line it leaves empty", () => {
    expect(guard(`Verstappen has the most wins.\n\nDownload: ${FAKE}`)).toBe(
      "Verstappen has the most wins."
    );
  });

  it("removes a made-up URL from the middle of a sentence and keeps the rest", () => {
    expect(guard(`The table is at ${FAKE}, or ask me about a driver.`)).toBe(
      "Or ask me about a driver."
    );
  });

  it("keeps a URL that a tool returned", () => {
    expect(guard(`Here is the CSV: ${REAL}.`)).toBe(`Here is the CSV:\n${REAL}`);
  });

  it("leaves a reply with no URLs unchanged", () => {
    const plain = "Lando Norris has 394 points from Grand Prix races (sprints not included).";
    expect(guard(plain)).toBe(plain);
    expect(removeUnknownUrls(plain, new Set())).toBe(plain);
  });

  it("keeps the real URL and drops the made-up one when a reply has both", () => {
    expect(guard(`Results CSV: ${REAL}\nStandings: ${FAKE}`)).toBe(`Results CSV:\n${REAL}`);
  });

  it("keeps a label when at least one of the URLs it introduces is real", () => {
    expect(removeUnknownUrls(`Links:\n- ${FAKE}\n- ${REAL}`, allowed)).toBe(`Links:\n- ${REAL}`);
  });

  it("removes every URL when the tools returned none", () => {
    expect(removeUnknownUrls(`Full list:\n${REAL}\n\nAnything else?`, new Set())).toBe(
      "Anything else?"
    );
  });

  it("extracts the URLs a tool result contains, without trailing punctuation", () => {
    expect(
      extractUrls(JSON.stringify({ url: REAL, note: `see ${FAKE}.` }))
    ).toEqual([REAL, FAKE]);
  });
});
