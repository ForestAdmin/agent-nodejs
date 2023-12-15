import { DefaultErrorStrategy, ErrorStrategy, Parser, RecognitionException, Token } from 'antlr4';

export default class CustomErrorStrategy extends DefaultErrorStrategy {
  override reportError(recognizer: Parser, e: RecognitionException): void {
    // We don't want console logs when parsing fails
    // Do nothing
  }
}
