import CustomErrorStrategy from './custom-error-strategy';
import QueryParser from '../generated-parser/QueryParser';

export default class CustomQueryParser extends QueryParser {
  override _errHandler = new CustomErrorStrategy();
}
