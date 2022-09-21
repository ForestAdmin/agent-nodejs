import { AgentOptionsWithDefaults } from '../../../types';
import { UserPermissionV4 } from './types';
import ForestHttpApi from '../../../utils/forest-http-api';

export type UserPermissionOptions = Pick<
  AgentOptionsWithDefaults,
  'forestServerUrl' | 'envSecret' | 'isProduction' | 'permissionsCacheDurationInSeconds'
>;

export default class UserPermissionService {
  private lastRetrieval: Date;

  private userInfoById: Promise<Map<number, UserPermissionV4>> = null;

  constructor(private readonly options: UserPermissionOptions) {}

  public async getUserInfo(userId: number): Promise<UserPermissionV4 | undefined> {
    if (
      !this.lastRetrieval ||
      this.lastRetrieval.getTime() <
        Date.now() - this.options.permissionsCacheDurationInSeconds * 1000 ||
      !(await this.userInfoById).has(userId)
    ) {
      this.lastRetrieval = new Date();

      this.userInfoById = ForestHttpApi.getUsers(this.options).then(
        users => new Map(users.map(user => [user.id, user])),
      );
    }

    return (await this.userInfoById).get(userId);
  }
}
