import { DefaultErrorStrategy } from 'antlr4';

export default class CustomErrorStrategy extends DefaultErrorStrategy {
  override reportError(): void {
    // We don't want console logs when parsing fails
    // Do nothing
  }
}
