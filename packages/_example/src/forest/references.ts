const SEQUENCE_DIGITS = 6;
const SEQUENCE_MODULO = 10 ** SEQUENCE_DIGITS;

export default function newReference(prefix: string, now = new Date()): string {
  const sequence = String(now.getTime() % SEQUENCE_MODULO).padStart(SEQUENCE_DIGITS, '0');

  return `${prefix}-${now.getFullYear()}-${sequence}`;
}
