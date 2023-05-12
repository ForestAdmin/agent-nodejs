export default class ContextVariablesInjector {
  static injectContext(target: unknown, context: Record<string, unknown>): unknown {
    if (Array.isArray(target)) {
      return target.map(item => this.injectContext(item, context));
    }

    if (target?.constructor === Object) {
      return Object.fromEntries(
        Object.entries(target).map(([key, value]) => [key, this.injectContext(value, context)]),
      );
    }

    if (typeof target === 'string') {
      // If the whole string is a template, return the value directly to keep the type.
      if (target.match(/^{{([^}]+)}}$/)) {
        return this.getValueFromContext(target.substring(2, target.length - 2), context);
      }

      // Otherwise, replace all the templates in the string.
      return target.replace(/{{([^}]+)}}/g, (match, key) =>
        String(this.getValueFromContext(key, context)),
      );
    }

    return target;
  }

  private static getValueFromContext(key: string, context: Record<string, unknown>): unknown {
    let value = context;
    for (const part of key.split('.')) value = value?.[part] as Record<string, unknown>;

    return value;
  }
}
