
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import https from 'https';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// ============================================================================
// API PROXY (Replaces api/ixc.js)
// ============================================================================
app.all('/api/ixc*', async (req, res) => {
  const IXC_HOST = process.env.IXC_HOST || 'https://coopertecisp.com.br/webservice/v1';
  const IXC_TOKEN = process.env.IXC_TOKEN;

  // Basic CORS for API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, ixcsoft');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (!IXC_TOKEN) {
      console.error('Configuration Error: IXC_TOKEN missing');
      return res.status(500).json({ error: 'IXC_TOKEN not configured on server' });
    }

    const encodedToken = Buffer.from(IXC_TOKEN).toString('base64');
    const path = req.originalUrl.replace('/api/ixc', '');
    const url = `${IXC_HOST}${path}`;

    console.log(`[Proxy] ${req.method} ${url}`);

    const response = await axios({
      method: req.method,
      url: url,
      data: req.body,
      params: req.query,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${encodedToken}`,
        'ixcsoft': 'listar',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('[Proxy Error]', error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Proxy Error', message: error.message });
    }
  }
});

// ============================================================================
// STATIC FILES (Serves React App)
// ============================================================================
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA Fallback: Any other route returns index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`👉 http://localhost:${PORT}`);
});
