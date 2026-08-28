const axios = require('axios');
const TOKEN = '815e74b02bc6faa371f29274e3d317e0';
const BASE = 'http://avltelecom.ispfycloud.com.br:8020/api/object';

async function test() {
  // Check real contract fields
  console.log('=== Campos do CONTRATO ===');
  const r1 = await axios.get(BASE + '/cliente/contrato', {
    params: { limit: 1, pagination: 'TRUE' },
    headers: { Token: TOKEN }
  });
  const contrato = (r1.data.data || [])[0];
  if (contrato) console.log(Object.keys(contrato).join(', '));

  // Check what filter field for contract ID
  console.log('\n=== Filtros de contrato (por cliente) ===');
  const r2 = await axios.get(BASE + '/cliente/contrato', {
    params: { limit: 2, filter: 'id_cliente:EQ:1', pagination: 'TRUE' },
    headers: { Token: TOKEN }
  });
  const rows2 = r2.data.data || [];
  console.log('Contratos encontrados:', rows2.length);
  if (rows2[0]) console.log('Campos:', Object.keys(rows2[0]).join(', '));
  rows2.forEach(function(c) { 
    console.log('  id:', c.id, '| status:', c.status, '| id_cliente:', c.id_cliente);
  });

  // Check cobrança fields
  console.log('\n=== COBRANÇAS (tentando sem filtro) ===');
  const r3 = await axios.get(BASE + '/cliente/contrato/cobranca', {
    params: { limit: 2, pagination: 'TRUE' },
    headers: { Token: TOKEN }
  });
  const rows3 = r3.data.data || [];
  console.log('Cobranças encontradas:', rows3.length);
  if (rows3[0]) {
    console.log('Campos:', Object.keys(rows3[0]).join(', '));
    console.log('Exemplo:', JSON.stringify(rows3[0]).substring(0, 300));
  }

  // Test different filter fields for cobrança
  console.log('\n=== Testando filtros de cobrança ===');
  const filtersToTest = [
    'id_contrato:EQ:1',
    'id_assinante:EQ:1',
    'assinante_id:EQ:1',
  ];
  for (const f of filtersToTest) {
    try {
      const r = await axios.get(BASE + '/cliente/contrato/cobranca', {
        params: { limit: 1, filter: f },
        headers: { Token: TOKEN }
      });
      console.log('✅ filter=' + f + ' -> ' + (r.data.data || []).length + ' rows');
    } catch(e) {
      console.log('❌ filter=' + f + ' -> ' + (e.response ? e.response.data : e.message));
    }
  }
}

test().catch(function(e) { console.error('ERRO GERAL:', e.response ? e.response.data : e.message); });
