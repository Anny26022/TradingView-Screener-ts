import { describe, expect, it } from 'vitest';
import { executeScan } from '../src/upstream.js';

const runLive = process.env.LIVE_TV === '1';
const maybeIt = runLive ? it : it.skip;

describe('Live TradingView contract tests', () => {
  maybeIt('returns data for a valid scan', async () => {
    const result = await executeScan({
      markets: ['america'],
      columns: ['name', 'close'],
      range: [0, 3],
    });

    expect(result.status).toBe(200);
    expect(result.body.totalCount).toBeGreaterThan(0);
    expect(Array.isArray(result.body.data)).toBe(true);
  });

  maybeIt('mirrors invalid range error behavior', async () => {
    const result = await executeScan({
      markets: ['america'],
      columns: ['close'],
      range: [0, -5],
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/invalid range/i);
  });

  maybeIt('mirrors unknown field behavior', async () => {
    const result = await executeScan({
      markets: ['america'],
      columns: ['__BAD_FIELD__'],
      range: [0, 3],
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/Unknown field/i);
  });

  maybeIt('preserves ignore_unknown_fields passthrough', async () => {
    const result = await executeScan({
      markets: ['america'],
      ignore_unknown_fields: true,
      columns: ['name', '__BAD_FIELD__'],
      range: [0, 3],
    });

    expect(result.status).toBe(200);
    expect(Array.isArray(result.body.data)).toBe(true);
  });
});
