import { buildAgentQuery } from '../../src/agent/build-agent-query';

describe('buildAgentQuery', () => {
  it('injects the resolved timezone into the outbound agent query', () => {
    expect(buildAgentQuery({ timezone: 'America/New_York' })).toEqual({
      timezone: 'America/New_York',
    });
  });
});
