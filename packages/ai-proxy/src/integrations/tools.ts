import type RemoteTool from '../remote-tool';
import type { BraveConfig } from './brave/tools';
import type { GmailConfig } from './gmail/tools';
import type { SlackConfig } from './slack/tools';
import type { ZendeskConfig } from './zendesk/tools';

import getBraveTools from './brave/tools';
import getGmailTools from './gmail/tools';
import getSlackTools from './slack/tools';
import getZendeskTools from './zendesk/tools';

export interface IntegrationConfigs {
  brave?: BraveConfig;
  gmail?: GmailConfig;
  slack?: SlackConfig;
  zendesk?: ZendeskConfig;
}

export default function getIntegratedTools(configs: IntegrationConfigs): RemoteTool[] {
  const integratedTools: RemoteTool[] = [];

  if (configs.brave) {
    integratedTools.push(...getBraveTools(configs.brave));
  }

  if (configs.gmail) {
    integratedTools.push(...getGmailTools(configs.gmail));
  }

  if (configs.slack) {
    integratedTools.push(...getSlackTools(configs.slack));
  }

  if (configs.zendesk) {
    integratedTools.push(...getZendeskTools(configs.zendesk));
  }

  return integratedTools;
}
