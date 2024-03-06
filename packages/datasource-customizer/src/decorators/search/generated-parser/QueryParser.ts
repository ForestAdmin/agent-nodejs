// Generated from src/decorators/search/Query.g4 by ANTLR 4.13.1
// noinspection ES6UnusedImports,JSUnusedGlobalSymbols,JSUnusedLocalSymbols

import {
  ATN,
  ATNDeserializer,
  DecisionState,
  DFA,
  FailedPredicateException,
  RecognitionException,
  NoViableAltException,
  BailErrorStrategy,
  Parser,
  ParserATNSimulator,
  RuleContext,
  ParserRuleContext,
  PredictionMode,
  PredictionContextCache,
  TerminalNode,
  RuleNode,
  Token,
  TokenStream,
  Interval,
  IntervalSet,
} from 'antlr4';
import QueryListener from './QueryListener.js';
// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;

export default class QueryParser extends Parser {
  public static readonly T__0 = 1;
  public static readonly PARENS_OPEN = 2;
  public static readonly PARENS_CLOSE = 3;
  public static readonly OR = 4;
  public static readonly AND = 5;
  public static readonly SINGLE_QUOTED = 6;
  public static readonly DOUBLE_QUOTED = 7;
  public static readonly NEGATION = 8;
  public static readonly TOKEN = 9;
  public static readonly SEPARATOR = 10;
  public static readonly SPACING = 11;
  public static override readonly EOF = Token.EOF;
  public static readonly RULE_query = 0;
  public static readonly RULE_parenthesized = 1;
  public static readonly RULE_or = 2;
  public static readonly RULE_and = 3;
  public static readonly RULE_queryToken = 4;
  public static readonly RULE_quoted = 5;
  public static readonly RULE_negated = 6;
  public static readonly RULE_propertyMatching = 7;
  public static readonly RULE_name = 8;
  public static readonly RULE_value = 9;
  public static readonly RULE_word = 10;
  public static readonly literalNames: (string | null)[] = [
    null,
    "':'",
    null,
    null,
    "'OR'",
    "'AND'",
    null,
    null,
    "'-'",
  ];
  public static readonly symbolicNames: (string | null)[] = [
    null,
    null,
    'PARENS_OPEN',
    'PARENS_CLOSE',
    'OR',
    'AND',
    'SINGLE_QUOTED',
    'DOUBLE_QUOTED',
    'NEGATION',
    'TOKEN',
    'SEPARATOR',
    'SPACING',
  ];
  // tslint:disable:no-trailing-whitespace
  public static readonly ruleNames: string[] = [
    'query',
    'parenthesized',
    'or',
    'and',
    'queryToken',
    'quoted',
    'negated',
    'propertyMatching',
    'name',
    'value',
    'word',
  ];
  public get grammarFileName(): string {
    return 'Query.g4';
  }
  public get literalNames(): (string | null)[] {
    return QueryParser.literalNames;
  }
  public get symbolicNames(): (string | null)[] {
    return QueryParser.symbolicNames;
  }
  public get ruleNames(): string[] {
    return QueryParser.ruleNames;
  }
  public get serializedATN(): number[] {
    return QueryParser._serializedATN;
  }

  protected createFailedPredicateException(
    predicate?: string,
    message?: string,
  ): FailedPredicateException {
    return new FailedPredicateException(this, predicate, message);
  }

