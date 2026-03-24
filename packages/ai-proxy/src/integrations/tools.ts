import type RemoteTool from '../remote-tool';
import type { BraveConfig } from './brave/tools';
import type { ZendeskConfig } from './zendesk/tools';

import getBraveTools from './brave/tools';
import getZendeskTools from './zendesk/tools';

export interface IntegrationConfigs {
  brave?: BraveConfig;
  zendesk?: ZendeskConfig;
}

export default function getIntegratedTools(configs: IntegrationConfigs): RemoteTool[] {
  const integratedTools: RemoteTool[] = [];

  if (configs.brave) {
    integratedTools.push(...getBraveTools(configs.brave));
  }

  if (configs.zendesk) {
    integratedTools.push(...getZendeskTools(configs.zendesk));
  }

  return integratedTools;
}
