import type { Agent } from '../types';

import { CustomizationError } from '../errors';

export default function loadCustomization(agent: Agent, builtCodePath: string): void {
  // eslint-disable-next-line
  const customization = require(builtCodePath);
  const entryPoint = customization?.default || customization;

  if (typeof entryPoint !== 'function') {
    throw new CustomizationError('Customization file must export a function');
  }

  try {
    entryPoint(agent);
  } catch (error) {
    throw new CustomizationError(
      `Issue with customizations: ${error.name}\n${error.message}`,
      error.stack,
    );
  }
}
