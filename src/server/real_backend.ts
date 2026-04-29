import './env_loader'; // MUST BE FIRST
import express from 'express';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import admin from 'firebase-admin';
import { WhatsAppService } from './services/whatsappService';
import { IXCBackendService } from './services/ixcService';
import { AiService } from './services/aiService';
import { createProxyMiddleware } from 'http-proxy-middleware';

// --- Firebase Admin Init ---
const saPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'avl-telecom';

console.log('DEBUG: Final Project ID attempt:', projectId);
process.env.GOOGLE_CLOUD_PROJECT = projectId;
process.env.GCLOUD_PROJECT = projectId;

try {
  if (admin.apps.length === 0) {
    if (fs.existsSync(saPath)) {
      const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(sa),
        projectId: projectId
      });
      console.log('✅ Firebase Admin: Service Account JSON');
    } else {
      admin.initializeApp({
        projectId: projectId
      });
      console.log(`✅ Firebase Admin: Inicializado (ProjectId: ${projectId})`);
      console.log(`⚠️ AVISO: serviceAccountKey.json nao encontrado. O Dashboard vai funcionar, mas os Listeners (Bot WhatsApp) podem precisar de credenciais padrão do Google.`);
    }
  }
} catch (e: any) {
  console.log('⚠️ Erro Firebase Init:', e.message);
}

const db = admin.firestore();
console.log('DEBUG: Firestore Bound Project ID:', (db as any)._projectId || (db as any).projectId);

// Configuração explícita para evitar o erro de detecção de ProjectId no Windows
try {
    db.settings({
        projectId: projectId,
        ignoreUndefinedProperties: true
    });
} catch (e: any) {
    console.warn('⚠️ Erro ao aplicar settings no Firestore:', e.message);
}
const app = express();
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do frontend (pasta dist)
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    console.log(`📂 Servindo frontend de: ${distPath}`);
}

// Proxies para APIs Externas (Replicando vite.config.ts para produção)
app.use('/api/ixc', createProxyMiddleware({
    target: 'https://coopertecisp.com.br/webservice/v1',
    changeOrigin: true,
    pathRewrite: {
        '^/api/ixc': '',
    },
    followRedirects: true,
    on: {
        proxyReq: (proxyReq, req, res) => {
            console.log(`🌐 [Proxy IXC] Request: ${req.method} ${proxyReq.path}`);
            // Garantir que o body do POST seja repassado corretamente em proxies de Node.js
            if ((req.method === 'POST' || req.method === 'PUT') && (req as any).body) {
                const bodyData = JSON.stringify((req as any).body);
                proxyReq.setHeader('Content-Type', 'application/json');
                proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                proxyReq.write(bodyData);
            }
            proxyReq.setHeader('Origin', 'https://coopertecisp.com.br');
        },
        proxyRes: (proxyRes, req, res) => {
            console.log(`📡 [Proxy IXC] Response: ${proxyRes.statusCode} from ${req.url}`);
        },
        error: (err, req, res) => {
            console.error('❌ [Proxy IXC] Error:', err.message);
        }
    },
    secure: false 
}));

app.use('/api/smartolt', createProxyMiddleware({
    target: 'https://ncbrasil.smartolt.com',
    changeOrigin: true,
    pathRewrite: {
        '^/api/smartolt': '/api/v2',
    },
    on: {
        proxyReq: (proxyReq, req, res) => {
            console.log(`📡 [Proxy SmartOLT] Request: ${req.method} ${proxyReq.path}`);
            if ((req.method === 'POST' || req.method === 'PUT') && (req as any).body) {
                const bodyData = JSON.stringify((req as any).body);
                proxyReq.setHeader('Content-Type', 'application/json');
                proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                proxyReq.write(bodyData);
            }
        },
        proxyRes: (proxyRes, req, res) => {
            console.log(`📡 [Proxy SmartOLT] Response: ${proxyRes.statusCode} from ${req.url}`);
        },
        error: (err, req, res) => {
            console.error('❌ [Proxy SmartOLT] Error:', err.message);
        }
    },
    secure: true
}));

// --- Instanciar Serviços ---
const ixcService = new IXCBackendService(process.env.IXC_HOST || process.env.VITE_IXC_HOST || '', process.env.IXC_TOKEN || process.env.VITE_IXC_TOKEN || '');
const waService = new WhatsAppService(process.env.WHAPI_BASE_URL || process.env.VITE_WHAPI_BASE_URL || 'https://gate.whapi.cloud', process.env.WHAPI_API_KEY || process.env.VITE_WHAPI_API_KEY || '');
const aiService = process.env.GEMINI_API_KEY ? new AiService(process.env.GEMINI_API_KEY) : null;

