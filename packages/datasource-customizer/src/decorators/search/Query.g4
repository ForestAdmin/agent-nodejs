//
// This file contains the description of the supported syntax for search queries.
// It is used by the ANTLR parser generator to generate the parser.
// To support additional syntax, this file must be updated and the parser regenerated.
// It requires antlr4-tools to be installed on your machine
// 
grammar Query;

query: (and | or | queryToken | parenthesized) EOF;

parenthesized: PARENS_OPEN (or | and) PARENS_CLOSE;
PARENS_OPEN: '(' ' '*;
PARENS_CLOSE:  ' '* ')';

// OR is a bit different because of operator precedence
or: (and | queryToken | parenthesized) (SEPARATOR OR SEPARATOR (and | queryToken | parenthesized))+;
OR: 'OR';

and: (queryToken | parenthesized) (SEPARATOR (AND SEPARATOR)? (queryToken | parenthesized))+;
AND: 'AND';

queryToken: (quoted | negated | propertyMatching | word);


quoted: SINGLE_QUOTED | DOUBLE_QUOTED;
SINGLE_QUOTED: '\'' SINGLE_QUOTED_CONTENT '\'' | '\'' '\'';
fragment SINGLE_QUOTED_CONTENT:~[']*; 
DOUBLE_QUOTED: '"' DOUBLE_QUOTED_CONTENT '"' | '"' '"';
fragment DOUBLE_QUOTED_CONTENT: ~["]*; 
    
negated: NEGATION (word | quoted | propertyMatching);
NEGATION: '-';

propertyMatching: name ':' value;
name: TOKEN;
value: word | quoted;

word: TOKEN;
TOKEN: ONE_CHAR_TOKEN | TWO_CHARS_TOKEN | MULTIPLE_CHARS_TOKEN;
fragment ONE_CHAR_TOKEN: ~[\r\n :\-()];
fragment TWO_CHARS_TOKEN: ~[\r\n :\-(]~[\r\n :)];
fragment MULTIPLE_CHARS_TOKEN:~[\r\n :\-(]~[\r\n :]+~[\r\n :)];
    
SEPARATOR: SPACING+ | EOF;
SPACING: [\r\n ];
