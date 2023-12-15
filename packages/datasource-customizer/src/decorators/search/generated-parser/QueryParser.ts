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
  public static readonly OR = 2;
  public static readonly AND = 3;
  public static readonly SINGLE_QUOTED = 4;
  public static readonly DOUBLE_QUOTED = 5;
  public static readonly NEGATION = 6;
  public static readonly TOKEN = 7;
  public static readonly SEPARATOR = 8;
  public static readonly SPACING = 9;
  public static override readonly EOF = Token.EOF;
  public static readonly RULE_query = 0;
  public static readonly RULE_queryPart = 1;
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
    "'OR'",
    "'AND'",
    null,
    null,
    "'-'",
  ];
  public static readonly symbolicNames: (string | null)[] = [
    null,
    null,
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
    'queryPart',
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
      let _alt: number;
      this.enterOuterAlt(localctx, 1);
      {
        this.state = 27;
        this._errHandler.sync(this);
        _alt = this._interp.adaptivePredict(this._input, 0, this._ctx);
        while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
          if (_alt === 1) {
            {
              {
                this.state = 22;
                this.queryPart();
                this.state = 23;
                this.match(QueryParser.SEPARATOR);
              }
            }
          }
          this.state = 29;
          this._errHandler.sync(this);
          _alt = this._interp.adaptivePredict(this._input, 0, this._ctx);
        }
        this.state = 30;
        this.queryPart();
        this.state = 31;
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
  public queryPart(): QueryPartContext {
    let localctx: QueryPartContext = new QueryPartContext(this, this._ctx, this.state);
    this.enterRule(localctx, 2, QueryParser.RULE_queryPart);
    try {
      this.state = 36;
      this._errHandler.sync(this);
      switch (this._interp.adaptivePredict(this._input, 1, this._ctx)) {
        case 1:
          this.enterOuterAlt(localctx, 1);
          {
            this.state = 33;
            this.or();
          }
          break;
        case 2:
          this.enterOuterAlt(localctx, 2);
          {
            this.state = 34;
            this.and();
          }
          break;
        case 3:
          this.enterOuterAlt(localctx, 3);
          {
            this.state = 35;
            this.queryToken();
          }
          break;
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
    try {
      let _alt: number;
      this.enterOuterAlt(localctx, 1);
      {
        this.state = 38;
        this.queryToken();
        this.state = 43;
        this._errHandler.sync(this);
        _alt = 1;
        do {
          switch (_alt) {
            case 1:
              {
                {
                  this.state = 39;
                  this.match(QueryParser.SEPARATOR);
                  this.state = 40;
                  this.match(QueryParser.OR);
                  this.state = 41;
                  this.match(QueryParser.SEPARATOR);
                  this.state = 42;
                  this.queryToken();
                }
              }
              break;
            default:
              throw new NoViableAltException(this);
          }
          this.state = 45;
          this._errHandler.sync(this);
          _alt = this._interp.adaptivePredict(this._input, 2, this._ctx);
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
  public and(): AndContext {
    let localctx: AndContext = new AndContext(this, this._ctx, this.state);
    this.enterRule(localctx, 6, QueryParser.RULE_and);
    try {
      let _alt: number;
      this.enterOuterAlt(localctx, 1);
      {
        this.state = 47;
        this.queryToken();
        this.state = 52;
        this._errHandler.sync(this);
        _alt = 1;
        do {
          switch (_alt) {
            case 1:
              {
                {
                  this.state = 48;
                  this.match(QueryParser.SEPARATOR);
                  this.state = 49;
                  this.match(QueryParser.AND);
                  this.state = 50;
                  this.match(QueryParser.SEPARATOR);
                  this.state = 51;
                  this.queryToken();
                }
              }
              break;
            default:
              throw new NoViableAltException(this);
          }
          this.state = 54;
          this._errHandler.sync(this);
          _alt = this._interp.adaptivePredict(this._input, 3, this._ctx);
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
        this.state = 60;
        this._errHandler.sync(this);
        switch (this._interp.adaptivePredict(this._input, 4, this._ctx)) {
          case 1:
            {
              this.state = 56;
              this.quoted();
            }
            break;
          case 2:
            {
              this.state = 57;
              this.negated();
            }
            break;
          case 3:
            {
              this.state = 58;
              this.propertyMatching();
            }
            break;
          case 4:
            {
              this.state = 59;
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
        this.state = 62;
        _la = this._input.LA(1);
        if (!(_la === 4 || _la === 5)) {
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
        this.state = 64;
        this.match(QueryParser.NEGATION);
        this.state = 68;
        this._errHandler.sync(this);
        switch (this._interp.adaptivePredict(this._input, 5, this._ctx)) {
          case 1:
            {
              this.state = 65;
              this.word();
            }
            break;
          case 2:
            {
              this.state = 66;
              this.quoted();
            }
            break;
          case 3:
            {
              this.state = 67;
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
        this.state = 70;
        this.name();
        this.state = 71;
        this.match(QueryParser.T__0);
        this.state = 72;
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
        this.state = 74;
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
      this.state = 78;
      this._errHandler.sync(this);
      switch (this._input.LA(1)) {
        case 7:
          this.enterOuterAlt(localctx, 1);
          {
            this.state = 76;
            this.word();
          }
          break;
        case 4:
        case 5:
          this.enterOuterAlt(localctx, 2);
          {
            this.state = 77;
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
        this.state = 80;
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
    4, 1, 9, 83, 2, 0, 7, 0, 2, 1, 7, 1, 2, 2, 7, 2, 2, 3, 7, 3, 2, 4, 7, 4, 2, 5, 7, 5, 2, 6, 7, 6,
    2, 7, 7, 7, 2, 8, 7, 8, 2, 9, 7, 9, 2, 10, 7, 10, 1, 0, 1, 0, 1, 0, 5, 0, 26, 8, 0, 10, 0, 12,
    0, 29, 9, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 3, 1, 37, 8, 1, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2,
    4, 2, 44, 8, 2, 11, 2, 12, 2, 45, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 4, 3, 53, 8, 3, 11, 3, 12, 3,
    54, 1, 4, 1, 4, 1, 4, 1, 4, 3, 4, 61, 8, 4, 1, 5, 1, 5, 1, 6, 1, 6, 1, 6, 1, 6, 3, 6, 69, 8, 6,
    1, 7, 1, 7, 1, 7, 1, 7, 1, 8, 1, 8, 1, 9, 1, 9, 3, 9, 79, 8, 9, 1, 10, 1, 10, 1, 10, 0, 0, 11,
    0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 0, 1, 1, 0, 4, 5, 82, 0, 27, 1, 0, 0, 0, 2, 36, 1, 0, 0,
    0, 4, 38, 1, 0, 0, 0, 6, 47, 1, 0, 0, 0, 8, 60, 1, 0, 0, 0, 10, 62, 1, 0, 0, 0, 12, 64, 1, 0, 0,
    0, 14, 70, 1, 0, 0, 0, 16, 74, 1, 0, 0, 0, 18, 78, 1, 0, 0, 0, 20, 80, 1, 0, 0, 0, 22, 23, 3, 2,
    1, 0, 23, 24, 5, 8, 0, 0, 24, 26, 1, 0, 0, 0, 25, 22, 1, 0, 0, 0, 26, 29, 1, 0, 0, 0, 27, 25, 1,
    0, 0, 0, 27, 28, 1, 0, 0, 0, 28, 30, 1, 0, 0, 0, 29, 27, 1, 0, 0, 0, 30, 31, 3, 2, 1, 0, 31, 32,
    5, 0, 0, 1, 32, 1, 1, 0, 0, 0, 33, 37, 3, 4, 2, 0, 34, 37, 3, 6, 3, 0, 35, 37, 3, 8, 4, 0, 36,
    33, 1, 0, 0, 0, 36, 34, 1, 0, 0, 0, 36, 35, 1, 0, 0, 0, 37, 3, 1, 0, 0, 0, 38, 43, 3, 8, 4, 0,
    39, 40, 5, 8, 0, 0, 40, 41, 5, 2, 0, 0, 41, 42, 5, 8, 0, 0, 42, 44, 3, 8, 4, 0, 43, 39, 1, 0, 0,
    0, 44, 45, 1, 0, 0, 0, 45, 43, 1, 0, 0, 0, 45, 46, 1, 0, 0, 0, 46, 5, 1, 0, 0, 0, 47, 52, 3, 8,
    4, 0, 48, 49, 5, 8, 0, 0, 49, 50, 5, 3, 0, 0, 50, 51, 5, 8, 0, 0, 51, 53, 3, 8, 4, 0, 52, 48, 1,
    0, 0, 0, 53, 54, 1, 0, 0, 0, 54, 52, 1, 0, 0, 0, 54, 55, 1, 0, 0, 0, 55, 7, 1, 0, 0, 0, 56, 61,
    3, 10, 5, 0, 57, 61, 3, 12, 6, 0, 58, 61, 3, 14, 7, 0, 59, 61, 3, 20, 10, 0, 60, 56, 1, 0, 0, 0,
    60, 57, 1, 0, 0, 0, 60, 58, 1, 0, 0, 0, 60, 59, 1, 0, 0, 0, 61, 9, 1, 0, 0, 0, 62, 63, 7, 0, 0,
    0, 63, 11, 1, 0, 0, 0, 64, 68, 5, 6, 0, 0, 65, 69, 3, 20, 10, 0, 66, 69, 3, 10, 5, 0, 67, 69, 3,
    14, 7, 0, 68, 65, 1, 0, 0, 0, 68, 66, 1, 0, 0, 0, 68, 67, 1, 0, 0, 0, 69, 13, 1, 0, 0, 0, 70,
    71, 3, 16, 8, 0, 71, 72, 5, 1, 0, 0, 72, 73, 3, 18, 9, 0, 73, 15, 1, 0, 0, 0, 74, 75, 5, 7, 0,
    0, 75, 17, 1, 0, 0, 0, 76, 79, 3, 20, 10, 0, 77, 79, 3, 10, 5, 0, 78, 76, 1, 0, 0, 0, 78, 77, 1,
    0, 0, 0, 79, 19, 1, 0, 0, 0, 80, 81, 5, 7, 0, 0, 81, 21, 1, 0, 0, 0, 7, 27, 36, 45, 54, 60, 68,
    78,
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
  public queryPart_list(): QueryPartContext[] {
    return this.getTypedRuleContexts(QueryPartContext) as QueryPartContext[];
  }
  public queryPart(i: number): QueryPartContext {
    return this.getTypedRuleContext(QueryPartContext, i) as QueryPartContext;
  }
  public EOF(): TerminalNode {
    return this.getToken(QueryParser.EOF, 0);
  }
  public SEPARATOR_list(): TerminalNode[] {
    return this.getTokens(QueryParser.SEPARATOR);
  }
  public SEPARATOR(i: number): TerminalNode {
    return this.getToken(QueryParser.SEPARATOR, i);
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

export class QueryPartContext extends ParserRuleContext {
  constructor(parser?: QueryParser, parent?: ParserRuleContext, invokingState?: number) {
    super(parent, invokingState);
    this.parser = parser;
  }
  public or(): OrContext {
    return this.getTypedRuleContext(OrContext, 0) as OrContext;
  }
  public and(): AndContext {
    return this.getTypedRuleContext(AndContext, 0) as AndContext;
  }
  public queryToken(): QueryTokenContext {
    return this.getTypedRuleContext(QueryTokenContext, 0) as QueryTokenContext;
  }
  public get ruleIndex(): number {
    return QueryParser.RULE_queryPart;
  }
  public enterRule(listener: QueryListener): void {
    if (listener.enterQueryPart) {
      listener.enterQueryPart(this);
    }
  }
  public exitRule(listener: QueryListener): void {
    if (listener.exitQueryPart) {
      listener.exitQueryPart(this);
    }
  }
}

export class OrContext extends ParserRuleContext {
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
