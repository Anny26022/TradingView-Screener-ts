# README Example Audit

- Total python blocks: 9
- Passed: 6
- Failed: 0
- Skipped: 3

| # | Status | Reason | Notes |
|---|---|---|---|
| 1 | PASS | runnable in this environment | TS/REST returns JSON rows (not pandas DataFrame). |
| 2 | PASS | runnable in this environment | TypeScript requires method form for comparisons (e.g., `.ge()`, `.gt()`, `.eq()`).; TS/REST returns JSON rows (not pandas DataFrame). |
| 3 | PASS | runnable in this environment | TS/REST returns JSON rows (not pandas DataFrame). |
| 4 | SKIP | requires optional rookiepy dependency and local browser cookies |  |
| 5 | PASS | runnable in this environment | TS/REST returns JSON rows (not pandas DataFrame).; TS/REST supports per-request `cookie` or `sessionid` request options. |
| 6 | PASS | runnable in this environment | TS/REST returns JSON rows (not pandas DataFrame).; TS/REST supports per-request `cookie` or `sessionid` request options. |
| 7 | SKIP | contains placeholder credentials/session values | TS/REST returns JSON rows (not pandas DataFrame).; TS/REST supports per-request `cookie` or `sessionid` request options. |
| 8 | SKIP | contains placeholder credentials/session values | TS/REST returns JSON rows (not pandas DataFrame).; TS/REST supports per-request `cookie` or `sessionid` request options. |
| 9 | PASS | runnable in this environment |  |

## Failures
