import type RemoteTool from '../remote-tool';
import type { BraveConfig } from './brave/tools';

import getBraveTools from './brave/tools';

export interface IntegrationConfigs {
  brave?: BraveConfig;
}

export default function getIntegratedTools(configs: IntegrationConfigs): RemoteTool[] {
  const integratedTools: RemoteTool[] = [];

  if (configs.brave) {
    integratedTools.push(...getBraveTools(configs.brave));
  }

  return integratedTools;
}
