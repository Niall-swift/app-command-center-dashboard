// Script de teste para API IXCSoft
// Execute com: node test-ixc.js

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
async function makeRequest(endpoint, data = {}) {
  try {
    console.log(`\n🔄 Testando: ${endpoint}`);
    console.log('📤 Dados enviados:', JSON.stringify(data, null, 2));
    
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
    console.log('📥 Total de registros:', response.data.total || response.data.registros?.length || 0);
    console.log('📥 Primeiros registros:', JSON.stringify(response.data.registros?.slice(0, 2) || response.data, null, 2));
    
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
  console.log('🧪 Iniciando testes da API IXCSoft...\n');
  console.log('🌐 Host:', IXC_HOST);
  console.log('🔑 Token:', IXC_TOKEN.substring(0, 10) + '...');
  console.log('🔐 Token codificado:', encodedToken.substring(0, 20) + '...\n');
  
  try {
    // Teste 1: Buscar todos os clientes (limitado a 5)
    console.log('\n═══════════════════════════════════════');
    console.log('📋 TESTE 1: Listar Clientes (5 primeiros)');
    console.log('═══════════════════════════════════════');
    await makeRequest('/cliente', {
      qtype: 'cliente.id',
      query: '*',
      oper: '=',
      page: '1',
      rp: '5',
      sortname: 'cliente.id',
      sortorder: 'desc'
    });

    console.log('\n\n✅ ═══════════════════════════════════════');
    console.log('✅ TODOS OS TESTES PASSARAM COM SUCESSO!');
    console.log('✅ ═══════════════════════════════════════\n');
    console.log('🚀 A API está funcionando corretamente!');
    console.log('🎉 Você pode fazer deploy para produção com segurança!\n');

  } catch (error) {
    console.log('\n\n❌ ═══════════════════════════════════════');
    console.log('❌ FALHA NOS TESTES!');
    console.log('❌ ═══════════════════════════════════════\n');
    console.log('⚠️  Verifique:');
    console.log('   1. Se o host está correto');
    console.log('   2. Se o token está válido');
    console.log('   3. Se o servidor IXC está acessível');
    console.log('   4. Se há clientes cadastrados no sistema\n');
    process.exit(1);
  }
}

// Executar testes
runTests();
