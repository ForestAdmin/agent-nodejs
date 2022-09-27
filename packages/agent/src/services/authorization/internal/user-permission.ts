import { AgentOptionsWithDefaults } from '../../../types';
import { UserPermissionV4 } from './types';
import ForestHttpApi from '../../../utils/forest-http-api';

export type UserPermissionOptions = Pick<
  AgentOptionsWithDefaults,
  'forestServerUrl' | 'envSecret' | 'isProduction' | 'permissionsCacheDurationInSeconds'
>;

export default class UserPermissionService {
  private cacheExpirationTimestamp = 0;

  // The trick here is to keep the cache as a Promise and not a Map
  // in order to avoid doing the same HTTP request twice when
  // 2 calls are made to getUserInfo at the same time.
  private userInfoById: Promise<Map<number, UserPermissionV4>> = null;

  constructor(private readonly options: UserPermissionOptions) {}

  public async getUserInfo(userId: number): Promise<UserPermissionV4 | undefined> {
    if (
      !this.cacheExpirationTimestamp ||
      this.cacheExpirationTimestamp < Date.now() ||
      !(await this.userInfoById).has(userId)
    ) {
      this.cacheExpirationTimestamp =
        Date.now() + this.options.permissionsCacheDurationInSeconds * 1000;

      // The response here is not awaited in order to be set in the cache
      // allowing subsequent calls to getUserInfo to use the cache even if
      // the response is not yet available.
      this.userInfoById = ForestHttpApi.getUsers(this.options).then(
        users => new Map(users.map(user => [user.id, user])),
      );
    }

    return (await this.userInfoById).get(userId);
  }

  public clearCache() {
    this.userInfoById = null;
    this.cacheExpirationTimestamp = Number.NEGATIVE_INFINITY;
  }
}
