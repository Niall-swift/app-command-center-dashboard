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

  try {
    // Pegar variáveis de ambiente do Vercel
    const IXC_HOST = process.env.IXC_HOST || 'https://coopertecisp.com.br/webservice/v1';
    const IXC_TOKEN = process.env.IXC_TOKEN;

    if (!IXC_TOKEN) {
      return res.status(500).json({ 
        error: 'Token IXC não configurado nas variáveis de ambiente da Vercel' 
      });
    }

    // Extrair o path da requisição (ex: /api/ixc/cliente -> /cliente)
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
        'Authorization': `Basic ${IXC_TOKEN}`,
      },
      // Importante para certificados auto-assinados
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false
      })
    });

    // Retornar resposta do IXC
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Erro no proxy IXC:', error.message);
    
    if (error.response) {
      // Erro da API IXC
      res.status(error.response.status).json({
        error: 'Erro na API IXC',
        message: error.response.data || error.message
      });
    } else {
      // Erro de rede ou outro
      res.status(500).json({
        error: 'Erro no proxy',
        message: error.message
      });
    }
  }
}
