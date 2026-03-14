import admin from 'firebase-admin';

// Initialize Firebase Admin for Vercel (using environment variables)
if (!admin.apps.length) {
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : null;

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'avl-telecom',
      });
    }
  } catch (err) {
    console.error('Firebase admin initialization error:', err.message);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    let messageData = payload.data || (payload.messages && payload.messages[0]) || payload;

    const from = messageData.from || messageData.chatId || messageData.chat_id || messageData.sender || messageData.key?.remoteJid;
    const text = (messageData.body || messageData.text?.body || messageData.message?.conversation || (typeof messageData.text === "string" ? messageData.text : ""))?.trim();
    const selectionId = messageData.list_reply?.id || messageData.button_reply?.id;
    const isGroup = from?.includes("@g.us") || from?.includes("@group");
    const fromMe = messageData.from_me === true || messageData.fromMe === true || messageData.key?.fromMe === true;

    if (!from || (!text && !selectionId) || isGroup || fromMe) {
        return res.status(200).send("Ignored");
    }

    const cleanPhone = from.replace(/\D/g, "");
    console.log(`📩 [WhatsApp Vercel] Mensagem de ${cleanPhone}: ${text || selectionId}`);

    // Log minimal information to Firestore (Dashboard view)
    const chatRef = db.collection("chat").doc(cleanPhone);
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    
    await chatRef.set({
      lastMessage: text || `Selecionou ${selectionId}`,
      lastMessageTime: serverTimestamp,
      phone: cleanPhone,
      unreadCount: admin.firestore.FieldValue.increment(1)
    }, { merge: true });

    await chatRef.collection("mensagens").add({
      user: "Cliente",
      content: text || `Selecionou ${selectionId}`,
      timestamp: serverTimestamp,
      isAdmin: false,
      source: "whatsapp",
    });

    res.status(200).send("OK");
  } catch (err) {
    console.error('❌ Webhook Vercel Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
