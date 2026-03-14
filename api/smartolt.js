import axios from 'axios';

export default async function handler(req, res) {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Variáveis de ambiente
  const SMARTOLT_BASE_URL = process.env.VITE_SMARTOLT_BASE_URL || 'https://api.smartolt.com/api/v2';
  const SMARTOLT_API_KEY = process.env.VITE_SMARTOLT_API_KEY;

  try {
    if (!SMARTOLT_API_KEY) {
      return res.status(500).json({ 
        error: 'Configuration Error',
        message: 'VITE_SMARTOLT_API_KEY is missing in Vercel environment variables'
      });
    }

    // Extrair o path da requisição
    const path = req.url.replace('/api/smartolt', '');
    const url = `${SMARTOLT_BASE_URL}${path}`;

    // Fazer requisição para o SmartOLT
    const response = await axios({
      method: req.method,
      url: url,
      data: req.body,
      params: req.query,
      headers: {
        'Accept': 'application/json',
        'X-Token': SMARTOLT_API_KEY,
      }
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Erro no proxy SmartOLT:', error.message);
    
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Proxy Error', message: error.message });
    }
  }
}
