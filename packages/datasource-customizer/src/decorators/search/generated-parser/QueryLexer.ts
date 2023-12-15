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
		"DOUBLE_QUOTED", "DOUBLE_QUOTED_CONTENT", "NEGATION", "TOKEN", "SEPARATOR", 
		"SPACING",
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

	public static readonly _serializedATN: number[] = [4,0,11,98,6,-1,2,0,7,
	0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,
	9,2,10,7,10,2,11,7,11,2,12,7,12,1,0,1,0,1,1,1,1,5,1,32,8,1,10,1,12,1,35,
	9,1,1,2,5,2,38,8,2,10,2,12,2,41,9,2,1,2,1,2,1,3,1,3,1,3,1,4,1,4,1,4,1,4,
	1,5,1,5,1,5,1,5,1,5,1,5,3,5,58,8,5,1,6,5,6,61,8,6,10,6,12,6,64,9,6,1,7,
	1,7,1,7,1,7,1,7,1,7,3,7,72,8,7,1,8,5,8,75,8,8,10,8,12,8,78,9,8,1,9,1,9,
	1,10,1,10,5,10,84,8,10,10,10,12,10,87,9,10,1,11,4,11,90,8,11,11,11,12,11,
	91,1,11,3,11,95,8,11,1,12,1,12,0,0,13,1,1,3,2,5,3,7,4,9,5,11,6,13,0,15,
	7,17,0,19,8,21,9,23,10,25,11,1,0,5,1,0,39,39,1,0,34,34,6,0,10,10,13,13,
	32,32,40,41,45,45,58,58,5,0,10,10,13,13,32,32,40,41,58,58,3,0,10,10,13,
	13,32,32,104,0,1,1,0,0,0,0,3,1,0,0,0,0,5,1,0,0,0,0,7,1,0,0,0,0,9,1,0,0,
	0,0,11,1,0,0,0,0,15,1,0,0,0,0,19,1,0,0,0,0,21,1,0,0,0,0,23,1,0,0,0,0,25,
	1,0,0,0,1,27,1,0,0,0,3,29,1,0,0,0,5,39,1,0,0,0,7,44,1,0,0,0,9,47,1,0,0,
	0,11,57,1,0,0,0,13,62,1,0,0,0,15,71,1,0,0,0,17,76,1,0,0,0,19,79,1,0,0,0,
	21,81,1,0,0,0,23,94,1,0,0,0,25,96,1,0,0,0,27,28,5,58,0,0,28,2,1,0,0,0,29,
	33,5,40,0,0,30,32,5,32,0,0,31,30,1,0,0,0,32,35,1,0,0,0,33,31,1,0,0,0,33,
	34,1,0,0,0,34,4,1,0,0,0,35,33,1,0,0,0,36,38,5,32,0,0,37,36,1,0,0,0,38,41,
	1,0,0,0,39,37,1,0,0,0,39,40,1,0,0,0,40,42,1,0,0,0,41,39,1,0,0,0,42,43,5,
	41,0,0,43,6,1,0,0,0,44,45,5,79,0,0,45,46,5,82,0,0,46,8,1,0,0,0,47,48,5,
	65,0,0,48,49,5,78,0,0,49,50,5,68,0,0,50,10,1,0,0,0,51,52,5,39,0,0,52,53,
	3,13,6,0,53,54,5,39,0,0,54,58,1,0,0,0,55,56,5,39,0,0,56,58,5,39,0,0,57,
	51,1,0,0,0,57,55,1,0,0,0,58,12,1,0,0,0,59,61,8,0,0,0,60,59,1,0,0,0,61,64,
	1,0,0,0,62,60,1,0,0,0,62,63,1,0,0,0,63,14,1,0,0,0,64,62,1,0,0,0,65,66,5,
	34,0,0,66,67,3,17,8,0,67,68,5,34,0,0,68,72,1,0,0,0,69,70,5,34,0,0,70,72,
	5,34,0,0,71,65,1,0,0,0,71,69,1,0,0,0,72,16,1,0,0,0,73,75,8,1,0,0,74,73,
	1,0,0,0,75,78,1,0,0,0,76,74,1,0,0,0,76,77,1,0,0,0,77,18,1,0,0,0,78,76,1,
	0,0,0,79,80,5,45,0,0,80,20,1,0,0,0,81,85,8,2,0,0,82,84,8,3,0,0,83,82,1,
	0,0,0,84,87,1,0,0,0,85,83,1,0,0,0,85,86,1,0,0,0,86,22,1,0,0,0,87,85,1,0,
	0,0,88,90,3,25,12,0,89,88,1,0,0,0,90,91,1,0,0,0,91,89,1,0,0,0,91,92,1,0,
	0,0,92,95,1,0,0,0,93,95,5,0,0,1,94,89,1,0,0,0,94,93,1,0,0,0,95,24,1,0,0,
	0,96,97,7,4,0,0,97,26,1,0,0,0,10,0,33,39,57,62,71,76,85,91,94,0];

	private static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!QueryLexer.__ATN) {
			QueryLexer.__ATN = new ATNDeserializer().deserialize(QueryLexer._serializedATN);
		}

		return QueryLexer.__ATN;
	}


	static DecisionsToDFA = QueryLexer._ATN.decisionToState.map( (ds: DecisionState, index: number) => new DFA(ds, index) );
}