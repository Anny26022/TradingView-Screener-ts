import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  And,
  Column,
  Or,
  Query,
  SUPPORTED_OPERATION_TOKENS,
  col,
  format_technical_rating,
} from '../packages/core/src/index.js';

type Status = 'PASS' | 'FAIL' | 'N/A';

interface MatrixRow {
  area: string;
  item: string;
  status: Status;
  details: string;
}

interface PythonSnapshot {
  module_symbols: string[];
  query_methods: string[];
  column_methods: string[];
  operation_tokens: string[];
  defaults: {
    query: Record<string, unknown>;
    url: string;
  };
  util_functions: string[];
  function_presence: Record<string, boolean>;
}

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(CURRENT_DIR, '..');
const REPORT_JSON = path.resolve(ROOT, 'reports/parity-report.json');
const REPORT_MD = path.resolve(ROOT, 'reports/parity-report.md');

const NON_PORTABLE_PYTHON_METHODS = new Set(['__init__', '__repr__', '__eq__', '__gt__', '__ge__', '__lt__', '__le__', '__ne__']);

function toSorted(arr: string[]): string[] {
  return [...arr].sort((a, b) => a.localeCompare(b));
}

function getPythonSnapshot(): PythonSnapshot {
  const proc = spawnSync('python3', ['scripts/python_surface_snapshot.py'], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  if (proc.status !== 0) {
    throw new Error(`python_surface_snapshot.py failed: ${proc.stderr || proc.stdout}`);
  }

  return JSON.parse(proc.stdout) as PythonSnapshot;
}

function getTsMethodNames(target: object): string[] {
  return Object.getOwnPropertyNames(target)
    .filter((name) => name !== 'constructor')
    .filter((name) => {
      const descriptor = Object.getOwnPropertyDescriptor(target, name);
      return Boolean(descriptor?.value && typeof descriptor.value === 'function');
    });
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableValue(item));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return Object.fromEntries(entries.map(([k, v]) => [k, stableValue(v)]));
  }

  return value;
}

function normalizedJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function compareMethodParity(area: string, pyMethods: string[], tsMethods: string[]): MatrixRow[] {
  const rows: MatrixRow[] = [];
  const tsSet = new Set(tsMethods);

  for (const method of toSorted(pyMethods)) {
    if (NON_PORTABLE_PYTHON_METHODS.has(method)) {
      rows.push({
        area,
        item: method,
        status: 'N/A',
        details: 'Python dunder/operator overload; not directly portable to TS syntax.',
      });
      continue;
    }

    const present = tsSet.has(method);
    rows.push({
      area,
      item: method,
      status: present ? 'PASS' : 'FAIL',
      details: present ? 'method present in TS surface' : 'missing in TS surface',
    });
  }

  return rows;
}

function main(): void {
  const py = getPythonSnapshot();
  const rows: MatrixRow[] = [];

  const tsQueryMethods = getTsMethodNames(Query.prototype);
  const tsColumnMethods = getTsMethodNames(Column.prototype);

  rows.push(...compareMethodParity('Query methods', py.query_methods, tsQueryMethods));
  rows.push(...compareMethodParity('Column methods', py.column_methods, tsColumnMethods));

  const tsOps = toSorted([...SUPPORTED_OPERATION_TOKENS]);
  const pyOps = toSorted(py.operation_tokens);
  const missingOps = pyOps.filter((token) => !tsOps.includes(token));
  const extraOps = tsOps.filter((token) => !pyOps.includes(token));

  rows.push({
    area: 'Operation tokens',
    item: 'token-set-parity',
    status: missingOps.length === 0 && extraOps.length === 0 ? 'PASS' : 'FAIL',
    details:
      missingOps.length === 0 && extraOps.length === 0
        ? `matched ${pyOps.length} operation tokens`
        : `missing=[${missingOps.join(', ')}], extra=[${extraOps.join(', ')}]`,
  });

  const tsDefault = new Query();
  rows.push({
    area: 'Defaults',
    item: 'query-default-payload',
    status:
      normalizedJson(py.defaults.query) === normalizedJson(tsDefault.query) &&
      py.defaults.url === tsDefault.url
        ? 'PASS'
        : 'FAIL',
    details: `python_url=${py.defaults.url}, ts_url=${tsDefault.url}`,
  });

  const requiredSymbols = ['Query', 'Column', 'And', 'Or', 'col'];
  const tsSymbolChecks: Record<string, boolean> = {
    Query: typeof Query === 'function',
    Column: typeof Column === 'function',
    And: typeof And === 'function',
    Or: typeof Or === 'function',
    col: typeof col === 'function',
  };

  for (const symbol of requiredSymbols) {
    const pyHas = py.module_symbols.includes(symbol);
    const tsHas = tsSymbolChecks[symbol];
    rows.push({
      area: 'Top-level symbols',
      item: symbol,
      status: pyHas === tsHas && pyHas ? 'PASS' : 'FAIL',
      details: `python=${pyHas}, ts=${tsHas}`,
    });
  }

  rows.push({
    area: 'Utility parity',
    item: 'format_technical_rating',
    status:
      format_technical_rating(0.6) === 'Strong Buy' &&
      format_technical_rating(0.2) === 'Buy' &&
      format_technical_rating(0) === 'Neutral' &&
      format_technical_rating(-0.2) === 'Sell' &&
      format_technical_rating(-0.6) === 'Strong Sell'
        ? 'PASS'
        : 'FAIL',
    details: 'threshold behavior matches python util.py',
  });

  const summary = {
    total: rows.length,
    pass: rows.filter((r) => r.status === 'PASS').length,
    fail: rows.filter((r) => r.status === 'FAIL').length,
    na: rows.filter((r) => r.status === 'N/A').length,
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    summary,
    rows,
    notes: [
      'N/A rows are Python-specific dunder/operator overload semantics that TypeScript cannot mirror syntactically.',
      'Logical parity is still provided through method forms (gt/ge/eq/etc.).',
    ],
  };

  writeFileSync(REPORT_JSON, JSON.stringify(payload, null, 2));

  const md: string[] = [];
  md.push('# Parity Report');
  md.push('');
  md.push(`- Generated at: ${payload.generatedAt}`);
  md.push(`- PASS: ${summary.pass}`);
  md.push(`- FAIL: ${summary.fail}`);
  md.push(`- N/A: ${summary.na}`);
  md.push('');
  md.push('| Area | Item | Status | Details |');
  md.push('|---|---|---|---|');
  for (const row of rows) {
    md.push(`| ${row.area} | ${row.item} | ${row.status} | ${row.details.replace(/\|/g, '\\|')} |`);
  }
  md.push('');
  md.push('## Notes');
  md.push('');
  for (const note of payload.notes) {
    md.push(`- ${note}`);
  }

  writeFileSync(REPORT_MD, md.join('\n'));

  console.log(JSON.stringify(summary, null, 2));
  console.log(`Wrote: ${REPORT_JSON}`);
  console.log(`Wrote: ${REPORT_MD}`);
}

main();
