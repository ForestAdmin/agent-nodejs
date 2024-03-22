import { AnyExpression } from 'mongoose';

export const RECORD_DOES_NOT_EXIST = 'FOREST_RECORD_DOES_NOT_EXIST';
export default class ConditionGenerator {
  static tagRecordIfNotExist(field: string, then: AnyExpression): AnyExpression {
    return {
      $cond: {
        if: { $and: [{ $ne: [{ $type: `$${field}` }, 'missing'] }, { $ne: [`$${field}`, null] }] },
        then,
        else: { [RECORD_DOES_NOT_EXIST]: true },
      },
    };
  }

  static tagRecordIfNotExistByValue(field: string, then: AnyExpression): AnyExpression {
    return {
      $cond: {
        if: { $and: [{ $ne: [{ $type: `$${field}` }, 'missing'] }, { $ne: [`$${field}`, null] }] },
        then,
        else: RECORD_DOES_NOT_EXIST,
      },
    };
  }
}
