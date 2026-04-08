/**
 * Escape a CSV field value according to RFC 4180.
 * Fields containing commas, quotes, or newlines are wrapped in quotes.
 * Internal quotes are escaped by doubling them.
 */
export function escapeCsvField(value: string): string {
  // Check if escaping is needed (contains comma, quote, or newline)
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    // Escape internal quotes by doubling them
    const escaped = value.replace(/"/g, '""');
    // Wrap in quotes
    return `"${escaped}"`;
  }
  // No escaping needed
  return value;
}

/**
 * Convert an array of row data to a CSV line.
 */
export function csvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

/**
 * Sanitizes a string to be safe for use as a filename.
 * Replaces characters that are unsafe or problematic in filenames with hyphens.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, "-") // Replace filesystem-unsafe characters
    .replace(/\s+/g, "-") // Replace whitespace with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, "") // Remove leading/trailing hyphens
    .slice(0, 200); // Limit length for filesystem compatibility
}
