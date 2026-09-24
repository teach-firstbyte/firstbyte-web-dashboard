/**
 * CSV serialization per RFC 4180. Pure: no DOM, no Blob, and deliberately no
 * BOM -- that is a property of the file we hand the OS, not of the document,
 * and folding it in here would make this function's output not-quite-a-CSV for
 * any future caller.
 */

// s2.6: a field containing a comma, a double quote, CR or LF must be quoted.
// Anything else may be but needn't, and quoting only what must be quoted keeps
// the common case readable when someone opens the file in a text editor.
const MUST_QUOTE = /[",\r\n]/;

/** Escapes one field. An internal double quote is doubled (s2.7). */
function escapeField(value: string): string {
  return MUST_QUOTE.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Joins rows with CRLF (s2.1), including after the final record -- every
 * spreadsheet ignores the trailing terminator, and its absence trips
 * line-oriented shell tooling.
 */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<string>>): string {
  return (
    rows.map((row) => row.map(escapeField).join(",")).join("\r\n") + "\r\n"
  );
}
