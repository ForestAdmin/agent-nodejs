A jointure is used to combine rows from two or more tables, based on a related column between them.

## Declaration

In Forest Admin, relations are defined as fields and are traversable in only one direction.

## Jointure Types

Four jointure types are available: `ManyToOne`, `ManyToMany`, `OneToMany` and `OneToOne`.

| Type       | Where are the common keys?                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------- |
| ManyToOne  | `origin[foreignKey] == foreign[foreignKeyTarget]`                                                  |
| OneToMany  | `origin[originKeyTarget] == foreign[originKey]`                                                    |
| ManyToMany | `origin[originKeyTarget] == through[originKey] && though[foreignKey] == foreign[foreignKeyTarget]` |
| OneToOne   | `origin[originKeyTarget] == foreign[originKey]`                                                    |
