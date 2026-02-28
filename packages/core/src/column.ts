import type { FilterOperationDict } from './types.js';

export class Column {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  private static extractName(obj: unknown): unknown {
    if (obj instanceof Column) {
      return obj.name;
    }
    return obj;
  }

  gt(other: unknown): FilterOperationDict {
    return { left: this.name, operation: 'greater', right: Column.extractName(other) };
  }

  ge(other: unknown): FilterOperationDict {
    return { left: this.name, operation: 'egreater', right: Column.extractName(other) };
  }

  lt(other: unknown): FilterOperationDict {
    return { left: this.name, operation: 'less', right: Column.extractName(other) };
  }

  le(other: unknown): FilterOperationDict {
    return { left: this.name, operation: 'eless', right: Column.extractName(other) };
  }

  eq(other: unknown): FilterOperationDict {
    return { left: this.name, operation: 'equal', right: Column.extractName(other) };
  }

  ne(other: unknown): FilterOperationDict {
    return { left: this.name, operation: 'nequal', right: Column.extractName(other) };
  }

  crosses(other: unknown): FilterOperationDict {
    return { left: this.name, operation: 'crosses', right: Column.extractName(other) };
  }

  crossesAbove(other: unknown): FilterOperationDict {
    return { left: this.name, operation: 'crosses_above', right: Column.extractName(other) };
  }

  crosses_above(other: unknown): FilterOperationDict {
    return this.crossesAbove(other);
  }

  crossesBelow(other: unknown): FilterOperationDict {
    return { left: this.name, operation: 'crosses_below', right: Column.extractName(other) };
  }

  crosses_below(other: unknown): FilterOperationDict {
    return this.crossesBelow(other);
  }

  between(left: unknown, right: unknown): FilterOperationDict {
    return {
      left: this.name,
      operation: 'in_range',
      right: [Column.extractName(left), Column.extractName(right)],
    };
  }

  notBetween(left: unknown, right: unknown): FilterOperationDict {
    return {
      left: this.name,
      operation: 'not_in_range',
      right: [Column.extractName(left), Column.extractName(right)],
    };
  }

  not_between(left: unknown, right: unknown): FilterOperationDict {
    return this.notBetween(left, right);
  }

  isin(values: Iterable<unknown>): FilterOperationDict {
    return { left: this.name, operation: 'in_range', right: [...values] };
  }

  notIn(values: Iterable<unknown>): FilterOperationDict {
    return { left: this.name, operation: 'not_in_range', right: [...values] };
  }

  not_in(values: Iterable<unknown>): FilterOperationDict {
    return this.notIn(values);
  }

  has(values: string | string[]): FilterOperationDict {
    return { left: this.name, operation: 'has', right: values };
  }

  hasNoneOf(values: string | string[]): FilterOperationDict {
    return { left: this.name, operation: 'has_none_of', right: values };
  }

  has_none_of(values: string | string[]): FilterOperationDict {
    return this.hasNoneOf(values);
  }

  inDayRange(a: number, b: number): FilterOperationDict {
    return { left: this.name, operation: 'in_day_range', right: [a, b] };
  }

  in_day_range(a: number, b: number): FilterOperationDict {
    return this.inDayRange(a, b);
  }

  inWeekRange(a: number, b: number): FilterOperationDict {
    return { left: this.name, operation: 'in_week_range', right: [a, b] };
  }

  in_week_range(a: number, b: number): FilterOperationDict {
    return this.inWeekRange(a, b);
  }

  inMonthRange(a: number, b: number): FilterOperationDict {
    return { left: this.name, operation: 'in_month_range', right: [a, b] };
  }

  in_month_range(a: number, b: number): FilterOperationDict {
    return this.inMonthRange(a, b);
  }

  abovePct(column: Column | string, pct: number): FilterOperationDict {
    return { left: this.name, operation: 'above%', right: [Column.extractName(column), pct] };
  }

  above_pct(column: Column | string, pct: number): FilterOperationDict {
    return this.abovePct(column, pct);
  }

  belowPct(column: Column | string, pct: number): FilterOperationDict {
    return { left: this.name, operation: 'below%', right: [Column.extractName(column), pct] };
  }

  below_pct(column: Column | string, pct: number): FilterOperationDict {
    return this.belowPct(column, pct);
  }

  betweenPct(column: Column | string, pct1: number, pct2?: number): FilterOperationDict {
    return {
      left: this.name,
      operation: 'in_range%',
      right: [Column.extractName(column), pct1, pct2],
    };
  }

  between_pct(column: Column | string, pct1: number, pct2?: number): FilterOperationDict {
    return this.betweenPct(column, pct1, pct2);
  }

  notBetweenPct(column: Column | string, pct1: number, pct2?: number): FilterOperationDict {
    return {
      left: this.name,
      operation: 'not_in_range%',
      right: [Column.extractName(column), pct1, pct2],
    };
  }

  not_between_pct(column: Column | string, pct1: number, pct2?: number): FilterOperationDict {
    return this.notBetweenPct(column, pct1, pct2);
  }

  like(other: unknown): FilterOperationDict {
    return { left: this.name, operation: 'match', right: Column.extractName(other) };
  }

  notLike(other: unknown): FilterOperationDict {
    return { left: this.name, operation: 'nmatch', right: Column.extractName(other) };
  }

  not_like(other: unknown): FilterOperationDict {
    return this.notLike(other);
  }

  empty(): FilterOperationDict {
    return { left: this.name, operation: 'empty', right: null };
  }

  notEmpty(): FilterOperationDict {
    return { left: this.name, operation: 'nempty', right: null };
  }

  not_empty(): FilterOperationDict {
    return this.notEmpty();
  }

  toString(): string {
    return this.name;
  }
}

export const col = (name: string): Column => new Column(name);
