import axios from 'axios';

async function discovery() {
  const apiKey = 'a65e07737af64f81b8f8dcc3e9b33412';
  const instance = 'ncbrasil';
  const variations = [
    `/api/v2/olts`,
    `/api/v1/olts`,
    `/api/olts`,
    `/api/system/get_olts`,
    `/api/v2/system/get_olts`,
    `/api/onu/get_all_onus_details`
  ];

  console.log('--- Discovery SmartOLT Broad ---');

  for (const v of variations) {
    const url = `https://${instance}.smartolt.com${v}`;
    console.log(`\nTestando: ${url}`);
    try {
      const response = await axios.get(url, {
        headers: {
          'X-Token': apiKey,
          'Accept': 'application/json'
        },
        timeout: 5000
      });
      console.log(`✅ Sucesso! Status: ${response.status}`);
      console.log('Dados:', JSON.stringify(response.data).substring(0, 100));
      break; 
    } catch (error) {
      if (error.response) {
        console.log(`❌ Falhou (${error.response.status})`);
      } else {
        console.log(`❌ Erro: ${error.message}`);
      }
    }
  }
}

discovery();
