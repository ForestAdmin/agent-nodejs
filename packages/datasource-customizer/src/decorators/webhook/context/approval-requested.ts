/* eslint-disable max-classes-per-file */

import { Caller, Collection, Filter, RecordData } from '@forestadmin/datasource-toolkit';


import WebhookContext from '.';
import { TCollectionName, TFilter, TSchema } from '../../../templates';

type InternalRoleService = {
  getUsersForRoles: (roles: number[]) => Promise<{
    id: number;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    permissionLevel: string;
    tags: Record<string, string>;
    roleId: number;
  }[]>;
};

export default class WebhookApprovalRequestedContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends WebhookContext<S, N> {
  protected _filter: Filter;

  readonly roles: number[];
  readonly formValues: RecordData;
  readonly service: InternalRoleService;

  constructor(
    collection: Collection,
    caller: Caller,
    filter: Filter,

    flexContext: {
      formValues: RecordData,
      roles: number[],
      // I wanted to use it to retrieve users emails mainly..
      service: InternalRoleService
    }
  ) {
    super(collection, caller);

    this._filter = filter;
    this.formValues = flexContext.formValues;
    this.roles = flexContext.roles;
    this.service = flexContext.service;
  }

  get filter() {
    return Object.freeze(this._filter as unknown as TFilter<S, N>);
  }

  async getUsersAllowedToApprove() {
    try {
      const r = await this.service.getUsersForRoles(this.roles);
      return r;
    }catch(e) {
      console.log(e)
    }
  }
}
