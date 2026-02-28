import { Column } from './column.js';
import { UpstreamHttpError } from './errors.js';
import { toMappedScanResult } from './mapper.js';
import { executeScan, DEFAULT_RANGE, resolveScanUrl } from './upstream.js';
import type {
  FilterOperationDict,
  OperationDict,
  QueryPayload,
  ScanRequestOptions,
  ScreenerDict,
  SortByDict,
} from './types.js';

export class Query {
  query: QueryPayload;
  url: string;

  constructor() {
    this.query = {
      markets: ['america'],
      symbols: { query: { types: [] }, tickers: [] },
      options: { lang: 'en' },
      columns: ['name', 'close', 'volume', 'market_cap_basic'],
      sort: { sortBy: 'Value.Traded', sortOrder: 'desc' },
      range: [...DEFAULT_RANGE],
    };
    this.url = resolveScanUrl(['america']);
  }

  select(...columns: Array<Column | string>): this {
    this.query.columns = columns.map((column) =>
      column instanceof Column ? column.name : new Column(column).name,
    );
    return this;
  }

  where(...expressions: FilterOperationDict[]): this {
    this.query.filter = [...expressions];
    return this;
  }

  whereAnd(...expressions: FilterOperationDict[]): this {
    return this.where(...expressions);
  }

  where2(operation: OperationDict): this {
    this.query.filter2 = operation.operation;
    return this;
  }

  order_by(column: Column | string, ascending = true, nulls_first = false): this {
    const sortBy: SortByDict = {
      sortBy: column instanceof Column ? column.name : column,
      sortOrder: ascending ? 'asc' : 'desc',
      nullsFirst: nulls_first,
    };

    this.query.sort = sortBy;
    return this;
  }

  orderBy(column: Column | string, ascending = true, nullsFirst = false): this {
    return this.order_by(column, ascending, nullsFirst);
  }

  limit(limit: number): this {
    const range = (this.query.range ?? [...DEFAULT_RANGE]) as number[];
    range[1] = limit;
    this.query.range = range;
    return this;
  }

  offset(offset: number): this {
    const range = (this.query.range ?? [...DEFAULT_RANGE]) as number[];
    range[0] = offset;
    this.query.range = range;
    return this;
  }

  set_markets(...markets: string[]): this {
    this.query.markets = [...markets];
    this.url = resolveScanUrl(markets);
    return this;
  }

  setMarkets(...markets: string[]): this {
    return this.set_markets(...markets);
  }

  set_tickers(...tickers: string[]): this {
    this.query.symbols = this.query.symbols ?? {};
    this.query.symbols.tickers = [...tickers];
    this.set_markets();
    return this;
  }

  setTickers(...tickers: string[]): this {
    return this.set_tickers(...tickers);
  }

  set_index(...indexes: string[]): this {
    if (!this.query.preset) {
      this.query.preset = 'index_components_market_pages';
    }
    this.query.symbols = this.query.symbols ?? {};
    this.query.symbols.symbolset = [...indexes];
    this.set_markets();
    return this;
  }

  setIndex(...indexes: string[]): this {
    return this.set_index(...indexes);
  }

  set_property(key: string, value: unknown): this {
    this.query[key] = value;
    return this;
  }

  setProperty(key: string, value: unknown): this {
    return this.set_property(key, value);
  }

  async get_scanner_data_raw(options: ScanRequestOptions = {}): Promise<ScreenerDict> {
    this.query.range = (this.query.range ?? [...DEFAULT_RANGE]) as number[];

    const result = await executeScan(this.query, {
      timeoutMs: options.timeoutMs,
      headers: options.headers,
      cookie: options.cookie,
      sessionid: options.sessionid,
      url: options.url ?? this.url,
      retries: options.retries,
    });

    if (result.status < 200 || result.status >= 300) {
      throw new UpstreamHttpError(result.status, result.body);
    }

    return result.body;
  }

  async getScannerDataRaw(options: ScanRequestOptions = {}): Promise<ScreenerDict> {
    return this.get_scanner_data_raw(options);
  }

  async get_scanner_data(options: ScanRequestOptions = {}): Promise<[number, Array<Record<string, unknown>>]> {
    const jsonObj = await this.get_scanner_data_raw(options);
    const rows = jsonObj.data ?? [];
    const columns = this.query.columns ?? [];
    const mapped = toMappedScanResult(jsonObj.totalCount, columns, rows);
    return [mapped.totalCount, mapped.mappedRows];
  }

  async getScannerData(options: ScanRequestOptions = {}): Promise<[number, Array<Record<string, unknown>>]> {
    return this.get_scanner_data(options);
  }

  copy(): Query {
    const cloned = new Query();
    cloned.query = { ...this.query };
    cloned.url = this.url;
    return cloned;
  }

  toPayload(): QueryPayload {
    return this.query;
  }

  toJSON(): QueryPayload {
    return this.query;
  }

  equals(other: unknown): boolean {
    return other instanceof Query && this.url === other.url && JSON.stringify(this.query) === JSON.stringify(other.query);
  }
}
