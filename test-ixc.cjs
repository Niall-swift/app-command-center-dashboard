// Script de teste para API IXCSoft
// Execute com: node test-ixc.cjs

const axios = require('axios');
const https = require('https');

// Configurações (mesmas que serão usadas em produção)
const IXC_HOST = 'https://coopertecisp.com.br/webservice/v1';
const IXC_TOKEN = '29:ed30004f8207dbe08feb05005d67ea023793429a91210655cbf03fe12b1e4c94';

// Função para converter string para Base64 (mesma do React Native)
function stringToBase64(str) {
  const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";

  for (let i = 0; i < str.length; i += 3) {
    const chunk =
      (str.charCodeAt(i) << 16) |
      (str.charCodeAt(i + 1) << 8) |
      str.charCodeAt(i + 2);
    result +=
      base64Chars.charAt((chunk >> 18) & 0x3f) +
      base64Chars.charAt((chunk >> 12) & 0x3f) +
      base64Chars.charAt((chunk >> 6) & 0x3f) +
      base64Chars.charAt(chunk & 0x3f);
  }

  const padding = str.length % 3;
  if (padding === 1) {
    result = result.slice(0, -2) + "==";
  } else if (padding === 2) {
    result = result.slice(0, -1) + "=";
  }

  return result;
}

// Codificar token
const encodedToken = stringToBase64(IXC_TOKEN);

// Função para fazer requisição (formato React Native)
async function makeRequest(endpoint, data = {}, testName = '') {
  try {
    console.log(`\n🔄 ${testName}`);
    console.log('📤 Parâmetros:', JSON.stringify(data, null, 2));
    
    const options = {
      method: 'POST',
      url: `${IXC_HOST}${endpoint}`,
      headers: {
        'Authorization': `Basic ${encodedToken}`,
        'ixcsoft': 'listar',
      },
      data: data,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      }),
      timeout: 15000
    };
    
    const response = await axios(options);
    
    console.log('✅ Sucesso!');
    console.log('📊 Total:', response.data.total || 0);
    console.log('📊 Página:', response.data.page || 'N/A');
    
    if (response.data.registros && response.data.registros.length > 0) {
      console.log('📋 Primeiros 3 clientes:');
      response.data.registros.slice(0, 3).forEach((cliente, index) => {
        console.log(`   ${index + 1}. ID: ${cliente.id} | Nome: ${cliente.razao || cliente.nome} | CPF/CNPJ: ${cliente.cnpj_cpf || 'N/A'}`);
      });
    } else {
      console.log('⚠️  Nenhum cliente encontrado com esses parâmetros');
    }
    
    return response.data;
  } catch (error) {
    console.log('❌ Erro!');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Dados:', typeof error.response.data === 'string' ? error.response.data.substring(0, 200) : error.response.data);
    } else {
      console.log('Mensagem:', error.message);
    }
    throw error;
  }
}

// Testes
async function runTests() {
  console.log('🧪 Testando diferentes formas de consulta...\n');
  console.log('🌐 Host:', IXC_HOST);
  console.log('🔑 Token:', IXC_TOKEN.substring(0, 10) + '...\n');
  
  const tests = [
    {
      name: 'Teste 1: Buscar TODOS os clientes (sem filtro)',
      params: {
        qtype: 'cliente.id',
        query: '',
        oper: 'LIKE',
        page: '1',
        rp: '10',
        sortname: 'cliente.id',
        sortorder: 'desc'
      }
    },
    {
      name: 'Teste 2: Buscar por ID maior que 0',
      params: {
        qtype: 'cliente.id',
        query: '0',
        oper: '>',
        page: '1',
        rp: '10',
        sortname: 'cliente.id',
        sortorder: 'desc'
      }
    },
    {
      name: 'Teste 3: Buscar clientes ativos',
      params: {
        qtype: 'cliente.ativo',
        query: 'S',
        oper: '=',
        page: '1',
        rp: '10',
        sortname: 'cliente.id',
        sortorder: 'desc'
      }
    },
    {
      name: 'Teste 4: Buscar por razão social (LIKE %)',
      params: {
        qtype: 'cliente.razao',
        query: '%',
        oper: 'LIKE',
        page: '1',
        rp: '10',
        sortname: 'cliente.id',
        sortorder: 'desc'
      }
    },
    {
      name: 'Teste 5: Sem parâmetros de filtro',
      params: {
        page: '1',
        rp: '10',
        sortname: 'cliente.id',
        sortorder: 'desc'
      }
    }
  ];

  let successCount = 0;
  let foundClients = false;

  for (const test of tests) {
    try {
      console.log('\n═══════════════════════════════════════');
      const result = await makeRequest('/cliente', test.params, test.name);
      successCount++;
      
      if (result.total > 0) {
        foundClients = true;
        console.log(`\n✅ ENCONTROU ${result.total} CLIENTES!`);
        break; // Para no primeiro que encontrar
      }
    } catch (error) {
      console.log(`\n⚠️  ${test.name} falhou`);
    }
  }

  console.log('\n\n═══════════════════════════════════════');
  console.log(`📊 Resumo: ${successCount}/${tests.length} testes executados com sucesso`);
  
  if (foundClients) {
    console.log('✅ CLIENTES ENCONTRADOS!');
    console.log('🎉 A consulta está funcionando!');
  } else {
    console.log('⚠️  NENHUM CLIENTE ENCONTRADO');
    console.log('\n💡 Possíveis causas:');
    console.log('   1. Não há clientes cadastrados no sistema');
    console.log('   2. Os clientes estão em outra base de dados');
    console.log('   3. Há filtros adicionais no servidor');
    console.log('   4. Verifique no painel IXC se há clientes cadastrados');
  }
  console.log('═══════════════════════════════════════\n');
}

// Executar testes
runTests();
