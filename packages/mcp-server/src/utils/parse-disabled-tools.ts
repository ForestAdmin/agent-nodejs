import type { ToolName } from '../server';

export default function parseDisabledTools(envValue?: string): ToolName[] | undefined {
  if (!envValue) return undefined;

  return envValue
    .split(',')
    .map(t => t.trim())
    .filter(Boolean) as ToolName[];
}
