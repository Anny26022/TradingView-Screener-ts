import { load } from 'cheerio';

export interface FieldEntry {
  name: string;
  displayName: string;
  type: string;
  variants: string[];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function parseMarketsFromFieldsHtml(html: string): string[] {
  const $ = load(html);
  const markets = new Set<string>();

  $('button[data-tooltip]').each((_, button) => {
    const tooltip = $(button).attr('data-tooltip') ?? '';
    const match = tooltip.match(/set_markets\((.*)\)/);
    if (!match) {
      return;
    }

    for (const item of match[1].split(',')) {
      const market = item.trim().replace(/^'/, '').replace(/'$/, '');
      if (market.length > 0) {
        markets.add(market);
      }
    }
  });

  return [...markets];
}

export function parseFieldsHtml(html: string): FieldEntry[] {
  const $ = load(html);
  const fields: FieldEntry[] = [];

  $('#fields tbody tr').each((_, row) => {
    const tds = $(row).find('td');
    if (tds.length < 3) {
      return;
    }

    const firstCell = $(tds[0]);
    const detailsSummary = firstCell.find('details > summary').first().text().trim();
    const variants = firstCell
      .find('details li')
      .toArray()
      .map((item) => normalizeWhitespace($(item).text()))
      .filter((item) => item.length > 0);

    const baseName = detailsSummary.length > 0 ? detailsSummary : normalizeWhitespace(firstCell.text());
    const displayName = normalizeWhitespace($(tds[1]).text());
    const type = normalizeWhitespace($(tds[2]).text());

    fields.push({
      name: baseName,
      displayName,
      type,
      variants: variants.length > 0 ? variants : [baseName],
    });
  });

  return fields;
}

function extractJsonObject(code: string, marker: string): string {
  const markerIndex = code.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Marker '${marker}' not found`);
  }

  const objectStart = code.indexOf('{', markerIndex);
  if (objectStart === -1) {
    throw new Error(`Could not locate JSON object start after marker '${marker}'`);
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = objectStart; i < code.length; i += 1) {
    const char = code[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return code.slice(objectStart, i + 1);
      }
    }
  }

  throw new Error(`Could not find object end for marker '${marker}'`);
}

export function parseScreenerMapping(html: string): Array<{ name: string; queryCode: string }> {
  const jsonLiteral = extractJsonObject(html, 'const screenerToCodeMapping =');
  const mapping = JSON.parse(jsonLiteral) as Record<string, string>;

  return Object.entries(mapping).map(([name, queryCode]) => ({ name, queryCode }));
}

export function parseScreenerMarkets(html: string): string[] {
  const $ = load(html);
  const markets = new Set<string>();

  $('#market option').each((_, item) => {
    const value = ($(item).attr('value') ?? '').trim();
    if (!value.endsWith('.html')) {
      return;
    }
    markets.add(value.replace(/\.html$/, ''));
  });

  return [...markets].sort();
}
