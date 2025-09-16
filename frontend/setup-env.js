#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const environment = args[0] || 'development';

const envFiles = {
  development: 'env.development',
  production: 'env.production'
};

const envFile = envFiles[environment];

if (!envFile) {
  console.error('❌ Environment tidak valid. Gunakan: development atau production');
  console.log('Contoh: node setup-env.js development');
  process.exit(1);
}

const sourceFile = path.join(__dirname, envFile);
const targetFile = path.join(__dirname, '.env');

if (!fs.existsSync(sourceFile)) {
  console.error(`❌ File ${envFile} tidak ditemukan!`);
  process.exit(1);
}

try {
  fs.copyFileSync(sourceFile, targetFile);
  console.log(`✅ Environment ${environment} berhasil di-setup!`);
  console.log(`📁 File .env telah dibuat dari ${envFile}`);
  
  // Baca nilai aktual dari file .env yang baru dibuat dan tampilkan
  try {
    const fileContent = fs.readFileSync(targetFile, 'utf8');
    const lines = fileContent.split(/\r?\n/);
    const envMap = {};
    for (const line of lines) {
      if (!line || line.trim().startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      envMap[key] = value;
    }

    const apiUrl = envMap['VITE_API_URL'];
    const nodeEnv = envMap['NODE_ENV'] || environment;

    console.log(`🔧 NODE_ENV: ${nodeEnv ?? '-'} (dari ${envFile})`);
    if (apiUrl) {
      console.log(`🌐 VITE_API_URL: ${apiUrl} (dari ${envFile})`);
    }
  } catch (readErr) {
    console.warn('⚠️ Gagal membaca nilai dari .env:', readErr.message);
  }
} catch (error) {
  console.error('❌ Error saat setup environment:', error.message);
  process.exit(1);
}
