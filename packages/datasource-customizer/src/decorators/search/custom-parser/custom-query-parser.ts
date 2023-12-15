import CustomErrorStrategy from './custom-error-strategy';
import QueryParser from '../generated-parser/queryParser';

export default class CustomQueryParser extends QueryParser {
  override _errHandler = new CustomErrorStrategy();
}
