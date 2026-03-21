import axios from 'axios';

async function testAll() {
  const apiKey = 'a65e07737af64f81b8f8dcc3e9b33412';
  const instance = 'ncbrasil';
  const variations = [
    `https://${instance}.smartolt.com/api/onu/get_all_onus_details`,
    `https://${instance}.smartolt.com/api/system/get_olts`,
    `https://${instance}.smartolt.com/api/v2/onus`,
    `https://${instance}.smartolt.com/api/v1/onus`,
    `https://api.smartolt.com/api/v2/onus`
  ];

  console.log('--- Teste Exaustivo SmartOLT ---');
  console.log('Seu IP Público:', '45.70.55.69');

  for (const url of variations) {
    console.log(`\nTentando: ${url} (Aguardando até 30s...)`);
    try {
      const response = await axios.get(url, {
        headers: {
          'X-Token': apiKey,
          'Accept': 'application/json'
        },
        timeout: 30000
      });
      console.log(`✅ SUCESSO! Status: ${response.status}`);
      console.log('Chaves encontradas:', Object.keys(response.data));
      return; 
    } catch (error) {
      if (error.response) {
        console.log(`❌ Erro do Servidor (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      } else {
        console.log(`❌ Falha de Conexão: ${error.message}`);
      }
    }
  }
  
  console.log('\nNenhum endpoint respondeu. Provavelmente o IP ainda está bloqueado ou o endereço está incorreto.');
}

testAll();
