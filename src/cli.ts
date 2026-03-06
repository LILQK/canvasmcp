#!/usr/bin/env node
import { runServer } from './server.js';

function printUsage(): void {
  console.error('Usage: canvasmcp run');
}

async function main(argv: string[]): Promise<void> {
  const [command] = argv;

  if (command === 'run') {
    await runServer();
    return;
  }

  printUsage();
  process.exit(1);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});

