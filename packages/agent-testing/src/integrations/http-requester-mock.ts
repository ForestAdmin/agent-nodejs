import jsonwebtoken from 'jsonwebtoken';

import { CURRENT_USER } from './forest-admin-client-mock';
import { TestableAgentOptions } from './types';
import HttpRequester from '../remote-agent-client/http-requester';

// eslint-disable-next-line import/prefer-default-export
export function createHttpRequester(
  options: {
    url: string;
    authSecret: string;
    prefix?: string;
  },
  agentOptions: TestableAgentOptions,
): HttpRequester {
  const token = jsonwebtoken.sign(CURRENT_USER, options.authSecret, { expiresIn: '1 hours' });

  return new HttpRequester(token, options, agentOptions);
}
