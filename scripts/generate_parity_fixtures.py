from __future__ import annotations

import json
import sys
from copy import deepcopy
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

from tradingview_screener import Query, And, Or, col  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'fixtures' / 'python-parity.json'


def build_column_operation_fixtures() -> dict:
    close = col('close')

    return {
        'gt_number': close > 2.5,
        'ge_column': close >= col('VWAP'),
        'lt_number': close < 100,
        'le_column': close <= col('high'),
        'eq_string': col('type') == 'stock',
        'ne_string': col('exchange') != 'OTC',
        'crosses': col('MACD.macd').crosses('MACD.signal'),
        'crosses_above': col('MACD.macd').crosses_above('MACD.signal'),
        'crosses_below': col('MACD.macd').crosses_below('MACD.signal'),
        'between_numbers': close.between(2.5, 15),
        'between_columns': close.between('EMA5', 'EMA20'),
        'not_between': close.not_between(2.5, 15),
        'isin': col('exchange').isin(['AMEX', 'NASDAQ', 'NYSE']),
        'not_in': col('sector').not_in(['Health Technology', 'Health Services']),
        'has': col('typespecs').has(['common']),
        'has_none_of': col('typespecs').has_none_of(['reit', 'etn', 'etf']),
        'in_day_range': col('earnings_release_next_trading_date_fq').in_day_range(0, 0),
        'in_week_range': col('earnings_release_next_trading_date_fq').in_week_range(0, 2),
        'in_month_range': col('earnings_release_next_trading_date_fq').in_month_range(0, 3),
        'above_pct': close.above_pct('VWAP', 1.03),
        'below_pct': close.below_pct('VWAP', 1.03),
        'between_pct': close.between_pct('EMA200', 1.2, 1.5),
        'not_between_pct': close.not_between_pct('EMA200', 1.2, 1.5),
        'like': col('description').like('apple'),
        'not_like': col('description').not_like('apple'),
        'empty': col('premarket_change').empty(),
        'not_empty': col('premarket_change').not_empty(),
    }


def build_and_or_fixture() -> dict:
    operation = And(
        Or(
            And(col('type') == 'stock', col('typespecs').has(['common'])),
            And(col('type') == 'stock', col('typespecs').has(['preferred'])),
            And(col('type') == 'dr'),
            And(col('type') == 'fund', col('typespecs').has_none_of(['etf'])),
        )
    )
    return operation


def build_query_fixtures() -> dict:
    fixtures = {}

    fixtures['default'] = {
        'query': deepcopy(Query().query),
        'url': Query().url,
    }

    q = (
        Query()
        .select('name', 'close|1', 'volume')
        .where(col('market_cap_basic').between(1_000_000, 50_000_000), col('relative_volume_10d_calc') > 1.2)
        .order_by('volume', ascending=False)
        .offset(5)
        .limit(25)
    )
    fixtures['select_where_order_offset_limit'] = {'query': deepcopy(q.query), 'url': q.url}

    q = Query().where2(build_and_or_fixture())
    fixtures['where2_nested'] = {'query': deepcopy(q.query), 'url': q.url}

    q = Query().set_markets('crypto')
    fixtures['set_markets_single'] = {'query': deepcopy(q.query), 'url': q.url}

    q = Query().set_markets('america', 'israel')
    fixtures['set_markets_multi'] = {'query': deepcopy(q.query), 'url': q.url}

    q = Query().set_tickers('NASDAQ:TSLA', 'NYSE:GME')
    fixtures['set_tickers'] = {'query': deepcopy(q.query), 'url': q.url}

    q = Query().set_index('SYML:SP;SPX', 'SYML:TVC;UKX')
    fixtures['set_index'] = {'query': deepcopy(q.query), 'url': q.url}

    q = Query().set_property('ignore_unknown_fields', True).set_property('custom', {'x': 1})
    fixtures['set_property'] = {'query': deepcopy(q.query), 'url': q.url}

    q1 = Query()
    q2 = q1.copy()
    fixtures['copy_shallow_before'] = {'query': deepcopy(q2.query), 'url': q2.url}
    q1.query['symbols']['tickers'].append('NASDAQ:NVDA')  # type: ignore[index]
    fixtures['copy_shallow_after_original_mutation'] = {
        'original_query': deepcopy(q1.query),
        'copied_query': deepcopy(q2.query),
    }

    return fixtures


def main() -> None:
    payload = {
        'column_operations': build_column_operation_fixtures(),
        'and_or': build_and_or_fixture(),
        'query': build_query_fixtures(),
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding='utf-8')
    print(f'Wrote {OUTPUT}')


if __name__ == '__main__':
    main()