  constructor(input: TokenStream) {
    super(input);
    this._interp = new ParserATNSimulator(
      this,
      QueryParser._ATN,
      QueryParser.DecisionsToDFA,
      new PredictionContextCache(),
    );
  }
  // @RuleVersion(0)
  public query(): QueryContext {
    let localctx: QueryContext = new QueryContext(this, this._ctx, this.state);
    this.enterRule(localctx, 0, QueryParser.RULE_query);
    try {
      this.enterOuterAlt(localctx, 1);
      {
        this.state = 26;
        this._errHandler.sync(this);
        switch (this._interp.adaptivePredict(this._input, 0, this._ctx)) {
          case 1:
            {
              this.state = 22;
              this.and();
            }
            break;
          case 2:
            {
              this.state = 23;
              this.or();
            }
            break;
          case 3:
            {
              this.state = 24;
              this.queryToken();
            }
            break;
          case 4:
            {
              this.state = 25;
              this.parenthesized();
            }
            break;
        }
        this.state = 28;
        this.match(QueryParser.EOF);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localctx;
  }
  // @RuleVersion(0)
  public parenthesized(): ParenthesizedContext {
    let localctx: ParenthesizedContext = new ParenthesizedContext(this, this._ctx, this.state);
    this.enterRule(localctx, 2, QueryParser.RULE_parenthesized);
    try {
      this.enterOuterAlt(localctx, 1);
      {
        this.state = 30;
        this.match(QueryParser.PARENS_OPEN);
        this.state = 33;
        this._errHandler.sync(this);
        switch (this._interp.adaptivePredict(this._input, 1, this._ctx)) {
          case 1:
            {
              this.state = 31;
              this.or();
            }
            break;
          case 2:
            {
              this.state = 32;
              this.and();
            }
            break;
        }
        this.state = 35;
        this.match(QueryParser.PARENS_CLOSE);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localctx;
  }
  // @RuleVersion(0)
  public or(): OrContext {
    let localctx: OrContext = new OrContext(this, this._ctx, this.state);
    this.enterRule(localctx, 4, QueryParser.RULE_or);
    let _la: number;
    try {
      this.enterOuterAlt(localctx, 1);
      {
        this.state = 40;
        this._errHandler.sync(this);
        switch (this._interp.adaptivePredict(this._input, 2, this._ctx)) {
          case 1:
            {
              this.state = 37;
              this.and();
            }
            break;
          case 2:
            {
              this.state = 38;
              this.queryToken();
            }
            break;
          case 3:
            {
              this.state = 39;
              this.parenthesized();
            }
            break;
        }
        this.state = 50;
        this._errHandler.sync(this);
        _la = this._input.LA(1);
        do {
          {
            {
              this.state = 42;
              this.match(QueryParser.SEPARATOR);
              this.state = 43;
              this.match(QueryParser.OR);
              this.state = 44;
              this.match(QueryParser.SEPARATOR);
              this.state = 48;
              this._errHandler.sync(this);
              switch (this._interp.adaptivePredict(this._input, 3, this._ctx)) {
                case 1:
                  {
                    this.state = 45;
                    this.and();
                  }
                  break;
                case 2:
                  {
                    this.state = 46;
                    this.queryToken();
                  }
                  break;
                case 3:
                  {
                    this.state = 47;
                    this.parenthesized();
                  }
                  break;
              }
            }
          }
          this.state = 52;
          this._errHandler.sync(this);
          _la = this._input.LA(1);
        } while (_la === 10);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localctx;
  }
  // @RuleVersion(0)
  public and(): AndContext {
    let localctx: AndContext = new AndContext(this, this._ctx, this.state);
    this.enterRule(localctx, 6, QueryParser.RULE_and);
    let _la: number;
    try {
      let _alt: number;
      this.enterOuterAlt(localctx, 1);
      {
        this.state = 56;
        this._errHandler.sync(this);
        switch (this._input.LA(1)) {
          case 6:
          case 7:
          case 8:
          case 9:
            {
              this.state = 54;
              this.queryToken();
            }
            break;
          case 2:
            {
              this.state = 55;
              this.parenthesized();
            }
            break;
          default:
            throw new NoViableAltException(this);
        }
        this.state = 67;
        this._errHandler.sync(this);
        _alt = 1;
        do {
          switch (_alt) {
            case 1:
              {
                {
                  this.state = 58;
                  this.match(QueryParser.SEPARATOR);
                  this.state = 61;
                  this._errHandler.sync(this);
                  _la = this._input.LA(1);
                  if (_la === 5) {
                    {
                      this.state = 59;
                      this.match(QueryParser.AND);
                      this.state = 60;
                      this.match(QueryParser.SEPARATOR);
                    }
                  }

                  this.state = 65;
                  this._errHandler.sync(this);
                  switch (this._input.LA(1)) {
                    case 6:
                    case 7:
                    case 8:
                    case 9:
                      {
                        this.state = 63;
                        this.queryToken();
                      }
                      break;
                    case 2:
                      {
                        this.state = 64;
                        this.parenthesized();
                      }
                      break;
                    default:
                      throw new NoViableAltException(this);
                  }
                }
              }
              break;
            default:
              throw new NoViableAltException(this);
          }
          this.state = 69;
          this._errHandler.sync(this);
          _alt = this._interp.adaptivePredict(this._input, 8, this._ctx);
        } while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localctx;
  }
  // @RuleVersion(0)
  public queryToken(): QueryTokenContext {
    let localctx: QueryTokenContext = new QueryTokenContext(this, this._ctx, this.state);
    this.enterRule(localctx, 8, QueryParser.RULE_queryToken);
    try {
      this.enterOuterAlt(localctx, 1);
      {
        this.state = 75;
        this._errHandler.sync(this);
        switch (this._interp.adaptivePredict(this._input, 9, this._ctx)) {
          case 1:
            {
              this.state = 71;
              this.quoted();
            }
            break;
          case 2:
            {
              this.state = 72;
              this.negated();
            }
            break;
          case 3:
            {
              this.state = 73;
              this.propertyMatching();
            }
            break;
          case 4:
            {
              this.state = 74;
              this.word();
            }
            break;
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localctx;
  }
  // @RuleVersion(0)
  public quoted(): QuotedContext {
    let localctx: QuotedContext = new QuotedContext(this, this._ctx, this.state);
    this.enterRule(localctx, 10, QueryParser.RULE_quoted);
    let _la: number;
    try {
      this.enterOuterAlt(localctx, 1);
      {
        this.state = 77;
        _la = this._input.LA(1);
        if (!(_la === 6 || _la === 7)) {
          this._errHandler.recoverInline(this);
        } else {
          this._errHandler.reportMatch(this);
          this.consume();
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localctx;
  }
  // @RuleVersion(0)
  public negated(): NegatedContext {
    let localctx: NegatedContext = new NegatedContext(this, this._ctx, this.state);
    this.enterRule(localctx, 12, QueryParser.RULE_negated);
    try {
      this.enterOuterAlt(localctx, 1);
      {
        this.state = 79;
        this.match(QueryParser.NEGATION);
        this.state = 83;
        this._errHandler.sync(this);
        switch (this._interp.adaptivePredict(this._input, 10, this._ctx)) {
          case 1:
            {
              this.state = 80;
              this.word();
            }
            break;
          case 2:
            {
              this.state = 81;
              this.quoted();
            }
            break;
          case 3:
            {
              this.state = 82;
              this.propertyMatching();
            }
            break;
        }
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localctx;
  }
  // @RuleVersion(0)
  public propertyMatching(): PropertyMatchingContext {
    let localctx: PropertyMatchingContext = new PropertyMatchingContext(
      this,
      this._ctx,
      this.state,
    );
    this.enterRule(localctx, 14, QueryParser.RULE_propertyMatching);
    try {
      this.enterOuterAlt(localctx, 1);
      {
        this.state = 85;
        this.name();
        this.state = 86;
        this.match(QueryParser.T__0);
        this.state = 87;
        this.value();
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localctx;
  }
  // @RuleVersion(0)
  public name(): NameContext {
    let localctx: NameContext = new NameContext(this, this._ctx, this.state);
    this.enterRule(localctx, 16, QueryParser.RULE_name);
    try {
      this.enterOuterAlt(localctx, 1);
      {
        this.state = 89;
        this.match(QueryParser.TOKEN);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localctx;
  }
  // @RuleVersion(0)
  public value(): ValueContext {
    let localctx: ValueContext = new ValueContext(this, this._ctx, this.state);
    this.enterRule(localctx, 18, QueryParser.RULE_value);
    try {
      this.state = 93;
      this._errHandler.sync(this);
      switch (this._input.LA(1)) {
        case 9:
          this.enterOuterAlt(localctx, 1);
          {
            this.state = 91;
            this.word();
          }
          break;
        case 6:
        case 7:
          this.enterOuterAlt(localctx, 2);
          {
            this.state = 92;
            this.quoted();
          }
          break;
        default:
          throw new NoViableAltException(this);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localctx;
  }
  // @RuleVersion(0)
  public word(): WordContext {
    let localctx: WordContext = new WordContext(this, this._ctx, this.state);
    this.enterRule(localctx, 20, QueryParser.RULE_word);
    try {
      this.enterOuterAlt(localctx, 1);
      {
        this.state = 95;
        this.match(QueryParser.TOKEN);
      }
    } catch (re) {
      if (re instanceof RecognitionException) {
        localctx.exception = re;
        this._errHandler.reportError(this, re);
        this._errHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localctx;
  }

  public static readonly _serializedATN: number[] = [
    4, 1, 11, 98, 2, 0, 7, 0, 2, 1, 7, 1, 2, 2, 7, 2, 2, 3, 7, 3, 2, 4, 7, 4, 2, 5, 7, 5, 2, 6, 7,
    6, 2, 7, 7, 7, 2, 8, 7, 8, 2, 9, 7, 9, 2, 10, 7, 10, 1, 0, 1, 0, 1, 0, 1, 0, 3, 0, 27, 8, 0, 1,
    0, 1, 0, 1, 1, 1, 1, 1, 1, 3, 1, 34, 8, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 2, 3, 2, 41, 8, 2, 1, 2,
    1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 3, 2, 49, 8, 2, 4, 2, 51, 8, 2, 11, 2, 12, 2, 52, 1, 3, 1, 3, 3,
    3, 57, 8, 3, 1, 3, 1, 3, 1, 3, 3, 3, 62, 8, 3, 1, 3, 1, 3, 3, 3, 66, 8, 3, 4, 3, 68, 8, 3, 11,
    3, 12, 3, 69, 1, 4, 1, 4, 1, 4, 1, 4, 3, 4, 76, 8, 4, 1, 5, 1, 5, 1, 6, 1, 6, 1, 6, 1, 6, 3, 6,
    84, 8, 6, 1, 7, 1, 7, 1, 7, 1, 7, 1, 8, 1, 8, 1, 9, 1, 9, 3, 9, 94, 8, 9, 1, 10, 1, 10, 1, 10,
    0, 0, 11, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 0, 1, 1, 0, 6, 7, 105, 0, 26, 1, 0, 0, 0, 2,
    30, 1, 0, 0, 0, 4, 40, 1, 0, 0, 0, 6, 56, 1, 0, 0, 0, 8, 75, 1, 0, 0, 0, 10, 77, 1, 0, 0, 0, 12,
    79, 1, 0, 0, 0, 14, 85, 1, 0, 0, 0, 16, 89, 1, 0, 0, 0, 18, 93, 1, 0, 0, 0, 20, 95, 1, 0, 0, 0,
    22, 27, 3, 6, 3, 0, 23, 27, 3, 4, 2, 0, 24, 27, 3, 8, 4, 0, 25, 27, 3, 2, 1, 0, 26, 22, 1, 0, 0,
    0, 26, 23, 1, 0, 0, 0, 26, 24, 1, 0, 0, 0, 26, 25, 1, 0, 0, 0, 27, 28, 1, 0, 0, 0, 28, 29, 5, 0,
    0, 1, 29, 1, 1, 0, 0, 0, 30, 33, 5, 2, 0, 0, 31, 34, 3, 4, 2, 0, 32, 34, 3, 6, 3, 0, 33, 31, 1,
    0, 0, 0, 33, 32, 1, 0, 0, 0, 34, 35, 1, 0, 0, 0, 35, 36, 5, 3, 0, 0, 36, 3, 1, 0, 0, 0, 37, 41,
    3, 6, 3, 0, 38, 41, 3, 8, 4, 0, 39, 41, 3, 2, 1, 0, 40, 37, 1, 0, 0, 0, 40, 38, 1, 0, 0, 0, 40,
    39, 1, 0, 0, 0, 41, 50, 1, 0, 0, 0, 42, 43, 5, 10, 0, 0, 43, 44, 5, 4, 0, 0, 44, 48, 5, 10, 0,
    0, 45, 49, 3, 6, 3, 0, 46, 49, 3, 8, 4, 0, 47, 49, 3, 2, 1, 0, 48, 45, 1, 0, 0, 0, 48, 46, 1, 0,
    0, 0, 48, 47, 1, 0, 0, 0, 49, 51, 1, 0, 0, 0, 50, 42, 1, 0, 0, 0, 51, 52, 1, 0, 0, 0, 52, 50, 1,
    0, 0, 0, 52, 53, 1, 0, 0, 0, 53, 5, 1, 0, 0, 0, 54, 57, 3, 8, 4, 0, 55, 57, 3, 2, 1, 0, 56, 54,
    1, 0, 0, 0, 56, 55, 1, 0, 0, 0, 57, 67, 1, 0, 0, 0, 58, 61, 5, 10, 0, 0, 59, 60, 5, 5, 0, 0, 60,
    62, 5, 10, 0, 0, 61, 59, 1, 0, 0, 0, 61, 62, 1, 0, 0, 0, 62, 65, 1, 0, 0, 0, 63, 66, 3, 8, 4, 0,
    64, 66, 3, 2, 1, 0, 65, 63, 1, 0, 0, 0, 65, 64, 1, 0, 0, 0, 66, 68, 1, 0, 0, 0, 67, 58, 1, 0, 0,
    0, 68, 69, 1, 0, 0, 0, 69, 67, 1, 0, 0, 0, 69, 70, 1, 0, 0, 0, 70, 7, 1, 0, 0, 0, 71, 76, 3, 10,
    5, 0, 72, 76, 3, 12, 6, 0, 73, 76, 3, 14, 7, 0, 74, 76, 3, 20, 10, 0, 75, 71, 1, 0, 0, 0, 75,
    72, 1, 0, 0, 0, 75, 73, 1, 0, 0, 0, 75, 74, 1, 0, 0, 0, 76, 9, 1, 0, 0, 0, 77, 78, 7, 0, 0, 0,
    78, 11, 1, 0, 0, 0, 79, 83, 5, 8, 0, 0, 80, 84, 3, 20, 10, 0, 81, 84, 3, 10, 5, 0, 82, 84, 3,
    14, 7, 0, 83, 80, 1, 0, 0, 0, 83, 81, 1, 0, 0, 0, 83, 82, 1, 0, 0, 0, 84, 13, 1, 0, 0, 0, 85,
    86, 3, 16, 8, 0, 86, 87, 5, 1, 0, 0, 87, 88, 3, 18, 9, 0, 88, 15, 1, 0, 0, 0, 89, 90, 5, 9, 0,
    0, 90, 17, 1, 0, 0, 0, 91, 94, 3, 20, 10, 0, 92, 94, 3, 10, 5, 0, 93, 91, 1, 0, 0, 0, 93, 92, 1,
    0, 0, 0, 94, 19, 1, 0, 0, 0, 95, 96, 5, 9, 0, 0, 96, 21, 1, 0, 0, 0, 12, 26, 33, 40, 48, 52, 56,
    61, 65, 69, 75, 83, 93,
  ];

  private static __ATN: ATN;
  public static get _ATN(): ATN {
    if (!QueryParser.__ATN) {
      QueryParser.__ATN = new ATNDeserializer().deserialize(QueryParser._serializedATN);
    }

    return QueryParser.__ATN;
  }

  static DecisionsToDFA = QueryParser._ATN.decisionToState.map(
    (ds: DecisionState, index: number) => new DFA(ds, index),
  );
}

export class QueryContext extends ParserRuleContext {
  constructor(parser?: QueryParser, parent?: ParserRuleContext, invokingState?: number) {
    super(parent, invokingState);
    this.parser = parser;
  }
  public EOF(): TerminalNode {
    return this.getToken(QueryParser.EOF, 0);
  }
  public and(): AndContext {
    return this.getTypedRuleContext(AndContext, 0) as AndContext;
  }
  public or(): OrContext {
    return this.getTypedRuleContext(OrContext, 0) as OrContext;
  }
  public queryToken(): QueryTokenContext {
    return this.getTypedRuleContext(QueryTokenContext, 0) as QueryTokenContext;
  }
  public parenthesized(): ParenthesizedContext {
    return this.getTypedRuleContext(ParenthesizedContext, 0) as ParenthesizedContext;
  }
  public get ruleIndex(): number {
    return QueryParser.RULE_query;
  }
  public enterRule(listener: QueryListener): void {
    if (listener.enterQuery) {
      listener.enterQuery(this);
    }
  }
  public exitRule(listener: QueryListener): void {
    if (listener.exitQuery) {
      listener.exitQuery(this);
    }
  }
}

export class ParenthesizedContext extends ParserRuleContext {
  constructor(parser?: QueryParser, parent?: ParserRuleContext, invokingState?: number) {
    super(parent, invokingState);
    this.parser = parser;
  }
  public PARENS_OPEN(): TerminalNode {
    return this.getToken(QueryParser.PARENS_OPEN, 0);
  }
  public PARENS_CLOSE(): TerminalNode {
    return this.getToken(QueryParser.PARENS_CLOSE, 0);
  }
  public or(): OrContext {
    return this.getTypedRuleContext(OrContext, 0) as OrContext;
  }
  public and(): AndContext {
    return this.getTypedRuleContext(AndContext, 0) as AndContext;
  }
  public get ruleIndex(): number {
    return QueryParser.RULE_parenthesized;
  }
  public enterRule(listener: QueryListener): void {
    if (listener.enterParenthesized) {
      listener.enterParenthesized(this);
    }
  }
  public exitRule(listener: QueryListener): void {
    if (listener.exitParenthesized) {
      listener.exitParenthesized(this);
    }
  }
}

export class OrContext extends ParserRuleContext {
  constructor(parser?: QueryParser, parent?: ParserRuleContext, invokingState?: number) {
    super(parent, invokingState);
    this.parser = parser;
  }
  public and_list(): AndContext[] {
    return this.getTypedRuleContexts(AndContext) as AndContext[];
  }
  public and(i: number): AndContext {
    return this.getTypedRuleContext(AndContext, i) as AndContext;
  }
  public queryToken_list(): QueryTokenContext[] {
    return this.getTypedRuleContexts(QueryTokenContext) as QueryTokenContext[];
  }
  public queryToken(i: number): QueryTokenContext {
    return this.getTypedRuleContext(QueryTokenContext, i) as QueryTokenContext;
  }
  public parenthesized_list(): ParenthesizedContext[] {
    return this.getTypedRuleContexts(ParenthesizedContext) as ParenthesizedContext[];
  }
  public parenthesized(i: number): ParenthesizedContext {
    return this.getTypedRuleContext(ParenthesizedContext, i) as ParenthesizedContext;
  }
  public SEPARATOR_list(): TerminalNode[] {
    return this.getTokens(QueryParser.SEPARATOR);
  }
  public SEPARATOR(i: number): TerminalNode {
    return this.getToken(QueryParser.SEPARATOR, i);
  }
  public OR_list(): TerminalNode[] {
    return this.getTokens(QueryParser.OR);
  }
  public OR(i: number): TerminalNode {
    return this.getToken(QueryParser.OR, i);
  }
  public get ruleIndex(): number {
    return QueryParser.RULE_or;
  }
  public enterRule(listener: QueryListener): void {
    if (listener.enterOr) {
      listener.enterOr(this);
    }
  }
  public exitRule(listener: QueryListener): void {
    if (listener.exitOr) {
      listener.exitOr(this);
    }
  }
}

export class AndContext extends ParserRuleContext {
  constructor(parser?: QueryParser, parent?: ParserRuleContext, invokingState?: number) {
    super(parent, invokingState);
    this.parser = parser;
  }
  public queryToken_list(): QueryTokenContext[] {
    return this.getTypedRuleContexts(QueryTokenContext) as QueryTokenContext[];
  }
  public queryToken(i: number): QueryTokenContext {
    return this.getTypedRuleContext(QueryTokenContext, i) as QueryTokenContext;
  }
  public parenthesized_list(): ParenthesizedContext[] {
    return this.getTypedRuleContexts(ParenthesizedContext) as ParenthesizedContext[];
  }
  public parenthesized(i: number): ParenthesizedContext {
    return this.getTypedRuleContext(ParenthesizedContext, i) as ParenthesizedContext;
  }
  public SEPARATOR_list(): TerminalNode[] {
    return this.getTokens(QueryParser.SEPARATOR);
  }
  public SEPARATOR(i: number): TerminalNode {
    return this.getToken(QueryParser.SEPARATOR, i);
  }
  public AND_list(): TerminalNode[] {
    return this.getTokens(QueryParser.AND);
  }
  public AND(i: number): TerminalNode {
    return this.getToken(QueryParser.AND, i);
  }
  public get ruleIndex(): number {
    return QueryParser.RULE_and;
  }
  public enterRule(listener: QueryListener): void {
    if (listener.enterAnd) {
      listener.enterAnd(this);
    }
  }
  public exitRule(listener: QueryListener): void {
    if (listener.exitAnd) {
      listener.exitAnd(this);
    }
  }
}

export class QueryTokenContext extends ParserRuleContext {
  constructor(parser?: QueryParser, parent?: ParserRuleContext, invokingState?: number) {
    super(parent, invokingState);
    this.parser = parser;
  }
  public quoted(): QuotedContext {
    return this.getTypedRuleContext(QuotedContext, 0) as QuotedContext;
  }
  public negated(): NegatedContext {
    return this.getTypedRuleContext(NegatedContext, 0) as NegatedContext;
  }
  public propertyMatching(): PropertyMatchingContext {
    return this.getTypedRuleContext(PropertyMatchingContext, 0) as PropertyMatchingContext;
  }
  public word(): WordContext {
    return this.getTypedRuleContext(WordContext, 0) as WordContext;
  }
  public get ruleIndex(): number {
    return QueryParser.RULE_queryToken;
  }
  public enterRule(listener: QueryListener): void {
    if (listener.enterQueryToken) {
      listener.enterQueryToken(this);
    }
  }
  public exitRule(listener: QueryListener): void {
    if (listener.exitQueryToken) {
      listener.exitQueryToken(this);
    }
  }
}

export class QuotedContext extends ParserRuleContext {
  constructor(parser?: QueryParser, parent?: ParserRuleContext, invokingState?: number) {
    super(parent, invokingState);
    this.parser = parser;
  }
  public SINGLE_QUOTED(): TerminalNode {
    return this.getToken(QueryParser.SINGLE_QUOTED, 0);
  }
  public DOUBLE_QUOTED(): TerminalNode {
    return this.getToken(QueryParser.DOUBLE_QUOTED, 0);
  }
  public get ruleIndex(): number {
    return QueryParser.RULE_quoted;
  }
  public enterRule(listener: QueryListener): void {
    if (listener.enterQuoted) {
      listener.enterQuoted(this);
    }
  }
  public exitRule(listener: QueryListener): void {
    if (listener.exitQuoted) {
      listener.exitQuoted(this);
    }
  }
}

export class NegatedContext extends ParserRuleContext {
  constructor(parser?: QueryParser, parent?: ParserRuleContext, invokingState?: number) {
    super(parent, invokingState);
    this.parser = parser;
  }
  public NEGATION(): TerminalNode {
    return this.getToken(QueryParser.NEGATION, 0);
  }
  public word(): WordContext {
    return this.getTypedRuleContext(WordContext, 0) as WordContext;
  }
  public quoted(): QuotedContext {
    return this.getTypedRuleContext(QuotedContext, 0) as QuotedContext;
  }
  public propertyMatching(): PropertyMatchingContext {
    return this.getTypedRuleContext(PropertyMatchingContext, 0) as PropertyMatchingContext;
  }
  public get ruleIndex(): number {
    return QueryParser.RULE_negated;
  }
  public enterRule(listener: QueryListener): void {
    if (listener.enterNegated) {
      listener.enterNegated(this);
    }
  }
  public exitRule(listener: QueryListener): void {
    if (listener.exitNegated) {
      listener.exitNegated(this);
    }
  }
}

export class PropertyMatchingContext extends ParserRuleContext {
  constructor(parser?: QueryParser, parent?: ParserRuleContext, invokingState?: number) {
    super(parent, invokingState);
    this.parser = parser;
  }
  public name(): NameContext {
    return this.getTypedRuleContext(NameContext, 0) as NameContext;
  }
  public value(): ValueContext {
    return this.getTypedRuleContext(ValueContext, 0) as ValueContext;
  }
  public get ruleIndex(): number {
    return QueryParser.RULE_propertyMatching;
  }
  public enterRule(listener: QueryListener): void {
    if (listener.enterPropertyMatching) {
      listener.enterPropertyMatching(this);
    }
  }
  public exitRule(listener: QueryListener): void {
    if (listener.exitPropertyMatching) {
      listener.exitPropertyMatching(this);
    }
  }
}

export class NameContext extends ParserRuleContext {
  constructor(parser?: QueryParser, parent?: ParserRuleContext, invokingState?: number) {
    super(parent, invokingState);
    this.parser = parser;
  }
  public TOKEN(): TerminalNode {
    return this.getToken(QueryParser.TOKEN, 0);
  }
  public get ruleIndex(): number {
    return QueryParser.RULE_name;
  }
  public enterRule(listener: QueryListener): void {
    if (listener.enterName) {
      listener.enterName(this);
    }
  }
  public exitRule(listener: QueryListener): void {
    if (listener.exitName) {
      listener.exitName(this);
    }
  }
}

export class ValueContext extends ParserRuleContext {
  constructor(parser?: QueryParser, parent?: ParserRuleContext, invokingState?: number) {
    super(parent, invokingState);
    this.parser = parser;
  }
  public word(): WordContext {
    return this.getTypedRuleContext(WordContext, 0) as WordContext;
  }
  public quoted(): QuotedContext {
    return this.getTypedRuleContext(QuotedContext, 0) as QuotedContext;
  }
  public get ruleIndex(): number {
    return QueryParser.RULE_value;
  }
  public enterRule(listener: QueryListener): void {
    if (listener.enterValue) {
      listener.enterValue(this);
    }
  }
  public exitRule(listener: QueryListener): void {
    if (listener.exitValue) {
      listener.exitValue(this);
    }
  }
}

export class WordContext extends ParserRuleContext {
  constructor(parser?: QueryParser, parent?: ParserRuleContext, invokingState?: number) {
    super(parent, invokingState);
    this.parser = parser;
  }
  public TOKEN(): TerminalNode {
    return this.getToken(QueryParser.TOKEN, 0);
  }
  public get ruleIndex(): number {
    return QueryParser.RULE_word;
  }
  public enterRule(listener: QueryListener): void {
    if (listener.enterWord) {
      listener.enterWord(this);
    }
  }
  public exitRule(listener: QueryListener): void {
    if (listener.exitWord) {
      listener.exitWord(this);
    }
  }
}
