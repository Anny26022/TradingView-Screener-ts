# Parity Report

- Generated at: 2026-02-28T05:09:03.380Z
- PASS: 41
- FAIL: 0
- N/A: 11

| Area | Item | Status | Details |
|---|---|---|---|
| Query methods | __eq__ | N/A | Python dunder/operator overload; not directly portable to TS syntax. |
| Query methods | __init__ | N/A | Python dunder/operator overload; not directly portable to TS syntax. |
| Query methods | __repr__ | N/A | Python dunder/operator overload; not directly portable to TS syntax. |
| Query methods | copy | PASS | method present in TS surface |
| Query methods | get_scanner_data | PASS | method present in TS surface |
| Query methods | get_scanner_data_raw | PASS | method present in TS surface |
| Query methods | limit | PASS | method present in TS surface |
| Query methods | offset | PASS | method present in TS surface |
| Query methods | order_by | PASS | method present in TS surface |
| Query methods | select | PASS | method present in TS surface |
| Query methods | set_index | PASS | method present in TS surface |
| Query methods | set_markets | PASS | method present in TS surface |
| Query methods | set_property | PASS | method present in TS surface |
| Query methods | set_tickers | PASS | method present in TS surface |
| Query methods | where | PASS | method present in TS surface |
| Query methods | where2 | PASS | method present in TS surface |
| Column methods | __eq__ | N/A | Python dunder/operator overload; not directly portable to TS syntax. |
| Column methods | __ge__ | N/A | Python dunder/operator overload; not directly portable to TS syntax. |
| Column methods | __gt__ | N/A | Python dunder/operator overload; not directly portable to TS syntax. |
| Column methods | __init__ | N/A | Python dunder/operator overload; not directly portable to TS syntax. |
| Column methods | __le__ | N/A | Python dunder/operator overload; not directly portable to TS syntax. |
| Column methods | __lt__ | N/A | Python dunder/operator overload; not directly portable to TS syntax. |
| Column methods | __ne__ | N/A | Python dunder/operator overload; not directly portable to TS syntax. |
| Column methods | __repr__ | N/A | Python dunder/operator overload; not directly portable to TS syntax. |
| Column methods | above_pct | PASS | method present in TS surface |
| Column methods | below_pct | PASS | method present in TS surface |
| Column methods | between | PASS | method present in TS surface |
| Column methods | between_pct | PASS | method present in TS surface |
| Column methods | crosses | PASS | method present in TS surface |
| Column methods | crosses_above | PASS | method present in TS surface |
| Column methods | crosses_below | PASS | method present in TS surface |
| Column methods | empty | PASS | method present in TS surface |
| Column methods | has | PASS | method present in TS surface |
| Column methods | has_none_of | PASS | method present in TS surface |
| Column methods | in_day_range | PASS | method present in TS surface |
| Column methods | in_month_range | PASS | method present in TS surface |
| Column methods | in_week_range | PASS | method present in TS surface |
| Column methods | isin | PASS | method present in TS surface |
| Column methods | like | PASS | method present in TS surface |
| Column methods | not_between | PASS | method present in TS surface |
| Column methods | not_between_pct | PASS | method present in TS surface |
| Column methods | not_empty | PASS | method present in TS surface |
| Column methods | not_in | PASS | method present in TS surface |
| Column methods | not_like | PASS | method present in TS surface |
| Operation tokens | token-set-parity | PASS | matched 25 operation tokens |
| Defaults | query-default-payload | PASS | python_url=https://scanner.tradingview.com/america/scan, ts_url=https://scanner.tradingview.com/america/scan |
| Top-level symbols | Query | PASS | python=true, ts=true |
| Top-level symbols | Column | PASS | python=true, ts=true |
| Top-level symbols | And | PASS | python=true, ts=true |
| Top-level symbols | Or | PASS | python=true, ts=true |
| Top-level symbols | col | PASS | python=true, ts=true |
| Utility parity | format_technical_rating | PASS | threshold behavior matches python util.py |

## Notes

- N/A rows are Python-specific dunder/operator overload semantics that TypeScript cannot mirror syntactically.
- Logical parity is still provided through method forms (gt/ge/eq/etc.).