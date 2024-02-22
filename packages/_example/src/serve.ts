import run from './index';

run().catch(e => {
  console.error(e);
  process.exit(1);
});
