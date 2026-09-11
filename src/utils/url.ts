/**
 * Defensively extracts a plain http(s) URL from an API field.
 *
 * The real API returns plain URLs, but this guards against a value that
 * slipped through as Markdown link syntax (`[url](url)`) or otherwise isn't
 * a bare http(s) string — so a malformed value never reaches `<Image>` (RN
 * doesn't understand Markdown and would just show a broken image / crash
 * `<AudioPlayer>` on a bad stream url).
 */
export function normalizeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  // `[https://x](https://x)` -> `https://x`
  const markdownLink = trimmed.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  const candidate = markdownLink ? markdownLink[2] : trimmed;

  return /^https?:\/\//i.test(candidate) ? candidate : undefined;
}
