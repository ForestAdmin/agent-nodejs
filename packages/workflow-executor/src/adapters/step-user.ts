import type { StepUser } from '../types/execution-context';

import jsonwebtoken from 'jsonwebtoken';

const AGENT_TOKEN_TTL = '5m';

/**
 * What a run envelope's `userProfile` and an automated inbox's service-account profile have in
 * common. The optional strings are what the server actually sends as null.
 */
export interface StepUserProfile {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  team?: string | null;
  renderingId: number;
  role?: string | null;
  permissionLevel?: string | null;
  tags: Record<string, string>;
}

/**
 * Shared so a run-driven step and an automation poll reach the agent as the exact same caller: the
 * JWT they mint has to carry identical claims, or the same account would be two callers.
 */
export function toStepUser(profile: StepUserProfile): StepUser {
  return {
    id: profile.id,
    email: profile.email,
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    team: profile.team ?? '',
    renderingId: profile.renderingId,
    role: profile.role ?? '',
    permissionLevel: profile.permissionLevel ?? '',
    tags: profile.tags,
  };
}

export function mintStepToken(user: StepUser, authSecret: string): string {
  // snake_case aliases: Ruby/Python agents splat JWT claims into Caller.new (snake_case kwargs).
  return jsonwebtoken.sign(
    {
      ...user,
      first_name: user.firstName,
      last_name: user.lastName,
      rendering_id: user.renderingId,
      permission_level: user.permissionLevel,
      scope: 'step-execution',
    },
    authSecret,
    { expiresIn: AGENT_TOKEN_TTL },
  );
}
