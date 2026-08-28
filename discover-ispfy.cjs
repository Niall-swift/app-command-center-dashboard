/**
 * Script de diagnóstico — descobre o formato correto da API ISPFY
 * Testa vários caminhos e formatos para identificar qual funciona
 * 
 * node discover-ispfy.cjs
 */

const http = require('http');

const HOST = 'localhost';
const PORT = 8081;
const TOKEN = '815e74b02bc6faa371f29274e3d317e0';
const ENCODED_TOKEN = Buffer.from(TOKEN).toString('base64');

function makeRequest(path, method, headers, body, label, timeout = 8000) {
  return new Promise((resolve) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json', ...headers },
    };

    console.log(`\n🔵 [${label}]`);
    console.log(`   ${method} http://${HOST}:${PORT}${path}`);
    if (Object.keys(headers).length) console.log(`   Headers: ${JSON.stringify(headers)}`);
    if (body) console.log(`   Body: ${JSON.stringify(body).slice(0, 80)}`);

    const start = Date.now();
    const req = http.request(options, (res) => {
      const elapsed = Date.now() - start;
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const emoji = res.statusCode === 200 ? '✅' : res.statusCode < 500 ? '⚠️' : '❌';
        console.log(`   ${emoji} Status: ${res.statusCode} (${elapsed}ms)`);
        try {
          const json = JSON.parse(data);
          const preview = JSON.stringify(json).slice(0, 200);
          console.log(`   📄 Body: ${preview}`);
        } catch {
          console.log(`   📄 Body: ${data.slice(0, 200)}`);
        }
        resolve({ status: res.statusCode, data, elapsed });
      });
    });

    req.on('error', (err) => {
      const elapsed = Date.now() - start;
      if (!req.destroyed) console.log(`   ❌ Erro (${elapsed}ms): ${err.message}`);
      resolve({ status: 0, error: err.message, elapsed });
    });

    req.setTimeout(timeout, () => {
      console.log(`   ⏰ Timeout após ${timeout}ms`);
      req.destroy();
      resolve({ status: 0, error: 'timeout', elapsed: timeout });
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function discover() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   DIAGNÓSTICO — Descobrindo formato real da API ISPFY');
  console.log('═══════════════════════════════════════════════════════\n');

  // ── GRUPO 1: GET simples (sem corpo) ────────────────────────────────
  console.log('── GRUPO 1: GET com Token header ──');

  await makeRequest('/api/ispfy/api/object/cliente?limit=1', 'GET',
    { 'Token': TOKEN }, null, 'GET /api/object/cliente (Token)');

  await makeRequest('/api/ispfy/cliente?limit=1', 'GET',
    { 'Token': TOKEN }, null, 'GET /cliente (Token)');

  await makeRequest('/api/ispfy/', 'GET',
    { 'Token': TOKEN }, null, 'GET / (raiz)');

  // ── GRUPO 2: POST com body IXC (formato antigo) ──────────────────────
  console.log('\n── GRUPO 2: POST com body IXC (formato antigo) ──');

  await makeRequest('/api/ispfy/cliente', 'POST',
    { 'Token': TOKEN },
    { qtype: 'cliente.id', query: '0', oper: '>', page: '1', rp: '1', sortname: 'cliente.id', sortorder: 'desc' },
    'POST /cliente (Token + body IXC)');

  await makeRequest('/api/ispfy/cliente', 'POST',
    { 'Authorization': `Basic ${ENCODED_TOKEN}`, 'ISPFYsoft': 'listar' },
    { qtype: 'cliente.id', query: '0', oper: '>', page: '1', rp: '1', sortname: 'cliente.id', sortorder: 'desc' },
    'POST /cliente (Basic Auth + ISPFYsoft)');

  // ── GRUPO 3: GET sem autenticação (rota pública?) ───────────────────
  console.log('\n── GRUPO 3: Sem autenticação ──');

  await makeRequest('/api/ispfy/cliente?limit=1', 'GET',
    {}, null, 'GET /cliente (sem auth)');

  // ── GRUPO 4: Formatos alternativos de auth ──────────────────────────
  console.log('\n── GRUPO 4: Outros formatos de autenticação ──');

  await makeRequest('/api/ispfy/api/object/cliente?limit=1', 'GET',
    { 'Authorization': `Basic ${ENCODED_TOKEN}` }, null, 'GET /api/object/cliente (Authorization Basic)');

  await makeRequest('/api/ispfy/api/object/cliente?limit=1&token=' + TOKEN, 'GET',
    {}, null, 'GET /api/object/cliente (token via query param)');

  // ── GRUPO 5: Outros endpoints comuns ───────────────────────────────
  console.log('\n── GRUPO 5: Testando endpoint /api/v1/ ──');

  await makeRequest('/api/ispfy/api/v1/cliente?limit=1', 'GET',
    { 'Token': TOKEN }, null, 'GET /api/v1/cliente');

  await makeRequest('/api/ispfy/webservice/v1/cliente', 'POST',
    { 'Token': TOKEN },
    { qtype: 'cliente.id', query: '0', oper: '>', page: '1', rp: '1', sortname: 'cliente.id', sortorder: 'desc' },
    'POST /webservice/v1/cliente');

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('                    FIM DO DIAGNÓSTICO');
  console.log('═══════════════════════════════════════════════════════\n');
}

discover();
