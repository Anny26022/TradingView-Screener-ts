import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiQuery, TvScreenerRestClient } from '../src/rest-client.js';

describe('TvScreenerRestClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls structured scan endpoint and returns mapped response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          totalCount: 1,
          columns: ['name', 'close'],
          rawRows: [{ s: 'NASDAQ:NVDA', d: ['NVDA', 177.19] }],
          mappedRows: [{ ticker: 'NASDAQ:NVDA', name: 'NVDA', close: 177.19 }],
        }),
      }),
    );

    const client = new TvScreenerRestClient({ baseUrl: 'http://localhost:3000' });
    const response = await client.scan({ markets: ['america'], columns: ['name', 'close'], range: [0, 1] });

    expect(response.totalCount).toBe(1);
    expect(response.mappedRows[0].ticker).toBe('NASDAQ:NVDA');
  });

  it('ApiQuery delegates to REST client', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          totalCount: 2,
          columns: ['name'],
          rawRows: [
            { s: 'NASDAQ:NVDA', d: ['NVDA'] },
            { s: 'AMEX:SPY', d: ['SPY'] },
          ],
          mappedRows: [
            { ticker: 'NASDAQ:NVDA', name: 'NVDA' },
            { ticker: 'AMEX:SPY', name: 'SPY' },
          ],
        }),
      }),
    );

    const client = new TvScreenerRestClient({ baseUrl: 'http://localhost:3000' });
    const query = new ApiQuery().select('name').limit(2);
    const [count, rows] = await query.get_scanner_data_via_api(client);

    expect(count).toBe(2);
    expect(rows).toHaveLength(2);
  });

  it('calls symbol search endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          symbols_remaining: 0,
          symbols: [{ symbol: 'RELIANCE', exchange: 'NSE', country: 'IN' }],
        }),
      }),
    );

    const client = new TvScreenerRestClient({ baseUrl: 'http://localhost:3000' });
    const response = await client.symbolSearch({ text: 'reliance', country: 'IN', search_type: 'stocks' });

    expect(response.symbols[0].symbol).toBe('RELIANCE');
  });

  it('calls metainfo endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          financial_currency: 'USD',
          fields: [{ n: 'sector', t: 'text', r: ['Technology Services'] }],
        }),
      }),
    );

    const client = new TvScreenerRestClient({ baseUrl: 'http://localhost:3000' });
    const response = await client.metainfo('america', { columns: ['sector'], markets: ['america'] });

    expect(response.financial_currency).toBe('USD');
  });
});
