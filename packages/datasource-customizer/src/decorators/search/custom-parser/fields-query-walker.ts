import type { PropertyMatchingContext } from '../generated-parser/QueryParser';

import QueryListener from '../generated-parser/QueryListener';

export default class FieldsQueryWalker extends QueryListener {
  public fields: string[] = [];

  override enterPropertyMatching = (ctx: PropertyMatchingContext) => {
    this.fields.push(ctx.getChild(0).getText().replace(/\./g, ':'));
  };
}
