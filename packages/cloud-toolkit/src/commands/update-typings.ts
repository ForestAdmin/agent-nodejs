import generateOrUpdateTypings from '../services/typings-updater';

const run = async (): Promise<void> => {
  await generateOrUpdateTypings();
};

run()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Typings updated.');
  })
  .catch(e => console.error(e));
