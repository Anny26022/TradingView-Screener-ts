import type { FilterOperationDict, OperationDict } from './types.js';

function implAndOrChaining(
  expressions: Array<FilterOperationDict | OperationDict>,
  operator: 'and' | 'or',
): OperationDict {
  const operands = expressions.map((expr) => {
    if ('left' in expr) {
      return { expression: expr };
    }
    return expr;
  });

  return {
    operation: {
      operator,
      operands,
    },
  };
}

export function And(...expressions: Array<FilterOperationDict | OperationDict>): OperationDict {
  return implAndOrChaining(expressions, 'and');
}

export function Or(...expressions: Array<FilterOperationDict | OperationDict>): OperationDict {
  return implAndOrChaining(expressions, 'or');
}
