import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'public');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const files = ['index.html', 'logo.png', 'logo-ui.png', 'config.js', 'config.example.js'];
for (const f of files) {
  const src = path.join(__dirname, f);
  const dest = path.join(outDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${f} to public/`);
  }
}

console.log('Static build completed successfully in public/');
