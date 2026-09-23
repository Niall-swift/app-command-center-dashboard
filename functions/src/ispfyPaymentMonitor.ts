import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import axios from "axios";
import { WhapiService } from "./whapiService";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Função agendada que roda a cada 10 minutos.
 * Busca faturas pagas no dia de hoje no ISPFY e envia comprovante de pagamento via WhatsApp.
 */
export const monitorIspfyPayments = functions.pubsub
  .schedule("every 10 minutes")
  .timeZone("America/Sao_Paulo")
  .onRun(async (context) => {
    console.log("🔍 Iniciando monitoramento de pagamentos ISPFY...");

    const ispfyHost = process.env.ISPFY_HOST;
    const ispfyToken = process.env.ISPFY_TOKEN;
    const whapiApiKey = process.env.WHAPI_KEY || process.env.WHAPI_API_KEY;
    const whapiBaseUrl = process.env.WHAPI_BASE_URL || "https://gate.whapi.cloud";

    if (!ispfyHost || !ispfyToken) {
      console.error("❌ Credenciais do ISPFY (ISPFY_HOST, ISPFY_TOKEN) não configuradas nas variáveis de ambiente do Firebase!");
      return null;
    }

    if (!whapiApiKey) {
      console.error("❌ Credenciais do Z-API (WHAPI_KEY) não configuradas!");
      return null;
    }

    const db = admin.firestore();
    const whapiService = new WhapiService(whapiApiKey, whapiBaseUrl);

    try {
      // 1. Obter a data de hoje no formato YYYY-MM-DD
      const today = new Date().toISOString().split('T')[0];

      // 2. Buscar últimas faturas pagas e filtrar no Javascript para garantir
      const response = await axios.get(`${ispfyHost}/api/object/cliente/contrato/cobranca`, {
        headers: { Token: ispfyToken },
        params: {
          filter: `status:EQ:pago`,
          sort: `data_pagamento:DESC`,
          limit: 100,
          pagination: 'FALSE'
        }
      });

      // O ISPFY pode retornar o array diretamente, ou dentro de 'data', ou dentro de 'rows'
      let rawCobrancas = Array.isArray(response.data) ? response.data : (response.data?.data || response.data?.rows || []);
      
      // Filtrar apenas faturas pagas exatamente na data de hoje
      let cobrancas = rawCobrancas.filter((c: any) => c.data_pagamento && c.data_pagamento.startsWith(today));
      
      console.log(`🧾 Encontradas ${cobrancas.length} cobranças pagas hoje (de um total de ${rawCobrancas.length} analisadas).`);

      for (const cobranca of cobrancas) {
        const cobrancaId = cobranca.id;

        // 3. Verificar se já enviamos comprovante para esta cobrança
        const docRef = db.collection("payment_receipts").doc(cobrancaId);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
          continue;
        }

        // 4. Buscar detalhes do cliente para pegar o telefone
        // No ISPFY, a cobrança tem 'id_contrato', não 'id_cliente' direto
        if (!cobranca.id_contrato) {
          console.log(`⚠️ Fatura ${cobrancaId} sem id_contrato. Ignorando.`);
          continue;
        }

        let phone = null;
        let clientName = "Cliente";
        let id_cliente = null;

        try {
          // 4.1 Buscar o contrato para pegar o id_cliente
          const contratoResp = await axios.get(`${ispfyHost}/api/object/cliente/contrato`, {
            headers: { Token: ispfyToken },
            params: { filter: `id:EQ:${cobranca.id_contrato}`, pagination: 'FALSE' }
          });
          const rawContratos = Array.isArray(contratoResp.data) ? contratoResp.data : (contratoResp.data?.data || contratoResp.data?.rows || []);
          id_cliente = rawContratos[0]?.id_cliente;

          if (id_cliente) {
            // 4.2 Buscar o cliente (para pegar o nome)
            const clientResp = await axios.get(`${ispfyHost}/api/object/cliente`, {
              headers: { Token: ispfyToken },
              params: { filter: `id:EQ:${id_cliente}`, pagination: 'FALSE' }
            });
            const rawClientes = Array.isArray(clientResp.data) ? clientResp.data : (clientResp.data?.data || clientResp.data?.rows || []);
            const clientData = rawClientes[0];
            
            if (clientData) {
               clientName = clientData.nome_razao || clientData.nome || "Cliente";
            }

            // 4.3 Buscar o telefone na tabela de contatos
            const contatoResp = await axios.get(`${ispfyHost}/api/object/cliente/contato`, {
              headers: { Token: ispfyToken },
              params: { filter: `id_cliente:EQ:${id_cliente}`, pagination: 'FALSE' }
            });
            const rawContatos = Array.isArray(contatoResp.data) ? contatoResp.data : (contatoResp.data?.data || contatoResp.data?.rows || []);
            
            // Pega o primeiro contato válido
            const validContato = rawContatos.find((c: any) => c.contato && c.pode_enviar_mensagem !== 'n');
            if (validContato) {
               phone = validContato.contato;
            }
          }
        } catch (err) {
          console.error(`Erro ao buscar cliente/contrato para a fatura ${cobrancaId}:`, err);
        }

        if (!phone) {
          console.log(`⚠️ Cliente (id: ${id_cliente}) sem telefone válido. Ignorando fatura ${cobrancaId}.`);
          continue;
        }

        // 5. Montar dados do comprovante e enviar via Z-API
        const valorPago = parseFloat(cobranca.valor_pago || cobranca.valor || '0').toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const dataHoraParts = (cobranca.data_pagamento || '').split(' ');
        const dataFormatada = dataHoraParts[0].split('-').reverse().join('/');
        const horaFormatada = dataHoraParts[1] || '00:00';

        const receiptData = {
          valor: valorPago,
          data: dataFormatada,
          hora: horaFormatada,
          descricao: cobranca.descricao || 'Mensalidade de Internet'
        };

        console.log(`📲 Enviando comprovante para ${clientName} (${phone}) - Fatura ${cobrancaId}`);
        const sendResult = await whapiService.sendPaymentReceipt(clientName, phone, receiptData);

        // 6. Registrar no banco para não enviar novamente
        await docRef.set({
          cobrancaId: cobrancaId,
          clienteId: id_cliente || null,
          nome: clientName,
          telefone: phone,
          valor: receiptData.valor,
          dataPagamento: cobranca.data_pagamento,
          enviadoEm: admin.firestore.FieldValue.serverTimestamp(),
          sucesso: sendResult.sent,
          erro: sendResult.error || null
        });
        
        await new Promise(r => setTimeout(r, 1000));
      }

    } catch (error: any) {
      console.error("❌ Erro fatal no monitoramento de pagamentos:", error.response?.data || error.message);
    }
    
    return null;
  });
