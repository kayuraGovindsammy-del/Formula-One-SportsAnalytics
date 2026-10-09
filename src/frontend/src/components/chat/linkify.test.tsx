import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";

import { linkify } from "./linkify";

function renderText(text: string) {
  return render(<p data-testid="text">{linkify(text)}</p>);
}

describe("linkify", () => {
  test("leaves text without URLs as plain text", () => {
    renderText("Lando Norris won the 2025 Belgian GP.");

    expect(screen.getByTestId("text")).toHaveTextContent("Lando Norris won the 2025 Belgian GP.");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  test("turns a bare URL into a link that opens safely in a new tab", () => {
    renderText("See https://example.test/races?type=PIT_STOP for more");

    const link = screen.getByRole("link", { name: "https://example.test/races?type=PIT_STOP" });
    expect(link).toHaveAttribute("href", "https://example.test/races?type=PIT_STOP");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByTestId("text")).toHaveTextContent(
      "See https://example.test/races?type=PIT_STOP for more"
    );
  });

  test("keeps sentence punctuation after a URL out of the link", () => {
    renderText("Full list: https://example.test/a, or https://example.test/b.");

    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "https://example.test/a",
      "https://example.test/b",
    ]);
    expect(screen.getByTestId("text").textContent).toBe(
      "Full list: https://example.test/a, or https://example.test/b."
    );
  });

  test("keeps a closing parenthesis that belongs to the URL", () => {
    const url = "https://en.wikipedia.org/wiki/Spa-Francorchamps_(circuit)";
    renderText(`Track: ${url}.`);

    expect(screen.getByRole("link")).toHaveAttribute("href", url);
  });

  test("only links http and https URLs", () => {
    renderText("javascript:alert(1) and ftp://example.test/file");

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  test("renders markup in the text as text, not HTML", () => {
    renderText('<img src=x onerror="alert(1)"> https://example.test');

    expect(screen.getByTestId("text").querySelector("img")).toBeNull();
    expect(screen.getByTestId("text")).toHaveTextContent('<img src=x onerror="alert(1)">');
  });
});
