#!/usr/bin/env node
import { runServer } from './server.js';

runServer().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
