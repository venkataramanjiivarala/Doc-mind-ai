/**
 * Splits text into overlapping chunks, breaking on paragraph/sentence
 * boundaries where possible so chunks stay semantically coherent.
 */
export function chunkText(
  text: string,
  chunkSize = 1000,
  overlap = 150
): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  if (cleaned.length <= chunkSize) {
    return cleaned.length > 0 ? [cleaned] : [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + chunkSize, cleaned.length);

    if (end < cleaned.length) {
      // Try to break at a paragraph, then sentence, then space.
      const slice = cleaned.slice(start, end);
      const lastBreak =
        slice.lastIndexOf("\n\n") > chunkSize * 0.5
          ? slice.lastIndexOf("\n\n")
          : slice.lastIndexOf(". ") > chunkSize * 0.5
          ? slice.lastIndexOf(". ") + 1
          : slice.lastIndexOf(" ");

      if (lastBreak > 0) {
        end = start + lastBreak;
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length > 0) chunks.push(chunk);

    if (end >= cleaned.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
