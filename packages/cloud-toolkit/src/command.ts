#!/usr/bin/env node
/* istanbul ignore file */

import { configDotenv } from 'dotenv';

import buildCommand from './build-command';

configDotenv();
buildCommand().parseAsync();
