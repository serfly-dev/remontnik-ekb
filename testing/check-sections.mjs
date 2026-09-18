import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const dbPath = join(rootDir, 'server', 'database', 'database.sqlite');

const db = new sqlite3.Database(dbPath);
db.all('SELECT key, content FROM sections', (err, rows) => {
  if (err) { console.error(err); process.exit(1); }
  rows.forEach(r => {
    const c = JSON.parse(r.content);
    const contentStr = JSON.stringify(c);
    const imgMatches = contentStr.match(/\/img\/(?:gallery|video|)[^\"]*/g);
    console.log('===', r.key, '=== img refs:', imgMatches?.length || 0);
    if (imgMatches) imgMatches.forEach(m => console.log('  ->', m));
  });
  db.close();
});
