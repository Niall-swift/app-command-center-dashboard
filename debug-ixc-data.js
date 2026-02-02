
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
const host = env['VITE_IXC_HOST'];

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

async function fetchAllClientesAtivos() {
  console.log('Buscando clientes ativos...');
  let allClientes = [];
  let page = 1;
  let hasMore = true;
  const rp = 1000;

  while (hasMore) {
    const data = {
      qtype: 'cliente.ativo',
      query: 'S',
      oper: '=',
      page: page.toString(),
      rp: rp.toString(),
      sortname: 'cliente.id',
      sortorder: 'desc',
    };

    try {
      console.log(`Buscando pagina ${page}...`);
      const response = await api.post('/cliente', data);
      const registros = response.data.registros || [];
      allClientes = [...allClientes, ...registros];
      console.log(`Encontrados ${registros.length} clientes na pagina ${page}`);
      
      if (registros.length < rp) {
        hasMore = false;
      } else {
        page++;
      }
    } catch (error) {
      console.error('Erro ao buscar clientes:', error.message);
      if (error.response) console.error(error.response.data);
      hasMore = false;
    }
  }
  return allClientes;
}

async function fetchAllFaturasAbertas() {
  console.log('Buscando faturas em aberto...');
  let allFaturas = [];
  let page = 1;
  let hasMore = true;
  const rp = 1000;

  while (hasMore) {
    const data = {
      qtype: 'fn_areceber.status',
      query: 'A',
      oper: '=',
      page: page.toString(),
      rp: rp.toString(),
      sortname: 'fn_areceber.data_vencimento',
      sortorder: 'asc',
    };

    try {
      console.log(`Buscando pagina ${page}...`);
      const response = await api.post('/fn_areceber', data);
      const registros = response.data.registros || [];
      const abertas = registros.filter(f => !f.data_pagamento);
      
      allFaturas = [...allFaturas, ...abertas];
      console.log(`Encontradas ${abertas.length} faturas abertas na pagina ${page}`);
      
      if (registros.length < rp) {
        hasMore = false;
      } else {
        page++;
      }
    } catch (error) {
      console.error('Erro ao buscar faturas:', error.message);
      hasMore = false;
    }
  }
  return allFaturas;
}

async function run() {
  try {
    const clientes = await fetchAllClientesAtivos();
    console.log(`TOTAL Clientes Ativos: ${clientes.length}`);
    if (clientes.length > 0) {
        console.log('Exemplo Cliente:', JSON.stringify(clientes[0], null, 2));
    }

    const faturas = await fetchAllFaturasAbertas();
    console.log(`TOTAL Faturas Abertas: ${faturas.length}`);
    if (faturas.length > 0) {
        console.log('Exemplo Fatura:', JSON.stringify(faturas[0], null, 2));
    }

    // Tentar cruzar dados
    let matches = 0;
    faturas.forEach(f => {
      // Tentar match por id_cliente e cliente_id ambos como string vs number
      const c = clientes.find(cli => String(cli.id) === String(f.id_cliente || f.cliente_id));
      if (c) matches++;
    });
    console.log(`Faturas com cliente correspondente encontrado: ${matches}`);

    // Verificar clientes sem celular
    const clientesComCelular = clientes.filter(c => c.fone_celular);
    console.log(`Clientes com celular: ${clientesComCelular.length}`);

  } catch (error) {
    console.error('Erro geral:', error);
  }
}

run();
