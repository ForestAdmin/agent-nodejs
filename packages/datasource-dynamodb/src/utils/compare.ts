const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

/** Orders two values, date-times by the instant they stand for rather than by their text. */
export default function compareValues(left: unknown, right: unknown): number {
  if (
    typeof left === 'string' &&
    typeof right === 'string' &&
    ISO_DATE_TIME.test(left) &&
    ISO_DATE_TIME.test(right)
  ) {
    const difference = Date.parse(left) - Date.parse(right);

    if (!Number.isNaN(difference)) return Math.sign(difference);
  }

  if (left === right) return 0;

  return (left as number) < (right as number) ? -1 : 1;
}
