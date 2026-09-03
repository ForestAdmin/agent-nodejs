import type { LoggerLevel } from '@forestadmin/datasource-toolkit';

import express from 'express';
import { tmpdir } from 'os';
import path from 'path';

import SearchDataSource from './fixtures/search-datasource';
import Agent from '../../src/agent';
import MockForestServer from '../__helper__/mock-forest-server';

const AUTH_SECRET = 'test-auth-secret-32-chars-min!!!';
const ENV_SECRET = '0'.repeat(64);
const BOOT_TIMEOUT_MS = 30_000;

function whitelistRules(useIpWhitelist: boolean) {
  return {
    data: {
      type: 'ip-whitelist-rules',
      id: '1',
      attributes: { use_ip_whitelist: useIpWhitelist, rules: [] },
    },
  };
}

/**
 * Boots an agent with an embedded BFF against an environment whose IP whitelist is on or off, and
 * returns what the agent logged while starting.
 */
async function bootAndCollectLogs(useIpWhitelist: boolean): Promise<string[]> {
  const mock = new MockForestServer();
  mock
    // Registered before the defaults: the first matching route wins.
    .get('/liana/v1/ip-whitelist-rules', whitelistRules(useIpWhitelist))
    .setupDefaultRoutes({ envSecret: ENV_SECRET, collections: [] })
    .setupSuperagentMock()
    .setupFetchMock();

  const logs: string[] = [];
  const agent = new Agent({
    authSecret: AUTH_SECRET,
    envSecret: ENV_SECRET,
    forestServerUrl: 'https://api.forestadmin.com',
    forestAppUrl: 'https://app.forestadmin.com',
    isProduction: false,
    schemaPath: path.join(tmpdir(), `.fa-whitelist-${useIpWhitelist}-${Date.now()}.json`),
    logger: (level: LoggerLevel, message: string) => logs.push(`${level}: ${message}`),
  })
    .addDataSource(async () => new SearchDataSource())
    .addBff({});

  agent.mountOnExpress(express());

  try {
    await agent.start();

    return logs;
  } finally {
    await agent.stop();
    mock.restore();
  }
}

describe('embedded BFF against the IP whitelist', () => {
  const mentionsTheExemption = (logs: string[]) =>
    logs.filter(line => line.startsWith('Warn') && line.includes('IP whitelist is enabled'));

  describe('when the environment has the whitelist enabled', () => {
    // The exemption is deliberate, so the only thing that can go wrong is nobody knowing about it.
    it(
      'should warn at startup that BFF requests are not subject to it',
      async () => {
        const logs = await bootAndCollectLogs(true);
        const [warning, ...others] = mentionsTheExemption(logs);

        expect(warning).toBeDefined();
        expect(warning).toContain('/bff');
        expect(warning).toContain('in-process');
        // Says what still protects the route, so the warning cannot be read as "the BFF is open".
        expect(warning).toContain('API key or a valid OAuth session is still required');
        expect(others).toHaveLength(0);
      },
      BOOT_TIMEOUT_MS,
    );
  });

  describe('when the environment has no whitelist', () => {
    it(
      'should stay quiet, since there is no expectation to correct',
      async () => {
        const logs = await bootAndCollectLogs(false);

        expect(mentionsTheExemption(logs)).toHaveLength(0);
      },
      BOOT_TIMEOUT_MS,
    );
  });
});
