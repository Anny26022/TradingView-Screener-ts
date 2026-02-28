import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseFieldsHtml,
  parseMarketsFromFieldsHtml,
  parseScreenerMapping,
  parseScreenerMarkets,
} from '../apps/api/src/metadata-parser.js';

const FIELD_UNIVERSES = [
  'stocks',
  'crypto',
  'forex',
  'coin',
  'cfd',
  'futures',
  'bonds',
  'bond',
  'economics2',
  'options',
] as const;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_METADATA_DIR = path.resolve(ROOT, 'apps/api/metadata');

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const version = '0.1.0';

  const stocksFieldsHtml = await fetchText(
    'https://shner-elmo.github.io/TradingView-Screener/fields/stocks.html',
  );
  const markets = parseMarketsFromFieldsHtml(stocksFieldsHtml);

  const universes: Record<string, FieldEntry[]> = {};
  for (const universe of FIELD_UNIVERSES) {
    const html =
      universe === 'stocks'
        ? stocksFieldsHtml
        : await fetchText(`https://shner-elmo.github.io/TradingView-Screener/fields/${universe}.html`);
    universes[universe] = parseFieldsHtml(html);
  }

  const americaScreenerHtml = await fetchText(
    'https://shner-elmo.github.io/TradingView-Screener/screeners/stocks/america.html',
  );
  const screenerMarkets = parseScreenerMarkets(americaScreenerHtml);
  const stockScreenerMarkets: Record<string, { presets: Array<{ name: string; queryCode: string }> }> = {};

  for (const market of screenerMarkets) {
    const html =
      market === 'america'
        ? americaScreenerHtml
        : await fetchText(`https://shner-elmo.github.io/TradingView-Screener/screeners/stocks/${market}.html`);
    stockScreenerMarkets[market] = {
      presets: parseScreenerMapping(html),
    };
  }

  const fieldsSnapshot = {
    version,
    generatedAt,
    universes,
  };

  const marketsSnapshot = {
    version,
    generatedAt,
    markets: [...new Set([...markets, ...FIELD_UNIVERSES])].sort(),
  };

  const screenersSnapshot = {
    version,
    generatedAt,
    assetClasses: {
      stocks: {
        markets: stockScreenerMarkets,
      },
    },
  };

  writeFileSync(path.join(API_METADATA_DIR, 'fields.json'), JSON.stringify(fieldsSnapshot, null, 2));
  writeFileSync(path.join(API_METADATA_DIR, 'markets.json'), JSON.stringify(marketsSnapshot, null, 2));
  writeFileSync(path.join(API_METADATA_DIR, 'screeners.json'), JSON.stringify(screenersSnapshot, null, 2));

  console.log('Metadata snapshots updated:');
  console.log(`- ${path.join(API_METADATA_DIR, 'fields.json')}`);
  console.log(`- ${path.join(API_METADATA_DIR, 'markets.json')}`);
  console.log(`- ${path.join(API_METADATA_DIR, 'screeners.json')}`);
}

await main();
