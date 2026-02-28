import type {
  MetainfoExecutionResult,
  MetainfoRequestPayload,
  MetainfoResponse,
  QueryPayload,
  ScanExecutionResult,
  ScanRequestOptions,
  ScreenerDict,
  SymbolSearchExecutionResult,
  SymbolSearchQuery,
  SymbolSearchResponse,
} from './types.js';

export const DEFAULT_RANGE: [number, number] = [0, 50];
export const URL_TEMPLATE = 'https://scanner.tradingview.com/{market}/scan';
export const METAINFO_URL_TEMPLATE = 'https://scanner.tradingview.com/{market}/metainfo';
export const SYMBOL_SEARCH_URL = 'https://symbol-search.tradingview.com/symbol_search/v3/';
export const DEFAULT_TIMEOUT_MS = 20_000;

export const DEFAULT_HEADERS: Record<string, string> = {
  authority: 'scanner.tradingview.com',
  'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="98", "Google Chrome";v="98"',
  accept: 'text/plain, */*; q=0.01',
  'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'sec-ch-ua-mobile': '?0',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
  'sec-ch-ua-platform': '"Windows"',
  origin: 'https://www.tradingview.com',
  'sec-fetch-site': 'same-site',
  'sec-fetch-mode': 'cors',
  'sec-fetch-dest': 'empty',
  referer: 'https://www.tradingview.com/',
  'accept-language': 'en-US,en;q=0.9,it;q=0.8',
};

export const DEFAULT_SYMBOL_SEARCH_HEADERS: Record<string, string> = {
  ...DEFAULT_HEADERS,
  authority: 'symbol-search.tradingview.com',
  accept: 'application/json, text/plain, */*',
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildCookieHeader(cookie?: string, sessionid?: string): string | undefined {
  if (cookie && cookie.trim().length > 0) {
    if (!sessionid || cookie.includes('sessionid=')) {
      return cookie;
    }
    return `${cookie}; sessionid=${sessionid}`;
  }

  if (sessionid && sessionid.trim().length > 0) {
    return `sessionid=${sessionid}`;
  }

  return undefined;
}

export function resolveScanUrl(markets: string[] = []): string {
  if (markets.length === 1) {
    return URL_TEMPLATE.replace('{market}', markets[0]);
  }

  return URL_TEMPLATE.replace('{market}', 'global');
}

export function resolveMetainfoUrl(market: string): string {
  return METAINFO_URL_TEMPLATE.replace('{market}', market);
}

export function resolveSymbolSearchUrl(query: SymbolSearchQuery, url = SYMBOL_SEARCH_URL): string {
  const normalized = new URL(url);
  const params = normalized.searchParams;
  const entries = Object.entries(query) as Array<[keyof SymbolSearchQuery, unknown]>;
  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    params.set(key, String(value));
  }
  return normalized.toString();
}

function normalizeScreenerBody(body: unknown): ScreenerDict {
  if (typeof body === 'object' && body !== null) {
    const candidate = body as Partial<ScreenerDict>;
    return {
      totalCount: typeof candidate.totalCount === 'number' ? candidate.totalCount : 0,
      data: Array.isArray(candidate.data) ? candidate.data : null,
      error: typeof candidate.error === 'string' ? candidate.error : undefined,
    };
  }

  return { totalCount: 0, data: null, error: 'Invalid JSON response from TradingView upstream' };
}

function normalizeSymbolSearchBody(body: unknown): SymbolSearchResponse {
  if (typeof body !== 'object' || body === null) {
    return {
      symbols: [],
      error: 'Invalid JSON response from TradingView upstream',
    };
  }

  const candidate = body as Record<string, unknown>;
  return {
    ...candidate,
    symbols_remaining:
      typeof candidate.symbols_remaining === 'number' ? candidate.symbols_remaining : undefined,
    symbols: Array.isArray(candidate.symbols) ? candidate.symbols : [],
  };
}

function normalizeMetainfoBody(body: unknown): MetainfoResponse {
  if (typeof body === 'object' && body !== null) {
    return body as MetainfoResponse;
  }

  return { error: 'Invalid JSON response from TradingView upstream' };
}

interface JsonRequestResult {
  status: number;
  parsed: unknown;
  durationMs: number;
}

async function requestJson(
  upstreamUrl: string,
  method: 'GET' | 'POST',
  headers: Record<string, string>,
  options: ScanRequestOptions,
  body?: unknown,
): Promise<JsonRequestResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? 1;
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    const startedAt = Date.now();

    try {
      const response = await fetch(upstreamUrl, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      let parsed: unknown;
      try {
        parsed = await response.json();
      } catch {
        parsed = {
          error: `Upstream returned non-JSON body with status ${response.status}`,
        };
      }

      if (response.status >= 500 && attempt < retries) {
        attempt += 1;
        await sleep(100 * attempt);
        continue;
      }

      return {
        status: response.status,
        parsed,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      lastError = error;
      if (attempt >= retries) {
        break;
      }

      attempt += 1;
      await sleep(100 * attempt);
    }
  }

  const errMessage = lastError instanceof Error ? lastError.message : 'Unknown upstream error';
  return {
    status: 503,
    parsed: { error: errMessage },
    durationMs: 0,
  };
}

export async function executeScan(
  payload: QueryPayload,
  options: ScanRequestOptions = {},
): Promise<ScanExecutionResult> {
  const upstreamUrl = options.url ?? resolveScanUrl(payload.markets ?? []);

  const cookieHeader = buildCookieHeader(options.cookie, options.sessionid);
  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    'content-type': 'application/json',
    ...options.headers,
  };

  if (cookieHeader) {
    headers.cookie = cookieHeader;
  }

  const result = await requestJson(upstreamUrl, 'POST', headers, options, payload);
  return {
    status: result.status,
    body: normalizeScreenerBody(result.parsed),
    upstreamUrl,
    durationMs: result.durationMs,
  };
}

export async function executeSymbolSearch(
  query: SymbolSearchQuery,
  options: ScanRequestOptions = {},
): Promise<SymbolSearchExecutionResult> {
  const upstreamUrl = resolveSymbolSearchUrl(query, options.url ?? SYMBOL_SEARCH_URL);
  const cookieHeader = buildCookieHeader(options.cookie, options.sessionid);
  const headers: Record<string, string> = {
    ...DEFAULT_SYMBOL_SEARCH_HEADERS,
    ...options.headers,
  };
  if (cookieHeader) {
    headers.cookie = cookieHeader;
  }
  const result = await requestJson(upstreamUrl, 'GET', headers, options);
  return {
    status: result.status,
    body: normalizeSymbolSearchBody(result.parsed),
    upstreamUrl,
    durationMs: result.durationMs,
  };
}

export async function executeMetainfo(
  market: string,
  payload: MetainfoRequestPayload,
  options: ScanRequestOptions = {},
): Promise<MetainfoExecutionResult> {
  const upstreamUrl = options.url ?? resolveMetainfoUrl(market);
  const cookieHeader = buildCookieHeader(options.cookie, options.sessionid);
  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    'content-type': 'application/json',
    ...options.headers,
  };
  if (cookieHeader) {
    headers.cookie = cookieHeader;
  }
  const result = await requestJson(upstreamUrl, 'POST', headers, options, payload);
  return {
    status: result.status,
    body: normalizeMetainfoBody(result.parsed),
    upstreamUrl,
    durationMs: result.durationMs,
  };
}
