import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import axios from "axios";
import { verifyAuth } from "./config/auth";
import { getIspfyConfig, getIxcConfig, getSmartOltConfig } from "./config/env";
import { IspfyBackendService, normalizeDigits } from "./ispfyBackendService";

function getIspfyBackend(): IspfyBackendService {
  const { host, token } = getIspfyConfig();
  return new IspfyBackendService(host, token);
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
 * 🚀 Proxy: Autenticar / Buscar Cadastro do cliente no ISPFY (com fallback opcional legado IXC)
 * Mantém o contrato externo `ixcFetchClient({ cpf })` usado pelo App Mobile.
 */
export const ixcFetchClient = functions.https.onCall(async (data) => {
  const { cpf } = data || {};
  if (!cpf) {
    throw new functions.https.HttpsError("invalid-argument", "CPF/CNPJ é obrigatório.");
  }

  try {
    console.log(`🤖 [Proxy] Buscando cadastro do cliente no ISPFY para CPF: ${cpf}`);
    const ispfy = getIspfyBackend();
    const cliente = await ispfy.buscarClientePorDocumento(String(cpf));

    if (cliente) {
      const [contratos, info] = await Promise.all([
        ispfy.buscarContratosPorCliente(cliente.id).catch(() => []),
        ispfy.consultarAssinanteInfo(cliente.cpf_cnpj || String(cpf)).catch(() => null),
      ]);

      const nome = cliente.razao || cliente.nome_razao || cliente.nome || info?.nome || "Cliente";
      const mappedAccount = {
        ...cliente,
        id: String(cliente.id),
        razao: nome,
        nome_razao: nome,
        nome,
        cnpj_cpf: cliente.cpf_cnpj || normalizeDigits(String(cpf)),
        cpf_cnpj: cliente.cpf_cnpj || normalizeDigits(String(cpf)),
        ativo: cliente.ativo === false || String(cliente.status || "").toLowerCase() === "cancelado" ? "N" : "S",
        contratos,
        pontos: info?.pontos || [],
        origem: "ISPFY",
      };

      return {
        isClient: true,
        source: "ISPFY",
        accounts: [mappedAccount],
      };
    }

    // Fallback opcional legado IXC apenas se explicitamente configurado no ambiente
    try {
      const { host: ixcBaseUrl, authHeader } = getIxcConfig();
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
            Authorization: authHeader,
            ixcsoft: "listar",
          },
          timeout: 12000,
        }
      );

      if (response.data?.registros && response.data.registros.length > 0) {
        return {
          isClient: true,
          source: "IXC",
          accounts: response.data.registros,
        };
      }
    } catch {
      // IXC não configurado ou indisponível: segue retorno negativo limpo
    }

    return { isClient: false, source: "ISPFY", accounts: [] };
  } catch (error: any) {
    console.error("❌ Erro no proxy ixcFetchClient (ISPFY):", error.message);
    throw new functions.https.HttpsError("internal", `Erro ao consultar cadastro: ${error.message}`);
  }
});

/**
 * 🚀 Proxy: Autenticar Assinante na Central / App do Provedor ISPFY (+ status opcional de SVA)
 */
export const ispfyAuthSubscriber = functions.https.onCall(async (data) => {
  const doc = String(data?.doc || data?.cpf || data?.login || "").trim();
  const senha = String(data?.senha || data?.password || "").trim();
  const mode = (data?.mode as "document" | "birthday" | "password" | "central") || (senha ? "central" : "document");
  const checkSva = data?.checkSva === true;

  if (!doc) {
    throw new functions.https.HttpsError("invalid-argument", "Documento é obrigatório.");
  }

  try {
    const ispfy = getIspfyBackend();
    const authResult = await ispfy.autenticarAppProvedor({
      mode,
      document: doc,
      passwordMd5: senha || undefined,
      birthdayMd5: data?.birthdayMd5 ? String(data.birthdayMd5) : undefined,
    });

    if (!authResult) {
      return {
        authenticated: false,
        message: "Credenciais inválidas na Central ISPFY.",
      };
    }

    let svaStatus: Record<string, any> | null = null;
    if (checkSva && senha) {
      svaStatus = await ispfy.consultarSvaGeneric(doc, senha).catch(() => null);
    }

    return {
      authenticated: true,
      data: authResult,
      ...(svaStatus ? { sva: svaStatus } : {}),
    };
  } catch (error: any) {
    console.error("❌ Erro na autenticação ISPFY:", error?.response?.data || error.message);
    return {
      authenticated: false,
      message: error?.response?.data?.message || "Credenciais inválidas na Central ISPFY.",
    };
  }
});

