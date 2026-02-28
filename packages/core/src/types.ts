export type FilterOperationName =
  | 'greater'
  | 'egreater'
  | 'less'
  | 'eless'
  | 'equal'
  | 'nequal'
  | 'in_range'
  | 'not_in_range'
  | 'empty'
  | 'nempty'
  | 'crosses'
  | 'crosses_above'
  | 'crosses_below'
  | 'match'
  | 'nmatch'
  | 'smatch'
  | 'has'
  | 'has_none_of'
  | 'above%'
  | 'below%'
  | 'in_range%'
  | 'not_in_range%'
  | 'in_day_range'
  | 'in_week_range'
  | 'in_month_range';

export const SUPPORTED_OPERATION_TOKENS = [
  'greater',
  'egreater',
  'less',
  'eless',
  'equal',
  'nequal',
  'in_range',
  'not_in_range',
  'empty',
  'nempty',
  'crosses',
  'crosses_above',
  'crosses_below',
  'match',
  'nmatch',
  'smatch',
  'has',
  'has_none_of',
  'above%',
  'below%',
  'in_range%',
  'not_in_range%',
  'in_day_range',
  'in_week_range',
  'in_month_range',
] as const satisfies readonly FilterOperationName[];

export interface FilterOperationDict {
  left: string;
  operation: FilterOperationName;
  right: unknown;
}

export interface SortByDict {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  nullsFirst?: boolean;
}

export interface SymbolsDict {
  query?: { types: string[] };
  tickers?: string[];
  symbolset?: string[];
  watchlist?: { id: number };
  groups?: Array<{ type: string; values: string[] }>;
}

export interface ExpressionDict {
  expression: FilterOperationDict;
}

export interface OperationComparisonDict {
  operator: 'and' | 'or';
  operands: Array<OperationDict | ExpressionDict>;
}

export interface OperationDict {
  operation: OperationComparisonDict;
}

export interface QueryPayload {
  markets?: string[];
  symbols?: SymbolsDict;
  options?: Record<string, unknown>;
  columns?: string[];
  filter?: FilterOperationDict[];
  filter2?: OperationComparisonDict;
  sort?: SortByDict;
  range?: [number, number] | number[];
  ignore_unknown_fields?: boolean;
  preset?: string;
  price_conversion?: { to_symbol: boolean } | { to_currency: string };
  [key: string]: unknown;
}

export interface ScreenerRowDict {
  s: string;
  d: unknown[];
}

export interface ScreenerDict {
  totalCount: number;
  data: ScreenerRowDict[] | null;
  error?: string;
}

export interface SymbolSearchQuery {
  text: string;
  hl?: 0 | 1 | number;
  country?: string;
  search_type?: string;
  lang?: string;
  exchange?: string;
  domain?: string;
  sort_by_country?: string;
}

export interface SymbolSearchSymbol {
  symbol?: string;
  description?: string;
  type?: string;
  exchange?: string;
  country?: string;
  [key: string]: unknown;
}

export interface SymbolSearchResponse {
  symbols_remaining?: number;
  symbols: SymbolSearchSymbol[];
  [key: string]: unknown;
}

export interface MetainfoRequestPayload {
  columns?: string[];
  markets?: string[];
  [key: string]: unknown;
}

export interface MetainfoField {
  n: string;
  t: string;
  r?: unknown[];
  [key: string]: unknown;
}

export interface MetainfoResponse {
  financial_currency?: string;
  fields?: MetainfoField[];
  [key: string]: unknown;
}

export interface ScanRequestOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  cookie?: string;
  sessionid?: string;
  url?: string;
  retries?: number;
}

export interface ScanExecutionResult {
  status: number;
  body: ScreenerDict;
  upstreamUrl: string;
  durationMs: number;
}

export interface SymbolSearchExecutionResult {
  status: number;
  body: SymbolSearchResponse;
  upstreamUrl: string;
  durationMs: number;
}

export interface MetainfoExecutionResult {
  status: number;
  body: MetainfoResponse;
  upstreamUrl: string;
  durationMs: number;
}

export interface MappedScanResult {
  totalCount: number;
  columns: string[];
  rawRows: ScreenerRowDict[];
  mappedRows: Array<Record<string, unknown>>;
}
