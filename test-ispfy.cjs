/**
 * Script de teste da API ISPFY
 * Testa as chamadas no formato correto (GET /api/object/* com Token header)
 * 
 * Execução: node test-ispfy.cjs
 * (O servidor dev deve estar rodando em localhost:8081)
 */

const http = require('http');

const HOST = 'localhost';
const PORT = 8080; // porta do Vite dev server (proxy)
const TOKEN = '815e74b02bc6faa371f29274e3d317e0';

function makeRequest(path, label) {
  return new Promise((resolve) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: 'GET',
      headers: {
        'Token': TOKEN,
        'Content-Type': 'application/json',
      },
    };

    console.log(`\n🔵 [${label}]`);
    console.log(`   → GET http://${HOST}:${PORT}${path}`);

    const start = Date.now();
    const req = http.request(options, (res) => {
      const elapsed = Date.now() - start;
      let data = '';

      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const statusEmoji = res.statusCode === 200 ? '✅' : res.statusCode < 500 ? '⚠️' : '❌';
        console.log(`   ${statusEmoji} Status: ${res.statusCode} (${elapsed}ms)`);

        try {
          const json = JSON.parse(data);
          
          // Detectar formato de resposta
          if (json.rows !== undefined) {
            console.log(`   📦 Formato: ISPFY (rows[])`);
            console.log(`   📊 Total registros: ${json.total ?? 'N/A'}`);
            console.log(`   📝 Rows retornadas: ${json.rows?.length ?? 0}`);
            if (json.rows?.length > 0) {
              const first = json.rows[0];
              const keys = Object.keys(first).slice(0, 5);
              console.log(`   🔑 Campos: ${keys.join(', ')}...`);
            }
          } else if (json.registros !== undefined) {
            console.log(`   📦 Formato: Legado IXC (registros[])`);
            console.log(`   📊 Registros: ${json.registros?.length ?? 0}`);
          } else if (json.error || json.message) {
            console.log(`   ⛔ Erro da API: ${json.error || json.message}`);
          } else {
            const preview = JSON.stringify(json).slice(0, 200);
            console.log(`   📄 Resposta: ${preview}...`);
          }
        } catch {
          const preview = data.slice(0, 300);
          console.log(`   📄 Resposta (texto): ${preview}`);
        }

        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', (err) => {
      const elapsed = Date.now() - start;
      console.log(`   ❌ Erro de rede (${elapsed}ms): ${err.message}`);
      resolve({ status: 0, error: err.message });
    });

    req.setTimeout(10000, () => {
      console.log(`   ⏰ Timeout após 10s`);
      req.destroy();
      resolve({ status: 0, error: 'timeout' });
    });

    req.end();
  });
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       TESTE DA API ISPFY — Formato Correto');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Host: http://${HOST}:${PORT} (proxy Vite)`);
  console.log(`Token: ${TOKEN.slice(0, 8)}...`);
  console.log('');

  const results = [];

  // Teste 1: Cliente — busca simples com limit=1
  results.push(await makeRequest(
    '/api/ispfy/api/object/cliente?limit=1&pagination=TRUE',
    'Cliente (limit=1)'
  ));

  // Teste 2: Cliente — busca com filtro ativo
  results.push(await makeRequest(
    '/api/ispfy/api/object/cliente?filter=ativo:EQ:S&limit=5&pagination=TRUE',
    'Clientes Ativos (limit=5)'
  ));

  // Teste 3: Faturas abertas
  results.push(await makeRequest(
    '/api/ispfy/api/object/fn_areceber?filter=status:EQ:A&limit=3&pagination=TRUE',
    'Faturas Abertas (limit=3)'
  ));

  // Teste 4: Tickets/Chamados
  results.push(await makeRequest(
    '/api/ispfy/api/object/su_oss_chamado?limit=3&pagination=TRUE',
    'Chamados (limit=3)'
  ));

  // Teste 5: Caixas financeiras
  results.push(await makeRequest(
    '/api/ispfy/api/object/fn_caixa?limit=10&pagination=TRUE',
    'Caixas Financeiros'
  ));

  // Teste 6: Contratos ativos
  results.push(await makeRequest(
    '/api/ispfy/api/object/cliente_contrato?filter=status:EQ:A&limit=3&pagination=TRUE',
    'Contratos Ativos (limit=3)'
  ));

  // Resumo
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('                    RESUMO DOS TESTES');
  console.log('═══════════════════════════════════════════════════════');
  
  const ok = results.filter(r => r.status === 200).length;
  const fail = results.filter(r => r.status !== 200).length;
  
  console.log(`✅ Sucesso: ${ok}/${results.length}`);
  console.log(`❌ Falhas:  ${fail}/${results.length}`);
  
  if (ok === results.length) {
    console.log('\n🎉 API ISPFY funcionando corretamente!');
  } else if (ok > 0) {
    console.log('\n⚠️  Parcialmente funcionando — verifique os endpoints com erro.');
  } else {
    console.log('\n❌ Falha total — verifique se o servidor está rodando e o proxy está configurado.');
    console.log('   Dica: certifique-se que npm run dev está rodando na porta 8081');
  }
  
  console.log('═══════════════════════════════════════════════════════\n');
}

runTests();
