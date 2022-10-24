import ContextVariables, { RequestContextVariables } from './context-variables';
import RenderingPermissionService from '../permissions/rendering-permission';

export default class ContextVariablesInstantiator {
  constructor(private readonly renderingPermissionService: RenderingPermissionService) {}

  public async buildContextVariables({
    requestContextVariables = {},
    renderingId,
    userId,
  }: {
    requestContextVariables?: RequestContextVariables;
    renderingId: string | number;
    userId: string | number;
  }) {
    const team = await this.renderingPermissionService.getTeam(renderingId);
    const user = await this.renderingPermissionService.getUser(userId);

    return new ContextVariables({ requestContextVariables, team, user });
  }
}