// ============================================================================
// 1. WEBHOOK WHATSAPP
// ============================================================================
app.post('/webhook/whatsapp', async (req, res) => {
  try {
    const payload = req.body;
    let messageData = payload.data || (payload.messages && payload.messages[0]) || payload;

    const chatIdField = messageData.chat_id || messageData.chatId || messageData.key?.remoteJid || "";
    const senderField = messageData.from || messageData.sender || "";
    
    const from = senderField || chatIdField;
    const text = (messageData.body || messageData.text?.body || messageData.message?.conversation || (typeof messageData.text === "string" ? messageData.text : ""))?.trim();
    const selectionId = messageData.list_reply?.id || messageData.button_reply?.id;
    
    // Verificamos explicitamente o ID do chat e o remetente para bloquear mensagens de grupo
    const isGroup = chatIdField.includes("@g.us") || senderField.includes("@g.us") || messageData.isGroup === true || from?.includes("@group");
    const fromMe = messageData.from_me === true || messageData.fromMe === true || messageData.key?.fromMe === true;

    if (!from || (!text && !selectionId) || isGroup || fromMe) {
        return res.status(200).send("Ignored");
    }

    const cleanPhone = from.replace(/\D/g, "");
    console.log(`📩 [WhatsApp] Mensagem de ${cleanPhone}: ${text || selectionId}`);

    // Controle de Bot Ativo
    const botConfig = await db.collection("bot_config").doc("global").get();
    if (botConfig.exists && botConfig.data()?.active === false) {
      return res.status(200).send("Disabled");
    }

    // Identificar Cliente no IXC
    let cliente = await ixcService.getClienteByPhone(cleanPhone);
    const firstName = cliente?.razao ? cliente.razao.split(' ')[0] : undefined;

    // Logar no Dashboard
    await logMessageToDashboard(cleanPhone, text || `Selecionou ${selectionId}`, false, "whatsapp", firstName, cliente);

    // Lógica de Sessão / Fluxo
    const sessionRef = db.collection("bot_sessions").doc(cleanPhone);
    const sessionSnap = await sessionRef.get();
    const session = sessionSnap.data();

    // Fluxo de CPF
    if (session?.state === "WAITING_FOR_CPF") {
      const pureNumbers = (text || "").replace(/\D/g, "");
      if (pureNumbers.length >= 11) {
        await waService.sendTextMessage(from, "🔍 Localizando seu cadastro...");
        const clienteByDoc = await ixcService.getClienteByCpfCnpj(pureNumbers);
        if (clienteByDoc) {
          await sessionRef.set({ state: "IDLE" }, { merge: true });
          await handleInvoiceRequest(clienteByDoc, from);
        } else {
          await waService.sendTextMessage(from, "❌ Não encontrei ninguém com esse documento. Por favor, digite o CPF ou CNPJ novamente.");
        }
        return res.status(200).send("OK");
      }
    }

    // Processamento com IA ou Seleção de Menu
    if (selectionId === "opt_invoice") {
        await waService.sendTextMessage(from, "Por favor, digite seu *CPF ou CNPJ* (apenas números) para que eu possa localizar suas faturas.");
        await sessionRef.set({ state: "WAITING_FOR_CPF" }, { merge: true });
    } else if (selectionId === "opt_support") {
        await waService.sendTextMessage(from, "Entendido. Vou encaminhar você para um de nossos atendentes. Por favor, aguarde um momento.");
        await logMessageToDashboard(cleanPhone, "🤖 Solicitou Suporte Humano", true, "system");
    } else {
        // Bem vindo padrão
        await sendWelcomeMenu(from, firstName);
    }

    res.status(200).send("OK");
  } catch (err: any) {
    console.error('❌ Erro no Webhook:', err.message);
    res.status(500).send('Error');
  }
});

// ============================================================================
// 2. LISTENERS FIRESTORE (Real-time port)
// ============================================================================

// Sincronizar Respostas do Admin -> WhatsApp
db.collectionGroup('mensagens').onSnapshot(snapshot => {
  snapshot.docChanges().forEach(async change => {
    if (change.type === 'added') {
      const msg = change.doc.data();
      const parentDoc = change.doc.ref.parent.parent; // chatDoc
      if (msg.isAdmin && parentDoc?.parent.id === 'chat') {
        const phone = parentDoc.id;
        console.log(`📤 [Dashboard -> WA] ${phone}: ${msg.content}`);
        try {
          if (msg.mediaUrl) await waService.sendMediaMessage(phone, msg.mediaUrl, msg.content);
          else await waService.sendTextMessage(phone, msg.content);
        } catch (e: any) { console.error('❌ Falha ao enviar para WA:', e.message); }
      }
    }
  });
}, err => console.error('❌ Firestore Listener Error (Chat):', err.message));

