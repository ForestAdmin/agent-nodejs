// Generated from src/decorators/search/Query.g4 by ANTLR 4.13.1

import {ParseTreeListener} from "antlr4";


import { QueryContext } from "./QueryParser";
import { ParenthesizedContext } from "./QueryParser";
import { OrContext } from "./QueryParser";
import { AndContext } from "./QueryParser";
import { QueryTokenContext } from "./QueryParser";
import { QuotedContext } from "./QueryParser";
import { NegatedContext } from "./QueryParser";
import { PropertyMatchingContext } from "./QueryParser";
import { NameContext } from "./QueryParser";
import { ValueContext } from "./QueryParser";
import { WordContext } from "./QueryParser";


/**
 * This interface defines a complete listener for a parse tree produced by
 * `QueryParser`.
 */
export default class QueryListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by `QueryParser.query`.
	 * @param ctx the parse tree
	 */
	enterQuery?: (ctx: QueryContext) => void;
	/**
	 * Exit a parse tree produced by `QueryParser.query`.
	 * @param ctx the parse tree
	 */
	exitQuery?: (ctx: QueryContext) => void;
	/**
	 * Enter a parse tree produced by `QueryParser.parenthesized`.
	 * @param ctx the parse tree
	 */
	enterParenthesized?: (ctx: ParenthesizedContext) => void;
	/**
	 * Exit a parse tree produced by `QueryParser.parenthesized`.
	 * @param ctx the parse tree
	 */
	exitParenthesized?: (ctx: ParenthesizedContext) => void;
	/**
	 * Enter a parse tree produced by `QueryParser.or`.
	 * @param ctx the parse tree
	 */
	enterOr?: (ctx: OrContext) => void;
	/**
	 * Exit a parse tree produced by `QueryParser.or`.
	 * @param ctx the parse tree
	 */
	exitOr?: (ctx: OrContext) => void;
	/**
	 * Enter a parse tree produced by `QueryParser.and`.
	 * @param ctx the parse tree
	 */
	enterAnd?: (ctx: AndContext) => void;
	/**
	 * Exit a parse tree produced by `QueryParser.and`.
	 * @param ctx the parse tree
	 */
	exitAnd?: (ctx: AndContext) => void;
	/**
	 * Enter a parse tree produced by `QueryParser.queryToken`.
	 * @param ctx the parse tree
	 */
	enterQueryToken?: (ctx: QueryTokenContext) => void;
	/**
	 * Exit a parse tree produced by `QueryParser.queryToken`.
	 * @param ctx the parse tree
	 */
	exitQueryToken?: (ctx: QueryTokenContext) => void;
	/**
	 * Enter a parse tree produced by `QueryParser.quoted`.
	 * @param ctx the parse tree
	 */
	enterQuoted?: (ctx: QuotedContext) => void;
	/**
	 * Exit a parse tree produced by `QueryParser.quoted`.
	 * @param ctx the parse tree
	 */
	exitQuoted?: (ctx: QuotedContext) => void;
	/**
	 * Enter a parse tree produced by `QueryParser.negated`.
	 * @param ctx the parse tree
	 */
	enterNegated?: (ctx: NegatedContext) => void;
	/**
	 * Exit a parse tree produced by `QueryParser.negated`.
	 * @param ctx the parse tree
	 */
	exitNegated?: (ctx: NegatedContext) => void;
	/**
	 * Enter a parse tree produced by `QueryParser.propertyMatching`.
	 * @param ctx the parse tree
	 */
	enterPropertyMatching?: (ctx: PropertyMatchingContext) => void;
	/**
	 * Exit a parse tree produced by `QueryParser.propertyMatching`.
	 * @param ctx the parse tree
	 */
	exitPropertyMatching?: (ctx: PropertyMatchingContext) => void;
	/**
	 * Enter a parse tree produced by `QueryParser.name`.
	 * @param ctx the parse tree
	 */
	enterName?: (ctx: NameContext) => void;
	/**
	 * Exit a parse tree produced by `QueryParser.name`.
	 * @param ctx the parse tree
	 */
	exitName?: (ctx: NameContext) => void;
	/**
	 * Enter a parse tree produced by `QueryParser.value`.
	 * @param ctx the parse tree
	 */
	enterValue?: (ctx: ValueContext) => void;
	/**
	 * Exit a parse tree produced by `QueryParser.value`.
	 * @param ctx the parse tree
	 */
	exitValue?: (ctx: ValueContext) => void;
	/**
	 * Enter a parse tree produced by `QueryParser.word`.
	 * @param ctx the parse tree
	 */
	enterWord?: (ctx: WordContext) => void;
	/**
	 * Exit a parse tree produced by `QueryParser.word`.
	 * @param ctx the parse tree
	 */
	exitWord?: (ctx: WordContext) => void;
}

