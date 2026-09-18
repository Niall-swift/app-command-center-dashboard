import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env.production') });
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const token = process.env.VITE_ISPFY_TOKEN;
const host = 'https://us-central1-avl-telecom.cloudfunctions.net/ispfyProxy';

async function run() {
  const client = axios.create({
    baseURL: host,
    headers: {
      'Token': token,
      'Content-Type': 'application/json'
    }
  });

  try {
    const res = await client.get('/api/object/cliente', { params: { limit: 1 } });
    const cliente = res.data.data?.[0] || res.data.rows?.[0] || res.data.registros?.[0] || res.data[0];
    if (cliente) {
      console.log("Found client ID:", cliente.id);
      
      try {
        console.log("Fetching /cliente/contrato/ponto/sessoes filtered by id_cliente =", cliente.id);
        const resSessao = await client.get('/api/object/cliente/contrato/ponto/sessoes', {
          params: { filter: `id_cliente:EQ:${cliente.id}`, limit: 5 }
        });
        const sessaoItems = resSessao.data.rows || resSessao.data.data || resSessao.data.registros || resSessao.data || [];
        console.log("Result sessoes:", sessaoItems.length, "items.");
        if (sessaoItems.length > 0) {
            console.log("Sessoes keys:", Object.keys(sessaoItems[0]));
            console.log("Sessoes sample login/senha:", sessaoItems[0].login, sessaoItems[0].senha);
        }
      } catch (err) {
        console.error("Error sessoes:", err.message);
      }

      try {
        console.log("Fetching /cliente/contrato filtered by id_cliente =", cliente.id);
        const resContrato = await client.get('/api/object/cliente/contrato', {
          params: { filter: `id_cliente:EQ:${cliente.id}`, limit: 5 }
        });
        const contratoItems = resContrato.data.rows || resContrato.data.data || resContrato.data.registros || resContrato.data || [];
        console.log("Result contratos:", contratoItems.length, "items.");
        if (contratoItems.length > 0) {
          console.log("Contrato IDs:", contratoItems.map(c => c.id).join(', '));
          
          for (const c of contratoItems) {
            try {
              console.log("Fetching /cliente/contrato/ponto filtered by id_contrato =", c.id);
              const resPonto = await client.get('/api/object/cliente/contrato/ponto', {
                params: { filter: `id_contrato:EQ:${c.id}`, limit: 5 }
              });
              const items = resPonto.data.rows || resPonto.data.data || resPonto.data.registros || resPonto.data || [];
              console.log("Result ponto for contrato", c.id, ":", items.length, "items.");
              if (items.length > 0) {
                console.log("Ponto sample usuario:", items[0].usuario, "senha:", items[0].senha);
              }
            } catch(e) {
               console.error("Error fetching ponto for contrato", c.id, ":", e.message);
            }
          }
        }
      } catch (err) {
         console.error("Error contratos:", err.message);
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
