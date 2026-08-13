import { migrate } from './db.js';
import { seedDemo } from './seed.js';
import { syncContentLibrary } from './content-sync.js';

const command = process.argv[2] || 'init';
migrate();
if (command === 'init') console.log('Database initialized.');
else if (command === 'seed') console.log(JSON.stringify(seedDemo(), null, 2));
else if (command === 'sync') console.log(JSON.stringify(syncContentLibrary(), null, 2));
else { console.error(`Unknown command: ${command}`); process.exitCode = 1; }

