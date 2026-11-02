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

const destConfig = path.join(outDir, 'config.js');
if (!fs.existsSync(destConfig)) {
  const envUrl = process.env.SUPABASE_URL || 'https://qzwunvyrozubfgwlkenh.supabase.co';
  const envKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6d3Vudnlyb3p1YmZnd2xrZW5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NTkzNDIsImV4cCI6MjEwOTEzNTM0Mn0.7j1ZYb3G88OVgh8Bvir2ih47BE7mrcdLSbfUBw6OqR4';
  fs.writeFileSync(
    destConfig,
    `window.IPTV_CONFIG = {\n  supabaseUrl: ${JSON.stringify(envUrl)},\n  supabaseAnonKey: ${JSON.stringify(envKey)}\n};\n`,
    'utf-8'
  );
  console.log('Generated public/config.js with Supabase public configuration.');
}

console.log('Static build completed successfully in public/');
