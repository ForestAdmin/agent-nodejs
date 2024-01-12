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
	public static readonly EOF = Token.EOF;

	public static readonly channelNames: string[] = [ "DEFAULT_TOKEN_CHANNEL", "HIDDEN" ];
	public static readonly literalNames: (string | null)[] = [ null, "':'", 
                                                            null, null, 
                                                            "'OR'", "'AND'", 
                                                            null, null, 
                                                            "'-'" ];
	public static readonly symbolicNames: (string | null)[] = [ null, null, 
                                                             "PARENS_OPEN", 
                                                             "PARENS_CLOSE", 
                                                             "OR", "AND", 
                                                             "SINGLE_QUOTED", 
                                                             "DOUBLE_QUOTED", 
                                                             "NEGATION", 
                                                             "TOKEN", "SEPARATOR", 
                                                             "SPACING" ];
	public static readonly modeNames: string[] = [ "DEFAULT_MODE", ];

	public static readonly ruleNames: string[] = [
		"T__0", "PARENS_OPEN", "PARENS_CLOSE", "OR", "AND", "SINGLE_QUOTED", "SINGLE_QUOTED_CONTENT", 
		"DOUBLE_QUOTED", "DOUBLE_QUOTED_CONTENT", "NEGATION", "TOKEN", "ONE_CHAR_TOKEN", 
		"MULTIPLE_CHARS_TOKEN", "SEPARATOR", "SPACING",
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

	public static readonly _serializedATN: number[] = [4,0,11,107,6,-1,2,0,
	7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,
	7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,2,14,7,14,1,0,1,0,1,1,1,1,5,
	1,36,8,1,10,1,12,1,39,9,1,1,2,5,2,42,8,2,10,2,12,2,45,9,2,1,2,1,2,1,3,1,
	3,1,3,1,4,1,4,1,4,1,4,1,5,1,5,1,5,1,5,1,5,1,5,3,5,62,8,5,1,6,5,6,65,8,6,
	10,6,12,6,68,9,6,1,7,1,7,1,7,1,7,1,7,1,7,3,7,76,8,7,1,8,5,8,79,8,8,10,8,
	12,8,82,9,8,1,9,1,9,1,10,1,10,3,10,88,8,10,1,11,1,11,1,12,1,12,4,12,94,
	8,12,11,12,12,12,95,1,13,4,13,99,8,13,11,13,12,13,100,1,13,3,13,104,8,13,
	1,14,1,14,0,0,15,1,1,3,2,5,3,7,4,9,5,11,6,13,0,15,7,17,0,19,8,21,9,23,0,
	25,0,27,10,29,11,1,0,6,1,0,39,39,1,0,34,34,6,0,10,10,13,13,32,32,40,41,
	45,45,58,58,6,0,10,10,13,13,32,32,40,40,45,45,58,58,4,0,10,10,13,13,32,
	32,58,58,3,0,10,10,13,13,32,32,112,0,1,1,0,0,0,0,3,1,0,0,0,0,5,1,0,0,0,
	0,7,1,0,0,0,0,9,1,0,0,0,0,11,1,0,0,0,0,15,1,0,0,0,0,19,1,0,0,0,0,21,1,0,
	0,0,0,27,1,0,0,0,0,29,1,0,0,0,1,31,1,0,0,0,3,33,1,0,0,0,5,43,1,0,0,0,7,
	48,1,0,0,0,9,51,1,0,0,0,11,61,1,0,0,0,13,66,1,0,0,0,15,75,1,0,0,0,17,80,
	1,0,0,0,19,83,1,0,0,0,21,87,1,0,0,0,23,89,1,0,0,0,25,91,1,0,0,0,27,103,
	1,0,0,0,29,105,1,0,0,0,31,32,5,58,0,0,32,2,1,0,0,0,33,37,5,40,0,0,34,36,
	5,32,0,0,35,34,1,0,0,0,36,39,1,0,0,0,37,35,1,0,0,0,37,38,1,0,0,0,38,4,1,
	0,0,0,39,37,1,0,0,0,40,42,5,32,0,0,41,40,1,0,0,0,42,45,1,0,0,0,43,41,1,
	0,0,0,43,44,1,0,0,0,44,46,1,0,0,0,45,43,1,0,0,0,46,47,5,41,0,0,47,6,1,0,
	0,0,48,49,5,79,0,0,49,50,5,82,0,0,50,8,1,0,0,0,51,52,5,65,0,0,52,53,5,78,
	0,0,53,54,5,68,0,0,54,10,1,0,0,0,55,56,5,39,0,0,56,57,3,13,6,0,57,58,5,
	39,0,0,58,62,1,0,0,0,59,60,5,39,0,0,60,62,5,39,0,0,61,55,1,0,0,0,61,59,
	1,0,0,0,62,12,1,0,0,0,63,65,8,0,0,0,64,63,1,0,0,0,65,68,1,0,0,0,66,64,1,
	0,0,0,66,67,1,0,0,0,67,14,1,0,0,0,68,66,1,0,0,0,69,70,5,34,0,0,70,71,3,
	17,8,0,71,72,5,34,0,0,72,76,1,0,0,0,73,74,5,34,0,0,74,76,5,34,0,0,75,69,
	1,0,0,0,75,73,1,0,0,0,76,16,1,0,0,0,77,79,8,1,0,0,78,77,1,0,0,0,79,82,1,
	0,0,0,80,78,1,0,0,0,80,81,1,0,0,0,81,18,1,0,0,0,82,80,1,0,0,0,83,84,5,45,
	0,0,84,20,1,0,0,0,85,88,3,23,11,0,86,88,3,25,12,0,87,85,1,0,0,0,87,86,1,
	0,0,0,88,22,1,0,0,0,89,90,8,2,0,0,90,24,1,0,0,0,91,93,8,3,0,0,92,94,8,4,
	0,0,93,92,1,0,0,0,94,95,1,0,0,0,95,93,1,0,0,0,95,96,1,0,0,0,96,26,1,0,0,
	0,97,99,3,29,14,0,98,97,1,0,0,0,99,100,1,0,0,0,100,98,1,0,0,0,100,101,1,
	0,0,0,101,104,1,0,0,0,102,104,5,0,0,1,103,98,1,0,0,0,103,102,1,0,0,0,104,
	28,1,0,0,0,105,106,7,5,0,0,106,30,1,0,0,0,11,0,37,43,61,66,75,80,87,95,
	100,103,0];

	private static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!QueryLexer.__ATN) {
			QueryLexer.__ATN = new ATNDeserializer().deserialize(QueryLexer._serializedATN);
		}

		return QueryLexer.__ATN;
	}


	static DecisionsToDFA = QueryLexer._ATN.decisionToState.map( (ds: DecisionState, index: number) => new DFA(ds, index) );
}