import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import axios from "axios";

// Função para converter string para base64
function stringToBase64(str: string): string {
  return Buffer.from(str).toString("base64");
}

// Helper para obter tokens em ambiente seguro (process.env ou fallback para teste)
const getIxcAuthHeader = () => {
  const token = process.env.IXC_TOKEN || "29:ed30004f8207dbe08feb05005d67ea023793429a91210655cbf03fe12b1e4c94";
  return `Basic ${stringToBase64(token)}`;
};

const getSmartOltConfig = () => {
  const url = process.env.SMARTOLT_URL || "https://ncbrasil.smartolt.com/api";
  const token = process.env.SMARTOLT_TOKEN || "dc89eeacedac434ca5280f84d673f381";
  return { baseUrl: url.replace('/system/', '').replace(/\/$/, ''), token };
};

/**
 * 🔒 Middleware de segurança para funções invocáveis
 */
function verifyAuth(context: functions.https.CallableContext) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "O usuário deve estar autenticado para executar esta ação."
    );
  }
}

/**
 * 🚀 Proxy: Reiniciar roteador via SmartOLT
 */
export const smartOltRebootOnu = functions.https.onCall(async (data, context) => {
  verifyAuth(context);
  const { onuExternalId } = data;
  if (!onuExternalId) {
    throw new functions.https.HttpsError("invalid-argument", "onuExternalId é obrigatório.");
  }

  const { baseUrl, token } = getSmartOltConfig();

  try {
    console.log(`🤖 [Proxy] Solicitando reinício para ONU: ${onuExternalId}`);
    const response = await axios.post(`${baseUrl}/onu/reboot/${onuExternalId}`, {}, {
      headers: { "X-Token": token }
    });
    return response.data;
  } catch (error: any) {
    console.error("❌ Erro no proxy SmartOLT Reboot:", error.message);
    throw new functions.https.HttpsError("internal", `Erro na OLT: ${error.message}`);
  }
});

/**
 * 🚀 Proxy: Obter detalhes do Wi-Fi via SmartOLT
 */
export const smartOltGetWifiDetails = functions.https.onCall(async (data, context) => {
  verifyAuth(context);
  const { onuExternalId } = data;
  if (!onuExternalId) {
    throw new functions.https.HttpsError("invalid-argument", "onuExternalId é obrigatório.");
  }

  const { baseUrl, token } = getSmartOltConfig();

  try {
    console.log(`🤖 [Proxy] Solicitando informações de Wi-Fi para ONU: ${onuExternalId}`);
    const response = await axios.get(`${baseUrl}/onu/get_onu_full_status_info/${onuExternalId}`, {
      headers: { "X-Token": token }
    });

    const statusData = response.data;
    return {
      success: true,
      ssid: statusData?.wifi_ssid || "",
      password: statusData?.wifi_password || ""
    };
  } catch (error: any) {
    console.error("❌ Erro no proxy SmartOLT Get Wifi:", error.message);
    return { success: false, error: error.message };
  }
});

/**
 * 🚀 Proxy: Alterar SSID/Senha do Wi-Fi via SmartOLT
 */
export const smartOltSetWifiDetails = functions.https.onCall(async (data, context) => {
  verifyAuth(context);
  const { onuExternalId, ssid, password } = data;
  if (!onuExternalId || !ssid || !password) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "onuExternalId, ssid e password são obrigatórios."
    );
  }

  const { baseUrl, token } = getSmartOltConfig();

  try {
    console.log(`🤖 [Proxy] Alterando Wi-Fi da ONU ${onuExternalId} para SSID=${ssid}`);
    const response = await axios.post(`${baseUrl}/onu/set_wifi_details/${onuExternalId}`, {
      ssid,
      password
    }, {
      headers: { "X-Token": token }
    });
    return response.data;
  } catch (error: any) {
    console.error("❌ Erro no proxy SmartOLT Set Wifi:", error.message);
    throw new functions.https.HttpsError("internal", `Erro na OLT: ${error.message}`);
  }
});

/**
 * 🚀 Proxy: Autenticar / Buscar Cadastro do cliente no IXC soft (ERP)
 */
export const ixcFetchClient = functions.https.onCall(async (data, context) => {
  // Nota: Chamado sem login no app ainda (usado na tela de login)
  const { cpf } = data;
  if (!cpf) {
    throw new functions.https.HttpsError("invalid-argument", "CPF/CNPJ é obrigatório.");
  }

  const ixcBaseUrl = process.env.IXC_URL || "https://coopertecisp.com.br/webservice/v1";

  try {
    console.log(`🤖 [Proxy] Buscando cadastro de cliente para CPF: ${cpf}`);
    const response = await axios.post(
      `${ixcBaseUrl}/cliente`,
      {
        qtype: "cliente.cnpj_cpf",
        query: cpf,
        oper: "=",
        page: "1",
        rp: "100",
        sortname: "cliente.id",
        sortorder: "desc",
      },
      {
        headers: {
          Authorization: getIxcAuthHeader(),
          ixcsoft: "listar",
        },
        timeout: 15000,
      }
    );

    if (response.data?.registros && response.data.registros.length > 0) {
      return {
        isClient: true,
        accounts: response.data.registros,
      };
    }
    return { isClient: false, accounts: [] };
  } catch (error: any) {
    console.error("❌ Erro no proxy IXC Fetch Client:", error.message);
    throw new functions.https.HttpsError("internal", `Erro no ERP: ${error.message}`);
  }
});

