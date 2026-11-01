import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalServer } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root data directory
const dataDir = process.env.DATA_DIR || path.resolve(__dirname, '../../data');
const port = parseInt(process.env.PORT || '3001', 10);
const host = process.env.HOST || '0.0.0.0';

const instance = createLocalServer({
  port,
  host,
  dataDir,
});

instance.start().catch((err) => {
  console.error('Falha ao iniciar servidor local:', err);
  process.exit(1);
});
