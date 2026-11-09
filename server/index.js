import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { fileURLToPath } from 'node:url';
import app from './app.js';
import { seedDatabase } from './seed.js';
import { syncOxford3000Catalog, startAutonomousOxfordWorker } from './oxfordEngine.js';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

process.on('uncaughtException', (err) => {
  console.error('Handled uncaughtException:', err?.stack || err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Handled unhandledRejection:', reason?.stack || reason?.message || reason);
});
process.on('exit', (code) => {
  console.log('NODE PROCESS EXIT EVENT WITH CODE:', code);
});
process.on('SIGTERM', () => {
  console.log('NODE PROCESS RECEIVED SIGTERM');
});
process.on('SIGINT', () => {
  console.log('NODE PROCESS RECEIVED SIGINT');
});

// Ensure database has initial curated words + full 3,000+ Oxford 3000™ catalog
try {
  const count = db.prepare('SELECT COUNT(*) as c FROM words').get().c;
  if (count === 0) {
    console.log('Oxford database empty, seeding initial vocabulary...');
    seedDatabase();
  }
} catch (e) {
  console.warn('Word count check note:', e.message);
}

// Autonomously synchronize full Oxford 3000™ catalog & start live background enrichment engine (when running persistent server)
if (!process.env.VERCEL) {
  syncOxford3000Catalog().then(() => {
    startAutonomousOxfordWorker();
  }).catch((err) => {
    console.warn('Background sync note:', err.message);
  });
}

// Setup Vite middleware in dev or static files in production
if (!isProd) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: { server },
      watch: {
        ignored: ['**/data/**', '**/*.db*']
      }
    },
    appType: 'spa',
    root: rootDir
  });
  app.use(vite.middlewares);
  console.log('⚡ Vite HMR middleware integrated');
} else {
  const distDir = path.join(rootDir, 'dist');
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

server.listen(PORT, () => {
  console.log(`\n🚀 OXFORD-TOK Server is running at: http://localhost:${PORT}`);
  console.log(`🔥 Autonomous Oxford 3000™ Multidimensional Engine & SM-2 SRS Active\n`);
});

export { app, server };
