import type {
  NegatedContext,
  PropertyMatchingContext,
  QuotedContext,
  WordContext,
} from '../generated-parser/QueryParser';
import type { Caller, ColumnSchema, ConditionTree } from '@forestadmin/datasource-toolkit';

import { ConditionTreeFactory } from '@forestadmin/datasource-toolkit';

import buildFieldFilter from '../filter-builder/index';
import QueryListener from '../generated-parser/QueryListener';
import normalizeName from '../normalize-name';

export default class ConditionTreeQueryWalker extends QueryListener {
  private parentStack: ConditionTree[][] = [];
  private currentField: string = null;
  private isNegated = false;

  get conditionTree(): ConditionTree {
    if (this.parentStack.length !== 1 && this.parentStack[0].length !== 1) {
      throw new Error('Invalid condition tree');
    }

    return this.parentStack[0][0];
  }

  constructor(private readonly caller: Caller, private readonly fields: [string, ColumnSchema][]) {
    super();
  }

  public generateDefaultFilter(searchQuery: string): ConditionTree {
    return this.buildDefaultCondition(searchQuery, this.isNegated);
  }

  override enterQuery = () => {
    this.parentStack.push([]);
  };

  override exitQuery = () => {
    const rules = this.parentStack.pop();

    if (!rules) {
      throw new Error('Empty query');
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

  override enterNegated = () => {
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
      // We should at least have an array for the root query
      throw new Error('Empty stack');
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

  override exitPropertyMatching = () => {
    this.currentField = null;
  };

  override enterOr = () => {
    this.parentStack.push([]);
  };

  override exitOr = () => {
    const rules = this.parentStack.pop();
    if (!rules.length) return;

    const parentRules = this.parentStack[this.parentStack.length - 1];

    parentRules.push(ConditionTreeFactory.union(...rules));
  };

  override enterAnd = () => {
    this.parentStack.push([]);
  };

  override exitAnd = () => {
    const rules = this.parentStack.pop();
    if (!rules.length) return;

    const parentRules = this.parentStack[this.parentStack.length - 1];

    parentRules.push(ConditionTreeFactory.intersect(...rules));
  };

  private buildDefaultCondition(searchString: string, isNegated: boolean): ConditionTree {
    const targetedFields =
      this.currentField &&
      this.fields.filter(([field]) => normalizeName(field) === normalizeName(this.currentField));

    let rules: ConditionTree[] = [];

    if (!targetedFields?.length) {
      rules = this.fields.map(([field, schema]) =>
        buildFieldFilter(
          this.caller,
          field,
          schema,
          // If targetFields is empty, it means that the query is not targeting a specific field
          // OR that the field is not found in the schema. If it's the case, we are re-constructing
          // the original query by adding the field name in front of the search string.
          this.currentField ? `${this.currentField}:${searchString}` : searchString,
          isNegated,
        ),
      );
    } else {
      rules = targetedFields.map(([field, schema]) =>
        buildFieldFilter(this.caller, field, schema, searchString, isNegated),
      );
    }

    if (!rules.some(Boolean)) return null;

    return isNegated
      ? ConditionTreeFactory.intersect(...rules)
      : ConditionTreeFactory.union(...rules);
  }
}
