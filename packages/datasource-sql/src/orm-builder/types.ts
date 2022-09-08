export type Relation = {
  type: 'BelongsTo' | 'HasOne' | 'BelongsToMany' | 'HasMany';
  from: string;
  to: string;
  through?: string;
  foreignKey?: string;
  originKey?: string;
  foreignKeyTarget?: string;
  originKeyTarget?: string;
};
