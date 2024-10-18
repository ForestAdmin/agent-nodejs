import { Operator } from '@forestadmin/datasource-toolkit';

export default class FrontendFilterableUtils {
  /**
   * Compute if a column if filterable according to forestadmin's frontend.
   *
   * @param operators list of operators that the column supports
   * @returns either if the frontend would consider this column filterable or not.
   */
  static isFilterable(operators: Set<Operator>): boolean {
    return Boolean(operators && operators.size > 0);
  }
}
