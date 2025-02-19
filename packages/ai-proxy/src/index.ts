import Proxy from './proxy';

export type ForestAIProxy = Proxy;
export { ProxyOpenAIOptions } from './proxy';

export function createForestAIProxy() {
  return new Proxy();
}