/**
 * 🚀 Proxy: Rodar a Roleta do Pré-Mix de forma segura com transação concorrente
 */
export const spinPreMixRoulette = functions.https.onCall(async (data, context) => {
  const { userCpf, userName } = data;
  if (!userCpf || !userName) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "userCpf e userName são obrigatórios."
    );
  }

  const db = admin.firestore();
  const cleanCpf = userCpf.replace(/\D/g, "");

  try {
    console.log(`🤖 [Proxy] Iniciando transação da Roleta para usuário: ${userName} (${cleanCpf})`);

    // 0. Verificar se o usuário está cadastrado no Pré-Mix antes de iniciar a transação (pois transações não aceitam queries)
    const userPreMixQuery = await db.collection("usuariosDoPreMix").where("cpfRaw", "==", cleanCpf).limit(1).get();
    if (userPreMixQuery.empty) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Você precisa estar cadastrado no Pré-Mix para participar da Roleta da Sorte."
      );
    }
    const userPreMixDocRef = userPreMixQuery.docs[0].ref;

    // Usar transação do Firestore para garantir segurança contra acessos simultâneos
    const result = await db.runTransaction(async (transaction) => {
      // 1. Verificar se o usuário já girou a roleta
      const winsRef = db.collection("pre_mix_roulette_wins").doc(cleanCpf);
      const winDoc = await transaction.get(winsRef);
      if (winDoc.exists) {
        throw new Error("ALREADY_SPUN");
      }

      // 2. Buscar todos os prêmios disponíveis
      const itemsRef = db.collection("pre_mix_roulette_items");
      const itemsSnapshot = await transaction.get(itemsRef);
      const items: any[] = [];
      itemsSnapshot.forEach((doc) => {
        const itemData = doc.data();
        // Apenas itens com estoque positivo ou ilimitados (-1)
        if (itemData.quantity > 0 || itemData.quantity === -1) {
          items.push({ id: doc.id, ref: doc.ref, ...itemData });
        }
      });

      if (items.length === 0) {
        throw new Error("NO_AVAILABLE_ITEMS");
      }

      // 3. Escolher prêmio com base nas probabilidades/pesos
      const totalProbability = items.reduce((sum, item) => sum + (item.probability || 1), 0);
      let randomValue = Math.random() * totalProbability;
      
      let chosenItem = items[items.length - 1]; // Fallback
      for (const item of items) {
        if (randomValue < (item.probability || 1)) {
          chosenItem = item;
          break;
        }
        randomValue -= (item.probability || 1);
      }

      // 4. Se for limitado, decrementar o estoque
      if (chosenItem.quantity > 0) {
        const newQuantity = chosenItem.quantity - 1;
        transaction.update(chosenItem.ref, { quantity: newQuantity });
      }

      // 5. Gerar código de resgate aleatório (6 caracteres)
      const rescueCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // 6. Gravar a vitória em pre_mix_roulette_wins
      transaction.set(winsRef, {
        userId: context.auth?.uid || "",
        userCpf: cleanCpf,
        userName: userName,
        prizeId: chosenItem.id,
        prizeName: chosenItem.name,
        rescueCode: rescueCode,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 7. Atualizar flag hasSpun no cadastro do Pré-Mix
      transaction.update(userPreMixDocRef, {
        hasSpun: true,
        wonPrizeId: chosenItem.id,
        wonPrizeName: chosenItem.name,
        wonPrizeRescueCode: rescueCode,
        spunAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        id: chosenItem.id,
        name: chosenItem.name,
        color: chosenItem.color || "#4338FF",
        icon: chosenItem.icon || "gift-outline",
        rescueCode: rescueCode
      };
    });

    return {
      success: true,
      prize: result
    };

  } catch (error: any) {
    console.error("❌ Erro na transação da Roleta:", error.message);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    if (error.message === "ALREADY_SPUN") {
      throw new functions.https.HttpsError("already-exists", "Você já girou a roleta e garantiu seu prêmio.");
    }
    if (error.message === "NO_AVAILABLE_ITEMS") {
      throw new functions.https.HttpsError("failed-precondition", "Não há prêmios disponíveis no momento.");
    }
    throw new functions.https.HttpsError("internal", error.message);
  }
});

/**
 * 🚀 Proxy: Criar Custom Token do Firebase a partir do CPF validado
 */
export const createCustomToken = functions.https.onCall(async (data, context) => {
  const { cpf } = data;
  if (!cpf) {
    throw new functions.https.HttpsError("invalid-argument", "CPF/CNPJ é obrigatório.");
  }
  
  const cleanCpf = cpf.replace(/\D/g, "");
  if (cleanCpf.length < 11) {
    throw new functions.https.HttpsError("invalid-argument", "CPF/CNPJ inválido.");
  }

  try {
    console.log(`🤖 [Proxy] Gerando Custom Token para CPF: ${cleanCpf}`);
    // Gerar Custom Token usando o Admin SDK
    const customToken = await admin.auth().createCustomToken(cleanCpf);
    return {
      success: true,
      token: customToken
    };
  } catch (error: any) {
    console.error("❌ Erro ao criar Custom Token:", error.message);
    throw new functions.https.HttpsError("internal", `Erro ao gerar token: ${error.message}`);
  }
});
