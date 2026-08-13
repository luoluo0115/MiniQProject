import fs from 'node:fs';
import { config } from './config.js';
import { migrate } from './db.js';
import { syncContentLibrary } from './content-sync.js';

migrate();
fs.mkdirSync(config.contentLibraryPath, { recursive: true });
console.log(`Watching ${config.contentLibraryPath}`);
let timer;
const run = () => {
  try { console.log(new Date().toISOString(), syncContentLibrary()); }
  catch (error) { console.error(new Date().toISOString(), error); }
};
run();
fs.watch(config.contentLibraryPath, { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(run, 1200);
});

