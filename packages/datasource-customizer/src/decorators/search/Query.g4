grammar Query;

query: (queryPart SEPARATOR)* queryPart EOF;
queryPart: or | and | queryToken;

or: queryToken (SEPARATOR OR SEPARATOR queryToken)+;
OR: 'OR';

and: queryToken (SEPARATOR AND SEPARATOR queryToken)+;
AND: 'AND';


queryToken: (quoted | negated | propertyMatching | word);


quoted: SINGLE_QUOTED | DOUBLE_QUOTED;
SINGLE_QUOTED: '\'' SINGLE_QUOTED_CONTENT '\'';
fragment SINGLE_QUOTED_CONTENT:~[']*; 
DOUBLE_QUOTED: '"' DOUBLE_QUOTED_CONTENT '"';
fragment DOUBLE_QUOTED_CONTENT: ~["]*; 
    
negated: NEGATION (word | quoted | propertyMatching);
NEGATION: '-';

propertyMatching: name ':' value;
name: TOKEN;
value: word | quoted;

word: TOKEN;
TOKEN: ~[\r\n :\-]~[\r\n :]*;
    
SEPARATOR: SPACING | EOF;
SPACING: [\r\n ]+;

