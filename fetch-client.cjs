const axios = require('axios');
const token = '815e74b02bc6faa371f29274e3d317e0';
const baseURL = 'https://coopertecisp.com.br:8043';

async function fetchClient() {
  try {
    const res = await axios.get(baseURL + '/api/object/cliente', {
      headers: { Token: token },
      params: { 
        filter: '[["nome_razao","L","PETRONIO"]]',
        limit: 1
      },
      httpsAgent: new (require('https')).Agent({ rejectUnauthorized: false })
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error(e.message);
    if(e.response) console.error(e.response.data);
  }
}
fetchClient();
