from __future__ import annotations

import json
import re
from pathlib import Path

import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))

from tradingview_screener import Query, Column, And, Or, col  # noqa: E402
from tradingview_screener import models, util  # noqa: E402


def class_method_names(cls: type) -> list[str]:
    return [
        name
        for name, value in cls.__dict__.items()
        if callable(value)
    ]


def get_operation_tokens() -> list[str]:
    # `from __future__ import annotations` + TYPE_CHECKING-only imports make runtime type
    # introspection of this Literal unreliable, so parse source directly.
    source = (ROOT / 'src' / 'tradingview_screener' / 'models.py').read_text(encoding='utf-8')
    m = re.search(r'operation:\s*Literal\[(.*?)\]\s*right:', source, re.DOTALL)
    if not m:
        return []
    literal_blob = m.group(1)
    return re.findall(r"^\s*'([^']+)'", literal_blob, re.MULTILINE)


def get_public_module_symbols() -> list[str]:
    import tradingview_screener as tvs

    symbols = []
    for name in ('Query', 'Column', 'And', 'Or', 'col'):
        if hasattr(tvs, name):
            symbols.append(name)
    return symbols


def main() -> None:
    q = Query()
    output = {
        'module_symbols': get_public_module_symbols(),
        'query_methods': class_method_names(Query),
        'column_methods': class_method_names(Column),
        'operation_tokens': get_operation_tokens(),
        'defaults': {
            'query': q.query,
            'url': q.url,
        },
        'util_functions': [
            name
            for name in dir(util)
            if callable(getattr(util, name)) and not name.startswith('_')
        ],
        'function_presence': {
            'And': callable(And),
            'Or': callable(Or),
            'col': callable(col),
        },
    }

    print(json.dumps(output, indent=2, sort_keys=True))


if __name__ == '__main__':
    main()
