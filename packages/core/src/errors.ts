import type { ScreenerDict } from './types.js';

export class UpstreamHttpError extends Error {
  readonly status: number;
  readonly body: ScreenerDict;

  constructor(status: number, body: ScreenerDict) {
    super(body.error ?? `TradingView upstream request failed with status ${status}`);
    this.name = 'UpstreamHttpError';
    this.status = status;
    this.body = body;
  }
}
