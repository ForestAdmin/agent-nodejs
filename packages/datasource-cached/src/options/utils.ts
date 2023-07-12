/* eslint-disable import/prefer-default-export */
import { ValueOrPromiseOrFactory } from '../types';

export async function resolveValueOrPromiseOrFactory<T extends object>(
  v: ValueOrPromiseOrFactory<T>,
): Promise<T> {
  return typeof v === 'function' ? v() : v;
}
