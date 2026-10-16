export default function escapeRegExp(value: unknown): string {
  return `${value}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
