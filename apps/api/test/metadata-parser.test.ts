import { describe, expect, it } from 'vitest';
import {
  parseFieldsHtml,
  parseMarketsFromFieldsHtml,
  parseScreenerMapping,
  parseScreenerMarkets,
} from '../src/metadata-parser.js';

describe('metadata parser', () => {
  it('parses fields and variants', () => {
    const html = `
      <table id="fields">
        <tbody>
          <tr>
            <td><details><summary>close</summary><ul><li>close</li><li>close|1</li></ul></details></td>
            <td>Price</td>
            <td>price</td>
          </tr>
          <tr>
            <td>type</td>
            <td>Symbol Type</td>
            <td>text</td>
          </tr>
        </tbody>
      </table>
    `;

    expect(parseFieldsHtml(html)).toEqual([
      {
        name: 'close',
        displayName: 'Price',
        type: 'price',
        variants: ['close', 'close|1'],
      },
      {
        name: 'type',
        displayName: 'Symbol Type',
        type: 'text',
        variants: ['type'],
      },
    ]);
  });

  it('parses markets from set_markets tooltips', () => {
    const html = `
      <button data-tooltip="set_markets('america', 'italy')">Stocks</button>
      <button data-tooltip="set_markets('crypto')">Crypto</button>
    `;

    expect(parseMarketsFromFieldsHtml(html).sort()).toEqual(['america', 'crypto', 'italy']);
  });

  it('parses screener mappings JSON object', () => {
    const html = `
      <script>
        const screenerToCodeMapping = {"All stocks":"(Query())","Top gainers":"(Query().order_by('change', ascending=False))"};
      </script>
    `;

    expect(parseScreenerMapping(html)).toEqual([
      { name: 'All stocks', queryCode: '(Query())' },
      { name: 'Top gainers', queryCode: "(Query().order_by('change', ascending=False))" },
    ]);
  });

  it('parses screener market page options', () => {
    const html = `
      <select id="market">
        <option value="america.html">USA</option>
        <option value="italy.html">Italy</option>
        <option value="">Choose</option>
      </select>
    `;

    expect(parseScreenerMarkets(html)).toEqual(['america', 'italy']);
  });
});
