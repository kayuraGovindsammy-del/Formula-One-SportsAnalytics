import type { ReactNode } from "react";

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/g;
const TRAILING_PUNCTUATION = /[,.;:!?)]$/;

function countChar(text: string, char: string): number {
  return text.split(char).length - 1;
}

/** Drops sentence punctuation after a URL; keeps a ")" that closes a "(" in it. */
function trimUrl(raw: string): string {
  let url = raw;
  while (TRAILING_PUNCTUATION.test(url)) {
    if (url.endsWith(")") && countChar(url, "(") >= countChar(url, ")")) break;
    url = url.slice(0, -1);
  }
  return url;
}

/**
 * Plain text with every http(s) URL turned into a link. Built from React
 * elements, never HTML, so a reply cannot inject markup. Line breaks are kept
 * by the container's `white-space: pre-wrap`.
 */
export function linkify(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const url = trimUrl(match[0]);
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    nodes.push(
      <a key={`${match.index}-${url}`} href={url} target="_blank" rel="noopener noreferrer">
        {url}
      </a>
    );
    cursor = match.index + url.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
