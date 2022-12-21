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
  const records = await context.collection.list(context.filter, [config.sourcename]);
  const keys = [...new Set(records.map(r => r[config.sourcename]).filter(path => !!path))];

  await Promise.all(keys.map(k => config.client.delete(k)));
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
