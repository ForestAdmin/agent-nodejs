/* eslint-disable max-classes-per-file */

export class BusinessError extends Error {
  public readonly data: Record<string, unknown> | undefined;

  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message);
    this.name = name ?? this.constructor.name;
    this.data = data;
  }
}

export class OutdatedPackageForIntrospection extends BusinessError {}
export class InvalidIntrospectionSource extends BusinessError {}
