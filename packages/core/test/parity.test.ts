import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { And, Or, Query, col, formatTechnicalRating, format_technical_rating } from '../src/index.js';

interface FixtureShape {
  column_operations: Record<string, unknown>;
  and_or: unknown;
  query: Record<string, unknown>;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(currentDir, '../../../fixtures/python-parity.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as FixtureShape;

describe('Column operation parity with Python fixtures', () => {
  it('serializes all operations exactly', () => {
    const close = col('close');

    const actual = {
      gt_number: close.gt(2.5),
      ge_column: close.ge(col('VWAP')),
      lt_number: close.lt(100),
      le_column: close.le(col('high')),
      eq_string: col('type').eq('stock'),
      ne_string: col('exchange').ne('OTC'),
      crosses: col('MACD.macd').crosses('MACD.signal'),
      crosses_above: col('MACD.macd').crosses_above('MACD.signal'),
      crosses_below: col('MACD.macd').crosses_below('MACD.signal'),
      between_numbers: close.between(2.5, 15),
      between_columns: close.between('EMA5', 'EMA20'),
      not_between: close.not_between(2.5, 15),
      isin: col('exchange').isin(['AMEX', 'NASDAQ', 'NYSE']),
      not_in: col('sector').not_in(['Health Technology', 'Health Services']),
      has: col('typespecs').has(['common']),
      has_none_of: col('typespecs').has_none_of(['reit', 'etn', 'etf']),
      in_day_range: col('earnings_release_next_trading_date_fq').in_day_range(0, 0),
      in_week_range: col('earnings_release_next_trading_date_fq').in_week_range(0, 2),
      in_month_range: col('earnings_release_next_trading_date_fq').in_month_range(0, 3),
      above_pct: close.above_pct('VWAP', 1.03),
      below_pct: close.below_pct('VWAP', 1.03),
      between_pct: close.between_pct('EMA200', 1.2, 1.5),
      not_between_pct: close.not_between_pct('EMA200', 1.2, 1.5),
      like: col('description').like('apple'),
      not_like: col('description').not_like('apple'),
      empty: col('premarket_change').empty(),
      not_empty: col('premarket_change').not_empty(),
    };

    expect(actual).toEqual(fixture.column_operations);
  });
});

describe('And/Or parity with Python fixtures', () => {
  it('matches nested filter serialization', () => {
    const actual = And(
      Or(
        And(col('type').eq('stock'), col('typespecs').has(['common'])),
        And(col('type').eq('stock'), col('typespecs').has(['preferred'])),
        And(col('type').eq('dr')),
        And(col('type').eq('fund'), col('typespecs').has_none_of(['etf'])),
      ),
    );

    expect(actual).toEqual(fixture.and_or);
  });
});

describe('Query parity with Python fixtures', () => {
  it('matches default query state', () => {
    const q = new Query();
    const expected = fixture.query.default as { query: unknown; url: string };
    expect(q.query).toEqual(expected.query);
    expect(q.url).toBe(expected.url);
  });

  it('matches select/where/order/offset/limit serialization', () => {
    const q = new Query()
      .select('name', 'close|1', 'volume')
      .where(col('market_cap_basic').between(1_000_000, 50_000_000), col('relative_volume_10d_calc').gt(1.2))
      .order_by('volume', false)
      .offset(5)
      .limit(25);

    const expected = fixture.query.select_where_order_offset_limit as { query: unknown; url: string };
    expect(q.query).toEqual(expected.query);
    expect(q.url).toBe(expected.url);
  });

  it('matches where2 serialization', () => {
    const q = new Query().where2(
      And(
        Or(
          And(col('type').eq('stock'), col('typespecs').has(['common'])),
          And(col('type').eq('stock'), col('typespecs').has(['preferred'])),
          And(col('type').eq('dr')),
          And(col('type').eq('fund'), col('typespecs').has_none_of(['etf'])),
        ),
      ),
    );

    const expected = fixture.query.where2_nested as { query: unknown; url: string };
    expect(q.query).toEqual(expected.query);
    expect(q.url).toBe(expected.url);
  });

  it('matches market/ticker/index/property behavior', () => {
    const singleMarket = new Query().set_markets('crypto');
    const multiMarket = new Query().set_markets('america', 'israel');
    const tickers = new Query().set_tickers('NASDAQ:TSLA', 'NYSE:GME');
    const indexes = new Query().set_index('SYML:SP;SPX', 'SYML:TVC;UKX');
    const withProperty = new Query()
      .set_property('ignore_unknown_fields', true)
      .set_property('custom', { x: 1 });

    expect(singleMarket).toMatchObject(fixture.query.set_markets_single as object);
    expect(multiMarket).toMatchObject(fixture.query.set_markets_multi as object);
    expect(tickers).toMatchObject(fixture.query.set_tickers as object);
    expect(indexes).toMatchObject(fixture.query.set_index as object);
    expect(withProperty).toMatchObject(fixture.query.set_property as object);
  });

  it('preserves shallow copy parity', () => {
    const original = new Query();
    const copied = original.copy();
    original.query.symbols?.tickers?.push('NASDAQ:NVDA');

    const expected = fixture.query.copy_shallow_after_original_mutation as {
      original_query: unknown;
      copied_query: unknown;
    };

    expect(original.query).toEqual(expected.original_query);
    expect(copied.query).toEqual(expected.copied_query);
  });
});

describe('Utility parity', () => {
  it('matches format_technical_rating behavior', () => {
    expect(formatTechnicalRating(0.6)).toBe('Strong Buy');
    expect(formatTechnicalRating(0.2)).toBe('Buy');
    expect(formatTechnicalRating(0)).toBe('Neutral');
    expect(formatTechnicalRating(-0.2)).toBe('Sell');
    expect(formatTechnicalRating(-0.6)).toBe('Strong Sell');

    expect(format_technical_rating(0.6)).toBe('Strong Buy');
  });
});
