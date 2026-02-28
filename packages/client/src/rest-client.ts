import { mapRows, Query } from '@tv-screener/core';
import type {
  MappedScanResult,
  MetainfoRequestPayload,
  MetainfoResponse,
  QueryPayload,
  ScanRequestOptions,
  ScreenerDict,
  SymbolSearchQuery,
  SymbolSearchResponse,
} from '@tv-screener/core';

export interface RestClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
}

export interface MetadataFieldsResponse {
  universe: string;
  generatedAt: string;
  version: string;
  fields: Array<{ name: string; displayName: string; type: string; variants: string[] }>;
}

export interface MetadataScreenersResponse {
  assetClass: string;
  market: string;
  generatedAt: string;
  version: string;
  presets: Array<{ name: string; queryCode: string }>;
}

export interface MetadataMarketsResponse {
  generatedAt: string;
  version: string;
  markets: string[];
}

export type SymbolSearchResponseBody = SymbolSearchResponse;
export type MetainfoResponseBody = MetainfoResponse;

async function parseJson<T>(response: Response): Promise<T> {
  const json = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(JSON.stringify(json));
  }
  return json;
}

export class TvScreenerRestClient {
  readonly baseUrl: string;
  readonly headers: Record<string, string>;

  constructor(options: RestClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.headers = { ...(options.headers ?? {}) };
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...this.headers,
      },
      body: JSON.stringify(body),
    });

    return parseJson<T>(response);
  }

  private async get<T>(path: string, headers: Record<string, string> = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        ...this.headers,
        ...headers,
      },
    });

    return parseJson<T>(response);
  }

  scanRaw(payload: QueryPayload, options: ScanRequestOptions = {}): Promise<ScreenerDict> {
    return this.post<ScreenerDict>('/api/v1/scan/raw', { payload, options });
  }

  async scan(payload: QueryPayload, options: ScanRequestOptions = {}): Promise<MappedScanResult> {
    const response = await this.post<MappedScanResult | ScreenerDict>('/api/v1/scan', { payload, options });

    if ('rawRows' in response) {
      return response;
    }

    return {
      totalCount: response.totalCount,
      columns: payload.columns ?? [],
      rawRows: response.data ?? [],
      mappedRows: mapRows(response.data ?? [], payload.columns ?? []),
    };
  }

  metadataFields(universe = 'stocks'): Promise<MetadataFieldsResponse> {
    return this.get<MetadataFieldsResponse>(`/api/v1/metadata/fields?universe=${encodeURIComponent(universe)}`);
  }

  metadataScreeners(assetClass = 'stocks', market = 'america'): Promise<MetadataScreenersResponse> {
    const query = new URLSearchParams({ assetClass, market });
    return this.get<MetadataScreenersResponse>(`/api/v1/metadata/screeners?${query.toString()}`);
  }

  metadataMarkets(): Promise<MetadataMarketsResponse> {
    return this.get<MetadataMarketsResponse>('/api/v1/metadata/markets');
  }

  symbolSearch(
    query: SymbolSearchQuery,
    options: ScanRequestOptions = {},
  ): Promise<SymbolSearchResponseBody> {
    const params = new URLSearchParams();
    const entries = Object.entries(query) as Array<[keyof SymbolSearchQuery, unknown]>;
    for (const [key, value] of entries) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      params.set(key, String(value));
    }

    const optionHeaders: Record<string, string> = {
      ...options.headers,
    };
    if (options.cookie) {
      optionHeaders['x-tv-cookie'] = options.cookie;
    }
    if (options.sessionid) {
      optionHeaders['x-tv-sessionid'] = options.sessionid;
    }
    if (options.timeoutMs !== undefined) {
      optionHeaders['x-tv-timeout-ms'] = String(options.timeoutMs);
    }
    if (options.retries !== undefined) {
      optionHeaders['x-tv-retries'] = String(options.retries);
    }

    return this.get<SymbolSearchResponseBody>(`/api/v1/symbol-search/v3?${params.toString()}`, optionHeaders);
  }

  metainfo(
    market: string,
    payload: MetainfoRequestPayload,
    options: ScanRequestOptions = {},
  ): Promise<MetainfoResponseBody> {
    return this.post<MetainfoResponseBody>(`/api/v1/metainfo/${encodeURIComponent(market)}`, {
      payload,
      options,
    });
  }
}

export class ApiQuery extends Query {
  async get_scanner_data_raw_via_api(
    client: TvScreenerRestClient,
    options: ScanRequestOptions = {},
  ): Promise<ScreenerDict> {
    return client.scanRaw(this.query, options);
  }

  async get_scanner_data_via_api(
    client: TvScreenerRestClient,
    options: ScanRequestOptions = {},
  ): Promise<[number, Array<Record<string, unknown>>]> {
    const response = await client.scan(this.query, options);
    return [response.totalCount, response.mappedRows];
  }
}
