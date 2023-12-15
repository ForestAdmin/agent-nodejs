// Generated from src/decorators/search/Query.g4 by ANTLR 4.13.1
// noinspection ES6UnusedImports,JSUnusedGlobalSymbols,JSUnusedLocalSymbols
import {
	ATN,
	ATNDeserializer,
	CharStream,
	DecisionState, DFA,
	Lexer,
	LexerATNSimulator,
	RuleContext,
	PredictionContextCache,
	Token
} from "antlr4";
export default class QueryLexer extends Lexer {
	public static readonly T__0 = 1;
	public static readonly OR = 2;
	public static readonly AND = 3;
	public static readonly SINGLE_QUOTED = 4;
	public static readonly DOUBLE_QUOTED = 5;
	public static readonly NEGATION = 6;
	public static readonly TOKEN = 7;
	public static readonly SEPARATOR = 8;
	public static readonly SPACING = 9;
	public static readonly EOF = Token.EOF;

	public static readonly channelNames: string[] = [ "DEFAULT_TOKEN_CHANNEL", "HIDDEN" ];
	public static readonly literalNames: (string | null)[] = [ null, "':'", 
                                                            "'OR'", "'AND'", 
                                                            null, null, 
                                                            "'-'" ];
	public static readonly symbolicNames: (string | null)[] = [ null, null, 
                                                             "OR", "AND", 
                                                             "SINGLE_QUOTED", 
                                                             "DOUBLE_QUOTED", 
                                                             "NEGATION", 
                                                             "TOKEN", "SEPARATOR", 
                                                             "SPACING" ];
	public static readonly modeNames: string[] = [ "DEFAULT_MODE", ];

	public static readonly ruleNames: string[] = [
		"T__0", "OR", "AND", "SINGLE_QUOTED", "SINGLE_QUOTED_CONTENT", "DOUBLE_QUOTED", 
		"DOUBLE_QUOTED_CONTENT", "NEGATION", "TOKEN", "SEPARATOR", "SPACING",
	];


	constructor(input: CharStream) {
		super(input);
		this._interp = new LexerATNSimulator(this, QueryLexer._ATN, QueryLexer.DecisionsToDFA, new PredictionContextCache());
	}

	public get grammarFileName(): string { return "Query.g4"; }

	public get literalNames(): (string | null)[] { return QueryLexer.literalNames; }
	public get symbolicNames(): (string | null)[] { return QueryLexer.symbolicNames; }
	public get ruleNames(): string[] { return QueryLexer.ruleNames; }

	public get serializedATN(): number[] { return QueryLexer._serializedATN; }

	public get channelNames(): string[] { return QueryLexer.channelNames; }

	public get modeNames(): string[] { return QueryLexer.modeNames; }

	public static readonly _serializedATN: number[] = [4,0,9,78,6,-1,2,0,7,
	0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,
	9,2,10,7,10,1,0,1,0,1,1,1,1,1,1,1,2,1,2,1,2,1,2,1,3,1,3,1,3,1,3,1,3,1,3,
	3,3,39,8,3,1,4,5,4,42,8,4,10,4,12,4,45,9,4,1,5,1,5,1,5,1,5,1,5,1,5,3,5,
	53,8,5,1,6,5,6,56,8,6,10,6,12,6,59,9,6,1,7,1,7,1,8,1,8,5,8,65,8,8,10,8,
	12,8,68,9,8,1,9,1,9,3,9,72,8,9,1,10,4,10,75,8,10,11,10,12,10,76,0,0,11,
	1,1,3,2,5,3,7,4,9,0,11,5,13,0,15,6,17,7,19,8,21,9,1,0,5,1,0,39,39,1,0,34,
	34,5,0,10,10,13,13,32,32,45,45,58,58,4,0,10,10,13,13,32,32,58,58,3,0,10,
	10,13,13,32,32,82,0,1,1,0,0,0,0,3,1,0,0,0,0,5,1,0,0,0,0,7,1,0,0,0,0,11,
	1,0,0,0,0,15,1,0,0,0,0,17,1,0,0,0,0,19,1,0,0,0,0,21,1,0,0,0,1,23,1,0,0,
	0,3,25,1,0,0,0,5,28,1,0,0,0,7,38,1,0,0,0,9,43,1,0,0,0,11,52,1,0,0,0,13,
	57,1,0,0,0,15,60,1,0,0,0,17,62,1,0,0,0,19,71,1,0,0,0,21,74,1,0,0,0,23,24,
	5,58,0,0,24,2,1,0,0,0,25,26,5,79,0,0,26,27,5,82,0,0,27,4,1,0,0,0,28,29,
	5,65,0,0,29,30,5,78,0,0,30,31,5,68,0,0,31,6,1,0,0,0,32,33,5,39,0,0,33,34,
	3,9,4,0,34,35,5,39,0,0,35,39,1,0,0,0,36,37,5,39,0,0,37,39,5,39,0,0,38,32,
	1,0,0,0,38,36,1,0,0,0,39,8,1,0,0,0,40,42,8,0,0,0,41,40,1,0,0,0,42,45,1,
	0,0,0,43,41,1,0,0,0,43,44,1,0,0,0,44,10,1,0,0,0,45,43,1,0,0,0,46,47,5,34,
	0,0,47,48,3,13,6,0,48,49,5,34,0,0,49,53,1,0,0,0,50,51,5,34,0,0,51,53,5,
	34,0,0,52,46,1,0,0,0,52,50,1,0,0,0,53,12,1,0,0,0,54,56,8,1,0,0,55,54,1,
	0,0,0,56,59,1,0,0,0,57,55,1,0,0,0,57,58,1,0,0,0,58,14,1,0,0,0,59,57,1,0,
	0,0,60,61,5,45,0,0,61,16,1,0,0,0,62,66,8,2,0,0,63,65,8,3,0,0,64,63,1,0,
	0,0,65,68,1,0,0,0,66,64,1,0,0,0,66,67,1,0,0,0,67,18,1,0,0,0,68,66,1,0,0,
	0,69,72,3,21,10,0,70,72,5,0,0,1,71,69,1,0,0,0,71,70,1,0,0,0,72,20,1,0,0,
	0,73,75,7,4,0,0,74,73,1,0,0,0,75,76,1,0,0,0,76,74,1,0,0,0,76,77,1,0,0,0,
	77,22,1,0,0,0,8,0,38,43,52,57,66,71,76,0];

	private static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!QueryLexer.__ATN) {
			QueryLexer.__ATN = new ATNDeserializer().deserialize(QueryLexer._serializedATN);
		}

		return QueryLexer.__ATN;
	}


	static DecisionsToDFA = QueryLexer._ATN.decisionToState.map( (ds: DecisionState, index: number) => new DFA(ds, index) );
}