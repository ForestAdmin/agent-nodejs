export type Caller = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  team: string;
  renderingId: number;
  requestId: string;
  request: { ip: string };
  role: string;
  tags: { [key: string]: string };
  permissionLevel: 'admin' | 'developer' | 'editor' | 'user';
  timezone: string;
};
