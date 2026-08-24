/**
 * One paginated result, so a page component does not need seven `let`
 * declarations and a matching seven assignments inside its try block.
 *
 * `filtersActive` rides along because it is decided while parsing the search
 * params -- the service already knows, and both attendance views need it to
 * choose between "no records yet" and "nothing matches this filter".
 */
export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  filtersActive: boolean;
}

/**
 * The value a page renders when the database is unreachable.
 *
 * page and totalPages are 1, not 0, so PaginationControls reads "Page 1 of 1"
 * rather than "Page 1 of 0".
 */
export function emptyPage<T>(): Page<T> {
  return {
    rows: [],
    total: 0,
    page: 1,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
    filtersActive: false,
  };
}
