export default function normalizeName(value: string): string {
  return value.toLocaleLowerCase().replace(/[-_]/g, '');
}
