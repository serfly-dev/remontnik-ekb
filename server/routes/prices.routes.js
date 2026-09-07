/**
 * Public prices endpoint — used by frontend calculator to fetch rates from data/prices.json.
 * Path resolution uses the same rootDir logic as server.js.
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..', '..');
const PRICES_PATH = path.join(rootDir, 'data', 'prices.json');

export function initPricesRoutes(app) {
  app.get('/api/prices', (req, res) => {
    try {
      if (!existsSync(PRICES_PATH)) {
        return res.status(404).json({ success: false, message: 'Файл цен не найден' });
      }
      const raw = readFileSync(PRICES_PATH, 'utf8');
      const data = JSON.parse(raw);
      res.json({ success: true, data });
    } catch (err) {
      console.error('Prices read error:', err.message);
      res.status(500).json({ success: false, message: 'Ошибка чтения цен' });
    }
  });
}
