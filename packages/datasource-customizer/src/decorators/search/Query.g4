grammar Query;

query: (and | or | queryToken) EOF;
parenthesized: '(' (or | and) ')';

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
TOKEN: ~[\r\n :\-()]~[\r\n :()]*;
    
SEPARATOR: SPACING | EOF;
SPACING: [\r\n ]+;

