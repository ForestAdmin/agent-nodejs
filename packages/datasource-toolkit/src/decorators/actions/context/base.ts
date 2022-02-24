import { Collection, DataSource } from '../../../interfaces/collection';
import { RecordData } from '../../../interfaces/record';

export default class ActionContext {
  readonly collection: Collection;
  readonly formValues: Record<string, unknown>;

  get dataSource(): DataSource {
    return this.collection.dataSource;
  }

  constructor(collection: Collection, formValue: RecordData, used?: Set<string>) {
    this.collection = collection;
    this.formValues = formValue;

    if (used) {
      this.formValues = new Proxy(this.formValues, {
        get: (target, prop, receiver) => {
          if (typeof prop === 'string') used.add(prop);

          return Reflect.get(target, prop, receiver);
        },
      });
    }
  }
}
