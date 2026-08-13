import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

let instance;

export function db() {
  if (!instance) {
    fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
    instance = new DatabaseSync(config.databasePath);
    instance.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  }
  return instance;
}

export function migrate() {
  const folder = path.join(config.root, 'migrations');
  for (const file of fs.readdirSync(folder).filter(name => name.endsWith('.sql')).sort()) {
    db().exec(fs.readFileSync(path.join(folder, file), 'utf8'));
  }
  db().exec('PRAGMA optimize;');
}

export function json(value, fallback = null) {
  if (value == null || value === '') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function now() { return new Date().toISOString(); }
