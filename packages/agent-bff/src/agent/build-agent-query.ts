export interface AgentQuery {
  timezone: string;
}

export interface BuildAgentQueryParams {
  timezone: string;
}

export function buildAgentQuery({ timezone }: BuildAgentQueryParams): AgentQuery {
  return { timezone };
}