/**
 * Aplica automaticamente o Turbo de Velocidade no ISPFY quando o prêmio da roleta é `ispfy_turbo`.
 */
async function applyRouletteTurboReward(params: {
  cleanCpf: string;
  userName: string;
  turboDays: number;
  turboPlanId?: string;
}): Promise<{ applied: boolean; planName?: string; endDate?: string; error?: string }> {
  try {
    const ispfy = getIspfyBackend();
    const client = await ispfy.buscarClientePorDocumento(params.cleanCpf).catch(() => null);
    const pontos = client?.id
      ? await ispfy.consultarStatusPontos(String(client.id)).catch(() => [])
      : [];

    let idPonto = "";
    const targetPoint =
      pontos.find((p) => p.conexao_status === "online" || String(p.status_acesso || "").toLowerCase() === "ativo") ||
      pontos[0];
    if (targetPoint?.id_ponto) {
      idPonto = String(targetPoint.id_ponto);
    }

    if (!idPonto) {
      const info = await ispfy.consultarAssinanteInfo(params.cleanCpf).catch(() => null);
      const fallbackPoint = Array.isArray(info?.pontos) ? info.pontos[0] : null;
      if (fallbackPoint?.id_ponto || fallbackPoint?.id) {
        idPonto = String(fallbackPoint.id_ponto || fallbackPoint.id);
      }
    }

    if (!idPonto) {
      return { applied: false, error: "Ponto de acesso do assinante não encontrado no ISPFY." };
    }

    const planos = await ispfy.listarPlanosTestaveis(idPonto);
    if (!Array.isArray(planos) || planos.length === 0) {
      return { applied: false, error: "Nenhum plano testável disponível no ISPFY." };
    }

    let chosenPlan = params.turboPlanId
      ? planos.find((p: any) => String(p.id) === String(params.turboPlanId))
      : undefined;

    if (!chosenPlan) {
      const sorted = [...planos].sort((a: any, b: any) => {
        const speedA = Number(a.velocidade_download || a.download || a.mb || 0);
        const speedB = Number(b.velocidade_download || b.download || b.mb || 0);
        return speedB - speedA;
      });
      chosenPlan = sorted[0];
    }

    const days = Math.min(30, Math.max(1, Math.round(params.turboDays)));
    const endDt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const dataFinal = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
    }).format(endDt);

    const applyRes = await ispfy.aplicarPlanoTeste(idPonto, String(chosenPlan.id), dataFinal);
    if (!applyRes.success) {
      return { applied: false, error: applyRes.message };
    }

    const planName = String(chosenPlan.nome || chosenPlan.plano || chosenPlan.descricao || `Plano ${chosenPlan.id}`);
    return {
      applied: true,
      planName,
      endDate: dataFinal,
    };
  } catch (err: any) {
    return {
      applied: false,
      error: err?.response?.data?.message || err?.message || "Falha ao aplicar Turbo ISPFY.",
    };
  }
}

/**
 * 🚀 Proxy: Rodar a Roleta do Pré-Mix de forma segura com transação concorrente
 * Suporta ativação automática de Turbo de Velocidade ISPFY (`rewardType === "ispfy_turbo"`).
 */
