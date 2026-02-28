import { describe, expect, it } from 'vitest';
import { createServer } from '../src/server.js';

async function withServer<T>(fn: (server: Awaited<ReturnType<typeof createServer>>) => Promise<T>) {
  const server = await createServer({
    executor: async () => ({
      status: 200,
      body: {
        totalCount: 2,
        data: [
          { s: 'NASDAQ:NVDA', d: ['NVDA', 177.19] },
          { s: 'AMEX:SPY', d: ['SPY', 685.99] },
        ],
      },
      upstreamUrl: 'https://scanner.tradingview.com/america/scan',
      durationMs: 10,
    }),
  });

  try {
    return await fn(server);
  } finally {
    await server.close();
  }
}

describe('API scan routes', () => {
  it('returns raw upstream body with status passthrough', async () => {
    await withServer(async (server) => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/scan/raw',
        payload: {
          payload: {
            markets: ['america'],
            columns: ['name', 'close'],
            range: [0, 2],
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        totalCount: 2,
        data: [
          { s: 'NASDAQ:NVDA', d: ['NVDA', 177.19] },
          { s: 'AMEX:SPY', d: ['SPY', 685.99] },
        ],
      });
    });
  });

  it('returns mapped structured rows', async () => {
    await withServer(async (server) => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/scan',
        payload: {
          payload: {
            markets: ['america'],
            columns: ['name', 'close'],
            range: [0, 2],
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        totalCount: 2,
        columns: ['name', 'close'],
        rawRows: [
          { s: 'NASDAQ:NVDA', d: ['NVDA', 177.19] },
          { s: 'AMEX:SPY', d: ['SPY', 685.99] },
        ],
        mappedRows: [
          { ticker: 'NASDAQ:NVDA', name: 'NVDA', close: 177.19 },
          { ticker: 'AMEX:SPY', name: 'SPY', close: 685.99 },
        ],
      });
    });
  });

  it('rejects range windows above configured limit', async () => {
    await withServer(async (server) => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/scan',
        payload: {
          markets: ['america'],
          columns: ['close'],
          range: [0, 100_001],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toMatch(/exceeds max allowed window/i);
    });
  });
});

describe('API metadata routes', () => {
  it('returns markets snapshot', async () => {
    const server = await createServer();
    const response = await server.inject({ method: 'GET', url: '/api/v1/metadata/markets' });
    expect(response.statusCode).toBe(200);
    expect(response.json().markets.length).toBeGreaterThan(0);
    await server.close();
  });

  it('returns fields for stocks', async () => {
    const server = await createServer();
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/metadata/fields?universe=stocks',
    });

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json().fields)).toBe(true);
    await server.close();
  });

  it('accepts universe aliases and typos for requested categories', async () => {
    const server = await createServer();
    const economy = await server.inject({
      method: 'GET',
      url: '/api/v1/metadata/fields?universe=economy',
    });
    const opton = await server.inject({
      method: 'GET',
      url: '/api/v1/metadata/fields?universe=opton',
    });
    const cypto = await server.inject({
      method: 'GET',
      url: '/api/v1/metadata/fields?universe=cypto',
    });

    expect(economy.statusCode).toBe(200);
    expect(economy.json().universe).toBe('economics2');
    expect(opton.statusCode).toBe(200);
    expect(opton.json().universe).toBe('options');
    expect(cypto.statusCode).toBe(200);
    expect(cypto.json().universe).toBe('crypto');
    await server.close();
  });
});

describe('API symbol search and metainfo routes', () => {
  it('proxies symbol search v3 query params and returns upstream status/body', async () => {
    const server = await createServer({
      symbolSearchExecutor: async (query) => ({
        status: 200,
        body: {
          symbols_remaining: 0,
          symbols: [
            {
              symbol: query.text.toUpperCase(),
              type: query.search_type ?? 'stock',
              country: query.country ?? 'US',
            },
          ],
        },
        upstreamUrl: 'https://symbol-search.tradingview.com/symbol_search/v3/?text=nvda',
        durationMs: 9,
      }),
    });

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/symbol-search/v3?text=nvda&search_type=stocks&country=US',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().symbols[0].symbol).toBe('NVDA');
    await server.close();
  });

  it('proxies scanner metainfo for the requested market', async () => {
    const server = await createServer({
      metainfoExecutor: async (market, payload) => ({
        status: 200,
        body: {
          financial_currency: market === 'india' ? 'INR' : 'USD',
          fields: (payload.columns ?? []).map((name) => ({ n: name, t: 'text', r: [] })),
        },
        upstreamUrl: `https://scanner.tradingview.com/${market}/metainfo`,
        durationMs: 11,
      }),
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/metainfo/india',
      payload: {
        payload: {
          columns: ['sector', 'industry'],
          markets: ['india'],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().financial_currency).toBe('INR');
    expect(response.json().fields).toHaveLength(2);
    await server.close();
  });
});
