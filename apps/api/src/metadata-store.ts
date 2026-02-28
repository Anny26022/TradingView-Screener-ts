import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface FieldsSnapshot {
  version: string;
  generatedAt: string;
  universes: Record<
    string,
    Array<{
      name: string;
      displayName: string;
      type: string;
      variants: string[];
    }>
  >;
}

interface ScreenersSnapshot {
  version: string;
  generatedAt: string;
  assetClasses: Record<
    string,
    {
      markets: Record<
        string,
        {
          presets: Array<{ name: string; queryCode: string }>;
        }
      >;
    }
  >;
}

interface MarketsSnapshot {
  version: string;
  generatedAt: string;
  markets: string[];
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const metadataDir = path.resolve(currentDir, '../metadata');

function loadJson<T>(filename: string): T {
  const raw = readFileSync(path.join(metadataDir, filename), 'utf8');
  return JSON.parse(raw) as T;
}

export function loadFieldsSnapshot(): FieldsSnapshot {
  return loadJson<FieldsSnapshot>('fields.json');
}

export function loadScreenersSnapshot(): ScreenersSnapshot {
  return loadJson<ScreenersSnapshot>('screeners.json');
}

export function loadMarketsSnapshot(): MarketsSnapshot {
  return loadJson<MarketsSnapshot>('markets.json');
}
