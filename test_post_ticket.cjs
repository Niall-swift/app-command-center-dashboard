const http = require('http');

const HOST = 'localhost';
const PORT = 8080; 
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

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          console.log(`   Data length: ${json.rows?.length ?? 0}`);
          if (json.rows?.length > 0) {
            console.log(`   First row:`, JSON.stringify(json.rows[0]));
          } else {
            console.log(`   Full response:`, data.slice(0, 500));
          }
        } catch {
          console.log(`   Text response:`, data.slice(0, 300));
        }
        resolve();
      });
    });
    req.end();
  });
}

async function run() {
  // Test 1: simple get
  await makeRequest('/api/ispfy/api/object/cliente?limit=1&pagination=TRUE', 'Simple Limit 1');

  // Test 2: filter by id
  await makeRequest('/api/ispfy/api/object/cliente?filter=id:EQ:1&pagination=TRUE', 'Filter ID 1');

  // Test 3: filter by nome_razao exact
  await makeRequest('/api/ispfy/api/object/cliente?filter=nome_razao:EQ:JOYCE DOS SANTOS SILVA - 2&pagination=TRUE', 'Filter nome_razao EQ JOYCE DOS SANTOS SILVA - 2');

  // Test 4: search = JOYCE
  await makeRequest('/api/ispfy/api/object/cliente?search=JOYCE&pagination=TRUE', 'Search JOYCE');

  // Test 5: filter with query
  await makeRequest('/api/ispfy/api/object/cliente?q=JOYCE&pagination=TRUE', 'Q = JOYCE');
}

run();
