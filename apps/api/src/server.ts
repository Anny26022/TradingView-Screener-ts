import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { executeMetainfo, executeScan, executeSymbolSearch, toMappedScanResult } from '@tv-screener/core';
import type {
  MetainfoExecutionResult,
  MetainfoRequestPayload,
  QueryPayload,
  ScanExecutionResult,
  ScanRequestOptions,
  SymbolSearchExecutionResult,
  SymbolSearchQuery,
} from '@tv-screener/core';
import { loadFieldsSnapshot, loadMarketsSnapshot, loadScreenersSnapshot } from './metadata-store.js';

const MAX_RANGE_WINDOW = 100_000;
const TAGS = ['scan', 'metadata', 'search', 'metainfo'] as const;
const FIELD_UNIVERSE_ALIASES: Record<string, string> = {
  stock: 'stocks',
  stocks: 'stocks',
  crypto: 'crypto',
  cypto: 'crypto',
  forex: 'forex',
  coin: 'coin',
  cfd: 'cfd',
  futures: 'futures',
  bonds: 'bonds',
  bond: 'bond',
  economy: 'economics2',
  economics: 'economics2',
  economics2: 'economics2',
  option: 'options',
  opton: 'options',
  options: 'options',
};

const screenerRowSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['s', 'd'],
  properties: {
    s: { type: 'string' },
    d: { type: 'array', items: {} },
  },
} as const;

const scanRawResponseSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['totalCount', 'data'],
  properties: {
    totalCount: { type: 'number' },
    data: { type: ['array', 'null'], items: screenerRowSchema },
    error: { type: 'string' },
  },
} as const;

const mappedScanResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['totalCount', 'columns', 'rawRows', 'mappedRows'],
  properties: {
    totalCount: { type: 'number' },
    columns: { type: 'array', items: { type: 'string' } },
    rawRows: { type: 'array', items: screenerRowSchema },
    mappedRows: { type: 'array', items: { type: 'object', additionalProperties: true } },
  },
} as const;

const scanRequestSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    payload: { type: 'object', additionalProperties: true },
    options: { type: 'object', additionalProperties: true },
    requestOptions: { type: 'object', additionalProperties: true },
  },
} as const;

const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: { type: 'string' },
  },
} as const;

interface ScanBody {
  payload?: QueryPayload;
  options?: ScanRequestOptions;
  requestOptions?: ScanRequestOptions;
  [key: string]: unknown;
}

interface PayloadBody<TPayload> {
  payload?: TPayload;
  options?: ScanRequestOptions;
  requestOptions?: ScanRequestOptions;
  [key: string]: unknown;
}

interface ServerDeps {
  executor?: (payload: QueryPayload, options?: ScanRequestOptions) => Promise<ScanExecutionResult>;
  symbolSearchExecutor?: (
    query: SymbolSearchQuery,
    options?: ScanRequestOptions,
  ) => Promise<SymbolSearchExecutionResult>;
  metainfoExecutor?: (
    market: string,
    payload: MetainfoRequestPayload,
    options?: ScanRequestOptions,
  ) => Promise<MetainfoExecutionResult>;
}

function normalizeScanBody(body: ScanBody): { payload: QueryPayload; options: ScanRequestOptions } {
  const hasPayload = typeof body.payload === 'object' && body.payload !== null;
  if (hasPayload) {
    return {
      payload: body.payload as QueryPayload,
      options: body.options ?? body.requestOptions ?? {},
    };
  }

  const cloned = { ...body };
  const options = (cloned.options as ScanRequestOptions | undefined) ??
    (cloned.requestOptions as ScanRequestOptions | undefined) ??
    {};

  delete cloned.options;
  delete cloned.requestOptions;
  return { payload: cloned as QueryPayload, options };
}

function validateRangeWindow(payload: QueryPayload): string | null {
  const range = payload.range;
  if (!Array.isArray(range) || range.length < 2) {
    return null;
  }

  const start = Number(range[0]);
  const end = Number(range[1]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 'range must contain finite numeric values';
  }

  if (end - start > MAX_RANGE_WINDOW) {
    return `Requested range window (${end - start}) exceeds max allowed window (${MAX_RANGE_WINDOW})`;
  }

  return null;
}

function normalizeUniverse(input?: string): string {
  const normalized = (input ?? 'stocks').trim().toLowerCase();
  return FIELD_UNIVERSE_ALIASES[normalized] ?? normalized;
}

function normalizePayloadBody<TPayload extends Record<string, unknown>>(
  body: PayloadBody<TPayload>,
): { payload: TPayload; options: ScanRequestOptions } {
  const hasPayload = typeof body.payload === 'object' && body.payload !== null;
  if (hasPayload) {
    return {
      payload: body.payload as TPayload,
      options: body.options ?? body.requestOptions ?? {},
    };
  }

  const cloned = { ...body };
  const options = (cloned.options as ScanRequestOptions | undefined) ??
    (cloned.requestOptions as ScanRequestOptions | undefined) ??
    {};

  delete cloned.options;
  delete cloned.requestOptions;
  return { payload: cloned as TPayload, options };
}

