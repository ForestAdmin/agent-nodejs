import QueryListener from '../generated-parser/QueryListener';
import { PropertyMatchingContext } from '../generated-parser/QueryParser';

export default class FieldsQueryWalker extends QueryListener {
  public fields: string[] = [];

  override enterPropertyMatching = (ctx: PropertyMatchingContext) => {
    this.fields.push(ctx.getChild(0).getText().replace(/\./g, ':'));
  };
}