export const spinPreMixRoulette = functions.https.onCall(async (data, context) => {
  const { userCpf, userName } = data || {};
  if (!userCpf || !userName) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "userCpf e userName são obrigatórios."
    );
  }

  const db = admin.firestore();
  const cleanCpf = String(userCpf).replace(/\D/g, "");

  try {
    console.log(`🤖 [Proxy] Iniciando transação da Roleta para usuário: ${userName} (${cleanCpf})`);

    const userPreMixQuery = await db.collection("usuariosDoPreMix").where("cpfRaw", "==", cleanCpf).limit(1).get();
    if (userPreMixQuery.empty) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Você precisa estar cadastrado no Pré-Mix para participar da Roleta da Sorte."
      );
    }
    const userPreMixDocRef = userPreMixQuery.docs[0].ref;
    const userPreMixDocData = userPreMixQuery.docs[0].data();
    const winsRef = db.collection("pre_mix_roulette_wins").doc(cleanCpf);

    const result = await db.runTransaction(async (transaction) => {
      const configRef = db.collection("configs").doc("pre_mix_roulette");
      const configDoc = await transaction.get(configRef);

      const isGlobalActive = configDoc.exists && configDoc.data()?.active === true;
      const onlySpecific = configDoc.exists && configDoc.data()?.onlySpecificClients === true;
      const isUserEnabled = userPreMixDocData.rouletteEnabled === true;

      if (!isUserEnabled && (!isGlobalActive || onlySpecific)) {
        throw new Error("ROULETTE_INACTIVE");
      }

      const winDoc = await transaction.get(winsRef);
      if (winDoc.exists) {
        throw new Error("ALREADY_SPUN");
      }

      const itemsRef = db.collection("pre_mix_roulette_items");
      const itemsSnapshot = await transaction.get(itemsRef);
      const items: any[] = [];
      itemsSnapshot.forEach((docSnap) => {
        const itemData = docSnap.data();
        if (itemData.quantity > 0 || itemData.quantity === -1) {
          items.push({ id: docSnap.id, ref: docSnap.ref, ...itemData });
        }
      });

      if (items.length === 0) {
        throw new Error("NO_AVAILABLE_ITEMS");
      }

      const totalProbability = items.reduce((sum, item) => sum + (item.probability || 1), 0);
      let randomValue = Math.random() * totalProbability;

      let chosenItem = items[items.length - 1];
      for (const item of items) {
        if (randomValue < (item.probability || 1)) {
          chosenItem = item;
          break;
        }
        randomValue -= (item.probability || 1);
      }

      if (chosenItem.quantity > 0) {
        const newQuantity = chosenItem.quantity - 1;
        transaction.update(chosenItem.ref, { quantity: newQuantity });
      }

      const rescueCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const rewardType = chosenItem.rewardType === "ispfy_turbo" || Number(chosenItem.turboDays || 0) > 0
        ? "ispfy_turbo"
        : "standard";
      const turboDays = Number(chosenItem.turboDays || 0);
      const turboPlanId = chosenItem.turboPlanId ? String(chosenItem.turboPlanId) : "";

      transaction.set(winsRef, {
        userId: context.auth?.uid || "",
        userCpf: cleanCpf,
        userName: userName,
        prizeId: chosenItem.id,
        prizeName: chosenItem.name,
        rescueCode: rescueCode,
        rewardType,
        turboDays,
        turboPlanId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.update(userPreMixDocRef, {
        hasSpun: true,
        wonPrizeId: chosenItem.id,
        wonPrizeName: chosenItem.name,
        wonPrizeRescueCode: rescueCode,
        wonPrizeIsDefeat: !!chosenItem.isDefeat,
        wonRewardType: rewardType,
        spunAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        id: chosenItem.id,
        name: chosenItem.name,
        color: chosenItem.color || "#4338FF",
        icon: chosenItem.icon || "gift-outline",
        rescueCode: rescueCode,
        isDefeat: !!chosenItem.isDefeat,
        rewardType,
        turboDays,
        turboPlanId,
        turboApplied: false,
        turboPlanName: "" as string | undefined,
        turboEndDate: "" as string | undefined,
      };
    });

    // Ativação automática do Turbo ISPFY fora da transação
    if (!result.isDefeat && result.rewardType === "ispfy_turbo" && result.turboDays > 0) {
      const turboOutcome = await applyRouletteTurboReward({
        cleanCpf,
        userName: String(userName),
        turboDays: result.turboDays,
        turboPlanId: result.turboPlanId || undefined,
      });

      result.turboApplied = turboOutcome.applied;
      result.turboPlanName = turboOutcome.planName;
      result.turboEndDate = turboOutcome.endDate;

      await Promise.all([
        winsRef.set(
          {
            turboApplied: turboOutcome.applied,
            turboPlanName: turboOutcome.planName || null,
            turboEndDate: turboOutcome.endDate || null,
            turboError: turboOutcome.error || null,
          },
          { merge: true }
        ),
        userPreMixDocRef.set(
          {
            turboApplied: turboOutcome.applied,
            turboPlanName: turboOutcome.planName || null,
            turboEndDate: turboOutcome.endDate || null,
          },
          { merge: true }
        ),
        db.collection("ispfy_turbo_logs").add({
          source: "pre_mix_roulette",
          clientCpf: cleanCpf,
          clientName: String(userName),
          turboDays: result.turboDays,
          applied: turboOutcome.applied,
          planName: turboOutcome.planName || null,
          endDate: turboOutcome.endDate || null,
          error: turboOutcome.error || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
      ]);
    }

    return {
      success: true,
      prize: result,
    };
  } catch (error: any) {
    console.error("❌ Erro na transação da Roleta:", error.message);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    if (error.message === "ALREADY_SPUN") {
      throw new functions.https.HttpsError("already-exists", "Você já girou a roleta e garantiu seu prêmio.");
    }
    if (error.message === "ROULETTE_INACTIVE") {
      throw new functions.https.HttpsError("failed-precondition", "A Roleta da Sorte não está ativa para o seu usuário no momento.");
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