function firstHeaderValue(input: string | string[] | undefined): string | undefined {
  if (Array.isArray(input)) {
    return input[0];
  }
  return input;
}

function getRequestOptionsFromHeaders(headers: Record<string, string | string[] | undefined>): ScanRequestOptions {
  const cookie = firstHeaderValue(headers['x-tv-cookie']);
  const sessionid = firstHeaderValue(headers['x-tv-sessionid']);
  const timeoutHeader = firstHeaderValue(headers['x-tv-timeout-ms']);
  const retriesHeader = firstHeaderValue(headers['x-tv-retries']);
  const timeoutMs = timeoutHeader ? Number(timeoutHeader) : undefined;
  const retries = retriesHeader ? Number(retriesHeader) : undefined;

  return {
    cookie,
    sessionid,
    timeoutMs: timeoutMs !== undefined && Number.isFinite(timeoutMs) ? timeoutMs : undefined,
    retries: retries !== undefined && Number.isFinite(retries) ? retries : undefined,
  };
}

export async function createServer(deps: ServerDeps = {}) {
  const app = Fastify({ logger: true });
  const executor = deps.executor ?? executeScan;
  const symbolSearchExecutor = deps.symbolSearchExecutor ?? executeSymbolSearch;
  const metainfoExecutor = deps.metainfoExecutor ?? executeMetainfo;

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'TradingView Screener REST API',
        description: 'TradingView-style scanner API with TypeScript-oriented structured responses',
        version: '0.1.0',
      },
      tags: [
        { name: TAGS[0], description: 'TradingView scan-compatible endpoints' },
        { name: TAGS[1], description: 'Metadata snapshots (fields, presets, markets)' },
        { name: TAGS[2], description: 'TradingView symbol search v3 endpoint proxy' },
        { name: TAGS[3], description: 'TradingView scanner metainfo endpoint proxy' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  app.get(
    '/healthz',
    {
      schema: {
        tags: [TAGS[1]],
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['ok'],
            properties: { ok: { type: 'boolean' } },
          },
        },
      },
    },
    async () => ({ ok: true }),
  );

  app.post<{ Body: ScanBody }>(
    '/api/v1/scan/raw',
    {
      schema: {
        tags: [TAGS[0]],
        body: scanRequestSchema,
        response: {
          200: scanRawResponseSchema,
          400: scanRawResponseSchema,
          500: scanRawResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { payload, options } = normalizeScanBody(request.body ?? {});
      const rangeError = validateRangeWindow(payload);
      if (rangeError) {
        return reply.status(400).send({ totalCount: 0, data: null, error: rangeError });
      }

      const result = await executor(payload, options);
      request.log.info(
        {
          requestId: request.id,
          upstreamStatus: result.status,
          marketTarget: payload.markets,
          upstreamUrl: result.upstreamUrl,
          latencyMs: result.durationMs,
        },
        'TradingView upstream call completed',
      );

      return reply.status(result.status).send(result.body);
    },
  );

  app.post<{ Body: ScanBody }>(
    '/api/v1/scan',
    {
      schema: {
        tags: [TAGS[0]],
        body: scanRequestSchema,
        response: {
          200: mappedScanResponseSchema,
          400: scanRawResponseSchema,
          500: scanRawResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { payload, options } = normalizeScanBody(request.body ?? {});
      const rangeError = validateRangeWindow(payload);
      if (rangeError) {
        return reply.status(400).send({ totalCount: 0, data: null, error: rangeError });
      }

      const result = await executor(payload, options);
      request.log.info(
        {
          requestId: request.id,
          upstreamStatus: result.status,
          marketTarget: payload.markets,
          upstreamUrl: result.upstreamUrl,
          latencyMs: result.durationMs,
        },
        'TradingView upstream call completed',
      );

      if (result.status < 200 || result.status >= 300) {
        return reply.status(result.status).send(result.body);
      }

      const mapped = toMappedScanResult(
        result.body.totalCount,
        payload.columns ?? [],
        result.body.data ?? [],
      );

      return reply.status(result.status).send(mapped);
    },
  );

  app.get<{
    Querystring: {
      text: string;
      hl?: number;
      country?: string;
      search_type?: string;
      lang?: string;
      exchange?: string;
      domain?: string;
      sort_by_country?: string;
    };
  }>(
    '/api/v1/symbol-search/v3',
    {
      schema: {
        tags: [TAGS[2]],
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: ['text'],
          properties: {
            text: { type: 'string', minLength: 1 },
            hl: { type: 'number' },
            country: { type: 'string' },
            search_type: { type: 'string' },
            lang: { type: 'string' },
            exchange: { type: 'string' },
            domain: { type: 'string' },
            sort_by_country: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: true,
            required: ['symbols'],
            properties: {
              symbols_remaining: { type: 'number' },
              symbols: { type: 'array', items: { type: 'object', additionalProperties: true } },
            },
          },
          400: { type: 'object', additionalProperties: true },
          500: { type: 'object', additionalProperties: true },
        },
      },
    },
    async (request, reply) => {
      const query = request.query;
      if (!query.text?.trim()) {
        return reply.status(400).send({ error: 'text is required' });
      }

      const options = getRequestOptionsFromHeaders(request.headers);
      const result = await symbolSearchExecutor(query, options);
      request.log.info(
        {
          requestId: request.id,
          upstreamStatus: result.status,
          upstreamUrl: result.upstreamUrl,
          latencyMs: result.durationMs,
          text: query.text,
          searchType: query.search_type,
          country: query.country,
        },
        'TradingView symbol search upstream call completed',
      );

      return reply.status(result.status).send(result.body);
    },
  );

  app.post<{
    Params: { market: string };
    Body: PayloadBody<MetainfoRequestPayload>;
  }>(
    '/api/v1/metainfo/:market',
    {
      schema: {
        tags: [TAGS[3]],
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['market'],
          properties: {
            market: { type: 'string', minLength: 1 },
          },
        },
        body: {
          type: 'object',
          additionalProperties: true,
          properties: {
            payload: { type: 'object', additionalProperties: true },
            options: { type: 'object', additionalProperties: true },
            requestOptions: { type: 'object', additionalProperties: true },
            columns: { type: 'array', items: { type: 'string' } },
            markets: { type: 'array', items: { type: 'string' } },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          400: { type: 'object', additionalProperties: true },
          500: { type: 'object', additionalProperties: true },
        },
      },
    },
    async (request, reply) => {
      const market = request.params.market.trim();
      if (!market) {
        return reply.status(400).send({ error: 'market is required' });
      }

      const normalized = normalizePayloadBody(request.body ?? {});
      const payload: MetainfoRequestPayload = {
        columns: normalized.payload.columns ?? [],
        markets: normalized.payload.markets ?? [market],
        ...normalized.payload,
      };
      const options = {
        ...getRequestOptionsFromHeaders(request.headers),
        ...normalized.options,
      };
      const result = await metainfoExecutor(market, payload, options);
      request.log.info(
        {
          requestId: request.id,
          upstreamStatus: result.status,
          upstreamUrl: result.upstreamUrl,
          latencyMs: result.durationMs,
          market,
          columnsCount: Array.isArray(payload.columns) ? payload.columns.length : undefined,
        },
        'TradingView metainfo upstream call completed',
      );

      return reply.status(result.status).send(result.body);
    },
  );

  app.get<{ Querystring: { universe?: string } }>(
    '/api/v1/metadata/fields',
    {
      schema: {
        tags: [TAGS[1]],
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            universe: {
              type: 'string',
              enum: [
                'stocks',
                'stock',
                'crypto',
                'cypto',
                'forex',
                'coin',
                'cfd',
                'futures',
                'bonds',
                'bond',
                'economics2',
                'economics',
                'economy',
                'options',
                'option',
                'opton',
              ],
            },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['universe', 'version', 'generatedAt', 'fields'],
            properties: {
              universe: { type: 'string' },
              version: { type: 'string' },
              generatedAt: { type: 'string' },
              fields: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['name', 'displayName', 'type', 'variants'],
                  properties: {
                    name: { type: 'string' },
                    displayName: { type: 'string' },
                    type: { type: 'string' },
                    variants: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const universe = normalizeUniverse(request.query.universe);
      const snapshot = loadFieldsSnapshot();
      const fields = snapshot.universes[universe];
      if (!fields) {
        return reply.status(404).send({ error: `Unknown universe '${universe}'` });
      }

      return {
        universe,
        version: snapshot.version,
        generatedAt: snapshot.generatedAt,
        fields,
      };
    },
  );

  app.get<{
    Querystring: { assetClass?: string; market?: string };
  }>(
    '/api/v1/metadata/screeners',
    {
      schema: {
        tags: [TAGS[1]],
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            assetClass: { type: 'string' },
            market: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['assetClass', 'market', 'version', 'generatedAt', 'presets'],
            properties: {
              assetClass: { type: 'string' },
              market: { type: 'string' },
              version: { type: 'string' },
              generatedAt: { type: 'string' },
              presets: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['name', 'queryCode'],
                  properties: {
                    name: { type: 'string' },
                    queryCode: { type: 'string' },
                  },
                },
              },
            },
          },
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const assetClass = request.query.assetClass ?? 'stocks';
      const market = request.query.market ?? 'america';
      const snapshot = loadScreenersSnapshot();
      const presets = snapshot.assetClasses[assetClass]?.markets[market]?.presets;

      if (!presets) {
        return reply
          .status(404)
          .send({ error: `No screener presets found for assetClass='${assetClass}' market='${market}'` });
      }

      return {
        assetClass,
        market,
        version: snapshot.version,
        generatedAt: snapshot.generatedAt,
        presets,
      };
    },
  );

  app.get(
    '/api/v1/metadata/markets',
    {
      schema: {
        tags: [TAGS[1]],
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['version', 'generatedAt', 'markets'],
            properties: {
              version: { type: 'string' },
              generatedAt: { type: 'string' },
              markets: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    async () => {
      const snapshot = loadMarketsSnapshot();
      return {
        version: snapshot.version,
        generatedAt: snapshot.generatedAt,
        markets: snapshot.markets,
      };
    },
  );

  return app;
}
