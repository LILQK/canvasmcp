export function stripHtml(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createSnippet(text: string | null | undefined, query: string, radius = 120): string | null {
  if (!text) {
    return null;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    return text.slice(0, Math.min(text.length, radius * 2)).trim() || null;
  }

  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + lowerQuery.length + radius);
  return text.slice(start, end).trim();
}
