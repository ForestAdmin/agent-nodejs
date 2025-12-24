import type { AnyExpression } from 'mongoose';

export const FOREST_RECORD_DOES_NOT_EXIST = 'FOREST_RECORD_DOES_NOT_EXIST';
export default class ConditionGenerator {
  /**
   * Tag a record if it does not exist
   * It will replace the record with a special object that can be used to filter out records
   */
  static tagRecordIfNotExist(field: string, then: AnyExpression): AnyExpression {
    return this.ifMissing(field, then, { FOREST_RECORD_DOES_NOT_EXIST: true });
  }

  /**
   * Tag a record if it does not exist by value
   * It will replace the record with a special value that can be used to filter out records
   */
  static tagRecordIfNotExistByValue(field: string, then: AnyExpression): AnyExpression {
    return this.ifMissing(field, then, FOREST_RECORD_DOES_NOT_EXIST);
  }

  private static ifMissing(
    field: string,
    then: AnyExpression,
    elseResult: AnyExpression,
  ): AnyExpression {
    return {
      $cond: {
        if: { $and: [{ $ne: [{ $type: `$${field}` }, 'missing'] }, { $ne: [`$${field}`, null] }] },
        then,
        else: elseResult,
      },
    };
  }
}
