import QueryListener from '../generated-parser/QueryListener';
import {
  NegatedContext,
  OrContext,
  PropertyMatchingContext,
  QueryContext,
  QuotedContext,
  WordContext,
} from '../generated-parser/queryParser';
import { ColumnSchema, ConditionTree, ConditionTreeFactory } from '@forestadmin/datasource-toolkit';
import buildFieldFilter from '../filter-builder/build-field-filter';

export default class ConditionTreeQueryWalker extends QueryListener {
  private parentStack: ConditionTree[][] = [];
  private currentField: string = null;
  private isNegated: boolean = false;

  get conditionTree(): ConditionTree {
    if (this.parentStack.length !== 1 && this.parentStack[0].length !== 1) {
      throw new Error('Invalid condition tree');
    }

    return this.parentStack[0][0];
  }

  constructor(private readonly fields: [string, ColumnSchema][]) {
    super();
  }

  public generateDefaultFilter(searchQuery: string): ConditionTree {
    return this.buildDefaultCondition(searchQuery, this.isNegated);
  }

  override enterQuery = (ctx: QueryContext) => {
    this.parentStack.push([]);
  };

  override exitQuery = (ctx: QueryContext) => {
    const rules = this.parentStack.pop();
    if (!rules) {
      this.parentStack.push([null]);
      return;
    }

    if (rules.length === 1) {
      this.parentStack.push(rules);
    } else {
      this.parentStack.push([ConditionTreeFactory.intersect(...rules)]);
    }
  };

  override exitQuoted = (ctx: QuotedContext) => {
    const current = this.parentStack[this.parentStack.length - 1];

    current.push(this.buildDefaultCondition(ctx.getText().slice(1, -1), this.isNegated));
  };

  override enterNegated = (ctx: NegatedContext) => {
    this.parentStack.push([]);
    this.isNegated = true;
  };

  override exitNegated = (ctx: NegatedContext) => {
    const text = ctx.getText();
    const rules = this.parentStack.pop();

    if (!rules) return;

    let result: ConditionTree;

    if (!Number.isNaN(Number(text)) && rules.length === 1) {
      result = this.buildDefaultCondition(text, false);
    } else {
      result = ConditionTreeFactory.intersect(...rules.filter(Boolean));
    }

    const parentRules = this.parentStack[this.parentStack.length - 1];
    if (parentRules) {
      parentRules.push(result);
    } else {
      this.parentStack.push([result]);
    }

    this.isNegated = false;
  };

  override exitWord = (ctx: WordContext) => {
    const current = this.parentStack[this.parentStack.length - 1];

    current.push(this.buildDefaultCondition(ctx.getText(), this.isNegated));
  };

  override enterPropertyMatching = (ctx: PropertyMatchingContext) => {
    this.currentField = ctx.getChild(0).getText().replace(/\./g, ':');
  };

  override exitPropertyMatching = (ctx: PropertyMatchingContext) => {
    this.currentField = null;
  };

  override enterOr = (ctx: OrContext) => {
    this.parentStack.push([]);
  };

  override exitOr = (ctx: OrContext) => {
    const rules = this.parentStack.pop();
    if (!rules.length) return;

    const parentRules = this.parentStack[this.parentStack.length - 1];
    if (rules.length === 1) {
      parentRules.push(...rules);
    } else {
      parentRules.push(ConditionTreeFactory.union(...rules));
    }
  };

  private buildDefaultCondition(searchString: string, isNegated: boolean): ConditionTree {
    const targetedFields =
      this.currentField &&
      this.fields.filter(
        ([field]) => field.toLocaleLowerCase() === this.currentField.trim().toLocaleLowerCase(),
      );

    let rules: ConditionTree[] = [];

    if (!targetedFields?.length) {
      rules = this.fields.map(([field, schema]) =>
        buildFieldFilter(
          field,
          schema,
          this.currentField ? `${this.currentField}:${searchString}` : searchString,
          isNegated,
        ),
      );
    } else {
      rules = targetedFields.map(([field, schema]) =>
        buildFieldFilter(field, schema, searchString, isNegated),
      );
    }

    if (!rules.some(Boolean)) return null;

    return isNegated
      ? ConditionTreeFactory.intersect(...rules)
      : ConditionTreeFactory.union(...rules);
  }
}
