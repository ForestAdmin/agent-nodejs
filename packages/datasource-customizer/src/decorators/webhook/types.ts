import WebhookContext from './context';
import WebhookApprovalRequestedContext from './context/approval-requested';
import { TCollectionName, TSchema } from '../../templates';

export { WebhookContext, WebhookApprovalRequestedContext };

export type WebhookHandler<
  C extends WebhookContext<S, N>,
  R = void,
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = (context: C) => Promise<R> | R;

export type WebhookType = Extract<keyof WebhooksContext, string>;

export type WebhooksContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = {
  ApprovalRequested: WebhookApprovalRequestedContext<S, N>;
  Approval: WebhookApprovalRequestedContext<S, N>; // This does not exist
};
