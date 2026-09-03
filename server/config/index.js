import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');

export default {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  session: {
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    resave: false,
    saveUninitialized: false
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin'
  },
  db: {
    path: process.env.DB_PATH || join(rootDir, 'server', 'database', 'database.sqlite')
  },
  isProduction: process.env.NODE_ENV === 'production',
  rootDir
};
