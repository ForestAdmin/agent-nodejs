/* eslint-disable no-continue */
import {
  ConditionTree,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  Operator,
} from '@forestadmin/datasource-toolkit';

function isYear(str: string): boolean {
  return (
    /^\d{4}$/.test(str) && Number(str) >= 1800 && Number(str) <= new Date().getFullYear() + 100
  );
}

function isPlainDate(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !Number.isNaN(Date.parse(str));
}

function isValidDate(str: string): boolean {
  return isYear(str) || isPlainDate(str);
}

function getPeriodStart(string): string {
  if (isYear(string)) return `${string}-01-01`;

  return string;
}

function getAfterPeriodEnd(string): string {
  if (isYear(string)) return `${Number(string) + 1}-01-01`;

  const date = new Date(string);
  date.setDate(date.getDate() + 1);

  return date.toISOString().split('T')[0];
}

const supportedOperators: [
  string,
  [Operator, (value: string) => string][],
  [Operator, (value: string) => string][],
][] = [
  [
    '>',
    [
      ['After', getAfterPeriodEnd],
      ['Equal', getAfterPeriodEnd],
    ],
    [['Before', getAfterPeriodEnd]],
  ],
  [
    '>=',
    [
      ['After', getPeriodStart],
      ['Equal', getPeriodStart],
    ],
    [
      ['Before', getPeriodStart],
      ['Blank', () => undefined],
    ],
  ],
  [
    '<',
    [['Before', getPeriodStart]],
    [
      ['After', getPeriodStart],
      ['Equal', getPeriodStart],
      ['Blank', () => undefined],
    ],
  ],
  [
    '<=',
    [
      ['Before', getPeriodStart],
      ['Equal', getPeriodStart],
    ],
    [
      ['After', getPeriodStart],
      ['Blank', () => undefined],
    ],
  ],
];

export default function buildDateFieldFilter(
  field: string,
  filterOperators: Set<Operator>,
  searchString: string,
  isNegated: boolean,
): ConditionTree {
  if (isValidDate(searchString)) {
    const start = getPeriodStart(searchString);
    const afterEnd = getAfterPeriodEnd(searchString);

    if (
      !isNegated &&
      filterOperators.has('Equal') &&
      filterOperators.has('Before') &&
      filterOperators.has('After')
    ) {
      return ConditionTreeFactory.intersect(
        ConditionTreeFactory.union(
          new ConditionTreeLeaf(field, 'Equal', start),
          new ConditionTreeLeaf(field, 'After', start),
        ),
        new ConditionTreeLeaf(field, 'Before', afterEnd),
      );
    }

    if (
      isNegated &&
      filterOperators.has('Before') &&
      filterOperators.has('After') &&
      filterOperators.has('NotEqual') &&
      filterOperators.has('Blank')
    ) {
      return ConditionTreeFactory.union(
        new ConditionTreeLeaf(field, 'Before', start),
        new ConditionTreeLeaf(field, 'After', afterEnd),
        new ConditionTreeLeaf(field, 'Equal', afterEnd),
        new ConditionTreeLeaf(field, 'Blank'),
      );
    }

    return null;
  }

  for (const [operatorPrefix, positiveOperations, negativeOperations] of supportedOperators) {
    if (!searchString.startsWith(operatorPrefix)) continue;
    if (!isValidDate(searchString.slice(operatorPrefix.length))) continue;

    const value = searchString.slice(operatorPrefix.length);

    if (!isValidDate(value)) continue;

    const operations = isNegated ? negativeOperations : positiveOperations;

    // If blank is not supported, we try to build a condition tree anyway
    if (
      !operations
        .filter(op => op[0] !== 'Blank')
        .every(operation => filterOperators.has(operation[0]))
    ) {
      continue;
    }

    return ConditionTreeFactory.union(
      ...operations
        .filter(op => filterOperators.has(op[0]))
        .map(([operator, getDate]) => new ConditionTreeLeaf(field, operator, getDate(value))),
    );
  }

  return null;
}
