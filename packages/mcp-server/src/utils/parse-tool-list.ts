import type { ToolName } from '../server';

export default function parseToolList(envValue?: string): ToolName[] | undefined {
  if (!envValue) return undefined;

  return envValue
    .split(',')
    .map(t => t.trim())
    .filter(Boolean) as ToolName[];
}
