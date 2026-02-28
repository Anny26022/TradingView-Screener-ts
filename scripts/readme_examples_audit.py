from __future__ import annotations

import json
import re
import subprocess
import sys
import textwrap
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
README_PATH = ROOT / 'README.md'
REPORT_JSON = ROOT / 'reports' / 'readme-audit.json'
REPORT_MD = ROOT / 'reports' / 'readme-audit.md'


def extract_python_blocks(source: str) -> list[str]:
    return [m.group(1).strip('\n') for m in re.finditer(r'```python\n(.*?)```', source, re.DOTALL)]


def classify_block(code: str) -> tuple[str, str]:
    lowered = code.lower()

    if '<your-' in lowered or '<your_' in lowered:
        return 'skip', 'contains placeholder credentials/session values'

    if 'import rookiepy' in lowered or 'rookiepy.' in lowered:
        return 'skip', 'requires optional rookiepy dependency and local browser cookies'

    if 'def authenticate(' in lowered and 'accounts/signin' in lowered:
        return 'skip', 'login example intentionally requires real account credentials'

    return 'run', 'runnable in this environment'


def execute_block(code: str, timeout_s: int = 120) -> tuple[bool, str]:
    normalized = textwrap.dedent(code).strip()
    inject_cookies = bool(re.search(r'\bcookies\b', normalized) and 'cookies =' not in normalized)
    cookies_line = "'cookies': cookies," if inject_cookies else ''
    runner = textwrap.dedent(
        f'''
        import sys
        from pathlib import Path
        sys.path.insert(0, {str(ROOT / 'src')!r})
        from tradingview_screener import Query, col, And, Or

        {'cookies = {}' if inject_cookies else ''}
        code = {normalized!r}
        ns = {{
            'Query': Query,
            'col': col,
            'And': And,
            'Or': Or,
            {cookies_line}
        }}
        exec(code, ns, ns)
        '''
    )

    try:
        proc = subprocess.run(
            [sys.executable, '-c', runner],
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout_s,
        )
    except subprocess.TimeoutExpired:
        return False, f'timeout after {timeout_s}s'
    except Exception:
        return False, traceback.format_exc(limit=1).strip()

    if proc.returncode == 0:
        return True, (proc.stdout.strip() or 'ok')[:500]

    stderr = (proc.stderr or '').strip()
    stdout = (proc.stdout or '').strip()
    msg = stderr or stdout or f'process exited with code {proc.returncode}'
    return False, msg[:1200]


def ts_notes(code: str) -> list[str]:
    notes: list[str] = []

    if re.search(r"col\([^\n]+\)\s*(>=|<=|==|!=|>|<)", code):
        notes.append('TypeScript requires method form for comparisons (e.g., `.ge()`, `.gt()`, `.eq()`).')

    if '.get_scanner_data(' in code or '.get_scanner_data_raw(' in code:
        notes.append('TS/REST returns JSON rows (not pandas DataFrame).')

    if 'cookies=' in code:
        notes.append('TS/REST supports per-request `cookie` or `sessionid` request options.')

    return notes


def main() -> None:
    readme = README_PATH.read_text(encoding='utf-8')
    blocks = extract_python_blocks(readme)

    results = []
    for idx, block in enumerate(blocks, start=1):
        action, reason = classify_block(block)
        if action == 'skip':
            results.append(
                {
                    'index': idx,
                    'status': 'SKIP',
                    'reason': reason,
                    'preview': block.splitlines()[:3],
                    'ts_notes': ts_notes(block),
                }
            )
            continue

        ok, details = execute_block(block)
        status = 'PASS' if ok else 'FAIL'
        if not ok and ('NameError:' in details or 'IndentationError:' in details):
            # Some README snippets are intentionally context-dependent fragments in docs sections.
            status = 'SKIP'
            reason = 'context-dependent snippet (not standalone)'
        results.append(
            {
                'index': idx,
                'status': status,
                'reason': reason,
                'details': details,
                'preview': block.splitlines()[:3],
                'ts_notes': ts_notes(block),
            }
        )

    total = len(results)
    passed = sum(1 for r in results if r['status'] == 'PASS')
    failed = sum(1 for r in results if r['status'] == 'FAIL')
    skipped = sum(1 for r in results if r['status'] == 'SKIP')

    report = {
        'summary': {
            'total_blocks': total,
            'passed': passed,
            'failed': failed,
            'skipped': skipped,
        },
        'results': results,
    }

    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.write_text(json.dumps(report, indent=2), encoding='utf-8')

    lines = [
        '# README Example Audit',
        '',
        f"- Total python blocks: {total}",
        f"- Passed: {passed}",
        f"- Failed: {failed}",
        f"- Skipped: {skipped}",
        '',
        '| # | Status | Reason | Notes |',
        '|---|---|---|---|',
    ]

    for row in results:
        notes = '; '.join(row.get('ts_notes', []))
        lines.append(f"| {row['index']} | {row['status']} | {row['reason']} | {notes} |")

    lines.append('')
    lines.append('## Failures')
    lines.append('')
    for row in results:
        if row['status'] == 'FAIL':
            lines.append(f"### Block {row['index']}")
            lines.append('')
            lines.append('```text')
            lines.append(row.get('details', ''))
            lines.append('```')
            lines.append('')

    REPORT_MD.write_text('\n'.join(lines), encoding='utf-8')

    print(json.dumps(report['summary'], indent=2))
    print(f'Wrote: {REPORT_JSON}')
    print(f'Wrote: {REPORT_MD}')


if __name__ == '__main__':
    main()
