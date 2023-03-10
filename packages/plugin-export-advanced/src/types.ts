import renderers from './renderers';

export type Options = {
  actionName?: string;
  filename?: string;
  format?: keyof typeof renderers;
  fields?: string[];
};
