import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env-test file for integration tests
config({ path: resolve(__dirname, '.env-test') });
