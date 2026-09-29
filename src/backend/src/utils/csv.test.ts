import { describe, expect, it } from "vitest";
import { escapeCsvField, toCsv } from "./csv.js";

describe("escapeCsvField", () => {
  it("leaves a plain value unquoted", () => {
    expect(escapeCsvField("Monaco")).toBe("Monaco");
  });

  it("quotes a value containing a comma", () => {
    expect(escapeCsvField("Spa, Belgium")).toBe('"Spa, Belgium"');
  });

  it("quotes a value containing a quote and doubles the quote", () => {
    expect(escapeCsvField('The "Temple" of Speed')).toBe(
      '"The ""Temple"" of Speed"'
    );
  });

  it("quotes a value containing a newline or carriage return", () => {
    expect(escapeCsvField("line one\nline two")).toBe('"line one\nline two"');
    expect(escapeCsvField("line one\r\nline two")).toBe(
      '"line one\r\nline two"'
    );
  });

  it("writes null and undefined as an empty field", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });

  it("writes numbers and booleans as their literal text", () => {
    expect(escapeCsvField(0)).toBe("0");
    expect(escapeCsvField(12.5)).toBe("12.5");
    expect(escapeCsvField(true)).toBe("true");
    expect(escapeCsvField(false)).toBe("false");
  });

  it("does not treat an empty string as null", () => {
    expect(escapeCsvField("")).toBe("");
  });
});

describe("toCsv", () => {
  interface Row {
    id: string;
    name: string | null;
    laps: number;
  }

  it("writes a header row then one CRLF-terminated record per row", () => {
    const rows: Row[] = [
      { id: "A", name: "Alpha", laps: 1 },
      { id: "B", name: null, laps: 2 },
    ];

    expect(toCsv<Row>(["id", "name", "laps"], rows)).toBe(
      "id,name,laps\r\nA,Alpha,1\r\nB,,2\r\n"
    );
  });

  it("orders fields by the columns given, not by the row's own key order", () => {
    const rows: Row[] = [{ id: "A", name: "Alpha", laps: 1 }];

    expect(toCsv<Row>(["laps", "id"], rows)).toBe("laps,id\r\n1,A\r\n");
  });

  it("still writes the header for an empty result", () => {
    expect(toCsv<Row>(["id", "name", "laps"], [])).toBe("id,name,laps\r\n");
  });

  it("escapes a value containing both a comma and a quote", () => {
    const rows: Row[] = [{ id: "A", name: 'Says "hi", then leaves', laps: 1 }];

    expect(toCsv<Row>(["id", "name"], rows)).toBe(
      'id,name\r\nA,"Says ""hi"", then leaves"\r\n'
    );
  });
});
