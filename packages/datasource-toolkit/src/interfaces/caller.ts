export type Caller = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  team: string;
  renderingId: number;
  role: string;
  tags: { [key: string]: string };
  timezone: string;
  from: 'ListView' | 'Typeahead';
};
