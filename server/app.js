import express from 'express';
import cors from 'cors';
import apiRouter from './api.js';

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'Oxford-Tok',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    platform: process.env.VERCEL ? 'vercel-serverless' : (process.env.NODE_ENV || 'development')
  });
});

// Mount Oxford API
app.use('/api', apiRouter);

export default app;