// Sincronizar App Móvel -> Dashboard
db.collectionGroup('messages').onSnapshot(snapshot => {
  snapshot.docChanges().forEach(async change => {
    if (change.type === 'added') {
      const msg = change.doc.data();
      const chatRoomDoc = change.doc.ref.parent.parent;
      if (msg.enviadoPor === 'cliente' && chatRoomDoc) {
        const roomData = (await chatRoomDoc.get()).data();
        if (roomData?.phone) {
          console.log(`📱 [App -> Dashboard] ${roomData.phone}: ${msg.content}`);
          await logMessageToDashboard(roomData.phone, msg.content, false, 'app');
        }
      }
    }
  });
}, err => console.error('❌ Firestore Listener Error (App):', err.message));

// ============================================================================
// AUXILIARES
// ============================================================================

async function logMessageToDashboard(cleanPhone: string, content: string, isAdmin: boolean, source?: string, firstName?: string, cliente?: any) {
  const chatRef = db.collection("chat").doc(cleanPhone);
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
  const update: any = { lastMessage: content, lastMessageTime: serverTimestamp };
  if (!isAdmin) {
    update.unreadCount = admin.firestore.FieldValue.increment(1);
    update.name = firstName || cliente?.razao || "Cliente WhatsApp";
    update.phone = cleanPhone;
    if (cliente?.id) update.ixc_id = cliente.id;
  }
  await chatRef.set(update, { merge: true });
  await chatRef.collection("mensagens").add({
    user: isAdmin ? "AVL Bot" : (firstName || "Cliente"),
    content,
    timestamp: serverTimestamp,
    isAdmin,
    source: source || (isAdmin ? "system" : "whatsapp"),
  });
}

async function sendWelcomeMenu(from: string, firstName?: string) {
  const greeting = firstName ? `Olá ${firstName}! 👋` : "Olá! 👋";
  const menuText = `${greeting} Sou o assistente da *AVL Telecom*. 🤖\n\nComo posso te ajudar hoje?\n\n1. 📄 *Minha Fatura*\n2. 🎧 *Suporte Humano*\n3. ⚙️ *Outros*`;
  
  try {
    const sections = [{ title: "Opções Rápidas", rows: [
      { id: "opt_invoice", title: "Minha Fatura", description: "Boleto, PIX e Segunda Via" },
      { id: "opt_support", title: "Suporte Humano", description: "Falar com um atendente" },
      { id: "opt_other", title: "Outros Assuntos", description: "Planos e Informações" }
    ]}];
    await waService.sendListMessage(from, menuText, "Selecionar Opção", sections);
  } catch {
    await waService.sendTextMessage(from, menuText);
  }
}

async function handleInvoiceRequest(cliente: any, from: string) {
  try {
    const faturas = await ixcService.getFaturasAbertas(cliente.id);
    if (faturas.length === 0) {
      await waService.sendTextMessage(from, `✅ ${cliente.razao}, seu cadastro não possuí faturas em aberto no momento.`);
      return;
    }
    await waService.sendTextMessage(from, `Localizei ${faturas.length} fatura(s) pendente(s) para você, *${cliente.razao}*:`);
    for (const fat of faturas) {
      const pix = fat.pix_copia_e_cola || await ixcService.getPix(fat.id);
      const link = fat.gateway_link || fat.url_boleto;
      let msg = `📅 *Vencimento: ${fat.data_vencimento}*\n💰 *Valor: R$ ${fat.valor}*`;
      if (pix) msg += `\n\n💎 *Copia e Cola PIX:*\n\`${pix}\``;
      if (link) msg += `\n\n💳 *Link para boleto/cartão:*\n${link}`;
      await waService.sendTextMessage(from, msg);
    }
  } catch (err: any) {
    console.error('Erro ao processar faturas:', err.message);
    await waService.sendTextMessage(from, "⚠️ Ocorreu um erro ao buscar suas faturas. Por favor, tente novamente em instantes.");
  }
}

// Fallback para SPA (Single Page Application) - Deve ser depois de todas as rotas de API
app.use((req, res) => {
    const distPath = path.resolve(process.cwd(), 'dist', 'index.html');
    if (fs.existsSync(distPath)) {
        res.sendFile(distPath);
    } else {
        res.status(404).send('Frontend não encontrado (execute npm run build primeiro)');
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`\n🚀 ===========================================`);
    console.log(`✅ Backend Local AVL Telecom ATIVO`);
    console.log(`📍 Porta: ${PORT}`);
    console.log(`🔗 Webhook: http://seu-endereco/webhook/whatsapp`);
    console.log(`📂 Firebase Project: ${admin.apps[0]?.options?.projectId || 'Desconhecido'}`);
    console.log(`==============================================\n`);
});
