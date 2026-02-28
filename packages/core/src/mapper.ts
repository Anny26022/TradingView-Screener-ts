import type { MappedScanResult, ScreenerRowDict } from './types.js';

export function mapRows(rows: ScreenerRowDict[], columns: string[]): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const mapped: Record<string, unknown> = { ticker: row.s };
    for (const [index, column] of columns.entries()) {
      mapped[column] = row.d[index];
    }
    return mapped;
  });
}

export function toMappedScanResult(
  totalCount: number,
  columns: string[],
  rows: ScreenerRowDict[],
): MappedScanResult {
  return {
    totalCount,
    columns,
    rawRows: rows,
    mappedRows: mapRows(rows, columns),
  };
}
