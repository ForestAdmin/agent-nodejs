import { Collection, DataSource } from '../../../interfaces/collection';
import { RecordData } from '../../../interfaces/record';

export default class ActionContext {
  readonly collection: Collection;
  readonly formValues: Record<string, unknown>;
  private used: Set<string>;

  get dataSource(): DataSource {
    return this.collection.dataSource;
  }

  constructor(collection: Collection, formValue: RecordData, used?: Set<string>) {
    this.collection = collection;
    this.formValues = formValue;

    if (used) {
      this.used = used;
      this.formValues = new Proxy(this.formValues, {
        get: (target, prop, receiver) => {
          if (typeof prop === 'string') this.used.add(prop);

          return Reflect.get(target, prop, receiver);
        },
      });
    }
  }
}
