#!/usr/bin/env node
/* istanbul ignore file */

import { configDotenv } from 'dotenv';

import buildCommands from './build-commands';

configDotenv();
buildCommands().parseAsync();
