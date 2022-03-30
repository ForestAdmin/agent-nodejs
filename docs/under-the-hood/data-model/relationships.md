A jointure is used to combine rows from two or more tables, based on a related column between them.

## Declaration

In Forest Admin, relations are defined as fields and are traversable in only one direction.

## Jointure Types

Four jointure types are available: `ManyToOne`, `ManyToMany`, `OneToMany` and `OneToOne`.

| Type         | Where are the common keys?                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Many to One  | origin[foreignKey] == foreign[foreignKeyTarget]                                                  |
| One to Many  | origin[originKeyTarget] == foreign[originKey]                                                    |
| Many to Many | origin[originKeyTarget] == through[originKey] && though[foreignKey] == foreign[foreignKeyTarget] |
| One to One   | origin[originKeyTarget] == foreign[originKey]                                                    |
