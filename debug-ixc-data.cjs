
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Ler .env.local simples para pegar credenciais
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.trim();
  }
});

const token = env['VITE_IXC_TOKEN'];
const host = 'https://coopertecisp.com.br/webservice/v1'; // URL Real descoberta no vite.config.ts

if (!token || !host) {
  console.error('Credenciais nao encontradas');
  process.exit(1);
}

const encodedToken = Buffer.from(token).toString('base64');

const api = axios.create({
  baseURL: host,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${encodedToken}`,
    'ixcsoft': 'listar'
  }
});

async function fetchContracts() {
    console.log('Investigando status alternativos (CA, CM, FA)...');
    
    const statuses = ['CA', 'CM', 'FA']; 
    
    for (const st of statuses) {
        const data = {
          qtype: 'cliente_contrato.status_internet',
          query: st,
          oper: '=',
          page: '1',
          rp: '10', // Só preciso do count
        };

        try {
          const res = await api.post('/cliente_contrato', data);
          console.log(`Status '${st}': ${res.data.total || 0} registros`);
          
          if (res.data.registros && res.data.registros.length > 0) {
              console.log(`  Exemplo '${st}':`, JSON.stringify(res.data.registros[0], null, 2));
          }
        } catch (error) {
          console.error(`Erro buscando status ${st}:`, error.message);
        }
    }
}

fetchContracts();
// fetchRadUsuarios();

async function run() {
  try {
    await fetchContracts();
  } catch (error) {
    console.error('Erro geral:', error);
  }
}

run();
