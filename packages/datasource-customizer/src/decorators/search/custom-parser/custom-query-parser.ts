import QueryParser from '../generated-parser/queryParser';
import CustomErrorStrategy from './custom-error-strategy';

export default class CustomQueryParser extends QueryParser {
  override _errHandler = new CustomErrorStrategy();
}
