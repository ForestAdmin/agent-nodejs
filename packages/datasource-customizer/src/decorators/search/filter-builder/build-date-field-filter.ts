/* eslint-disable no-continue */
import {
  ConditionTree,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  Operator,
} from '@forestadmin/datasource-toolkit';

import buildDefaultCondition from './utils/build-default-condition';

function isYear(str: string): boolean {
  return (
    /^\d{4}$/.test(str) && Number(str) >= 1800 && Number(str) <= new Date().getFullYear() + 100
  );
}

function isYearMonth(str: string): boolean {
  return /^(\d{4})-(\d{1,2})$/.test(str) && !Number.isNaN(Date.parse(`${str}-01`));
}

function isPlainDate(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !Number.isNaN(Date.parse(str));
}

function isValidDate(str: string): boolean {
  return isYear(str) || isYearMonth(str) || isPlainDate(str);
}

function getPeriodStart(string): string {
  if (isYear(string)) return `${string}-01-01`;
  if (isYearMonth(string)) return `${string}-01`;

  return string;
}

function pad(month: number) {
  if (month < 10) {
    return `0${month}`;
  }

  return `${month}`;
}

function getAfterPeriodEnd(string): string {
  if (isYear(string)) return `${Number(string) + 1}-01-01`;

  if (isYearMonth(string)) {
    const [year, month] = string.split('-').map(Number);
    const endDate = new Date(year, month, 1);

    return `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-01`;
  }

  const date = new Date(string);
  date.setDate(date.getDate() + 1);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
    [
      ['Before', getPeriodStart],
      ['Equal', getPeriodStart],
      ['Missing', () => undefined],
    ],
  ],
  [
    '>=',
    [
      ['After', getPeriodStart],
      ['Equal', getPeriodStart],
    ],
    [
      ['Before', getPeriodStart],
      ['Missing', () => undefined],
    ],
  ],
  [
    '≥',
    [
      ['After', getPeriodStart],
      ['Equal', getPeriodStart],
    ],
    [
      ['Before', getPeriodStart],
      ['Missing', () => undefined],
    ],
  ],
  [
    '<',
    [['Before', getPeriodStart]],
    [
      ['After', getPeriodStart],
      ['Equal', getPeriodStart],
      ['Missing', () => undefined],
    ],
  ],
  [
    '<=',
    [['Before', getAfterPeriodEnd]],
    [
      ['After', getAfterPeriodEnd],
      ['Equal', getAfterPeriodEnd],
      ['Missing', () => undefined],
    ],
  ],
  [
    '≤',
    [['Before', getAfterPeriodEnd]],
    [
      ['After', getAfterPeriodEnd],
      ['Equal', getAfterPeriodEnd],
      ['Missing', () => undefined],
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
      filterOperators.has('Equal')
    ) {
      if (filterOperators.has('Missing')) {
        return ConditionTreeFactory.union(
          new ConditionTreeLeaf(field, 'Before', start),
          new ConditionTreeLeaf(field, 'After', afterEnd),
          new ConditionTreeLeaf(field, 'Equal', afterEnd),
          new ConditionTreeLeaf(field, 'Missing'),
        );
      }

      return ConditionTreeFactory.union(
        new ConditionTreeLeaf(field, 'Before', start),
        new ConditionTreeLeaf(field, 'After', afterEnd),
        new ConditionTreeLeaf(field, 'Equal', afterEnd),
      );
    }

    return buildDefaultCondition(isNegated);
  }

  for (const [operatorPrefix, positiveOperations, negativeOperations] of supportedOperators) {
    if (!searchString.startsWith(operatorPrefix)) continue;
    if (!isValidDate(searchString.slice(operatorPrefix.length))) continue;

    const value = searchString.slice(operatorPrefix.length);

    if (!isValidDate(value)) continue;

    const operations = isNegated ? negativeOperations : positiveOperations;

    // If Missing is not supported, we try to build a condition tree anyway
    if (
      !operations
        .filter(op => op[0] !== 'Missing')
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

  return buildDefaultCondition(isNegated);
}
