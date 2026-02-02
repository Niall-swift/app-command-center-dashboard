import axios from 'axios';

export default async function handler(req, res) {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, ixcsoft'
  );

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Variáveis de ambiente
  const IXC_HOST = process.env.IXC_HOST || 'https://coopertecisp.com.br/webservice/v1';
  const IXC_TOKEN = process.env.IXC_TOKEN;

  try {
    if (!IXC_TOKEN) {
      return res.status(500).json({ 
        error: 'Configuration Error',
        message: 'IXC_TOKEN is missing in Vercel environment variables',
        debug: {
           host: IXC_HOST,
           hasToken: false
        }
      });
    }

    // Codificar token usando Buffer (padrão Node.js)
    const encodedToken = Buffer.from(IXC_TOKEN).toString('base64');

    // Extrair o path da requisição
    const path = req.url.replace('/api/ixc', '');
    const url = `${IXC_HOST}${path}`;

    // Fazer requisição para o IXC
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
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false
      })
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Erro no proxy IXC:', error.message);
    
    const errorResponse = {
        error: 'Proxy Error',
        message: error.message,
        debug: {
            host: IXC_HOST,
            url: error.config?.url,
            hasToken: !!IXC_TOKEN,
            status: error.response?.status,
            data: error.response?.data
        }
    };

    if (error.response) {
      res.status(error.response.status).json({
          ...errorResponse,
          error: 'Upstream API Error', 
          message: JSON.stringify(error.response.data) || error.message
      });
    } else {
      res.status(500).json(errorResponse);
    }
  }
}
