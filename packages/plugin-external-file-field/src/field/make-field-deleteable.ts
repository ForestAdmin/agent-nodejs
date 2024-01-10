import type { Configuration } from '../types';
import type {
  CollectionCustomizer,
  HookBeforeDeleteContext,
  HookBeforeUpdateContext,
} from '@forestadmin/datasource-customizer';

async function deleteFiles(
  config: Configuration,
  context: HookBeforeUpdateContext | HookBeforeDeleteContext,
): Promise<void> {
  const projection = config.objectKeyFromRecord?.extraDependencies ?? [];

  if (!projection.includes(config.sourcename)) {
    projection.push(config.sourcename);
  }

  const records = await context.collection.list(context.filter, projection);
  let keys: string[];

  if (config.objectKeyFromRecord?.mappingFunction) {
    keys = await Promise.all(
      records.map(record => config.objectKeyFromRecord.mappingFunction(record, context)),
    );
  } else {
    keys = records.map(record => record[config.sourcename]);
  }

  const uniqueNonNull = [...new Set(keys.filter(path => !!path))];

  if (uniqueNonNull.length > 0) {
    await Promise.all(uniqueNonNull.map(k => config.client.delete(k)));
  }
}

export default function makeFieldDeleteable(
  collection: CollectionCustomizer,
  config: Configuration,
): void {
  if (!config.deleteFiles) return;

  collection.addHook('Before', 'Update', async context => {
    if (context.patch[config.filename] === null) {
      deleteFiles(config, context);
    }
  });

  collection.addHook('Before', 'Delete', async context => {
    deleteFiles(config, context);
  });
}
