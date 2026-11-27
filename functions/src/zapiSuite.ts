import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import axios, { AxiosInstance } from "axios";
import { verifyAuth } from "./config/auth";
import { getWhapiConfig } from "./config/env";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export interface ZapiActionResponse {
  sent: boolean;
  id?: string;
  zaapId?: string;
  data?: unknown;
  error?: string;
  usedFallback?: boolean;
}

export interface ZapiButtonItem {
  id: string;
  label: string;
}

function createZapiClient(): AxiosInstance {
  const { apiKey, baseUrl } = getWhapiConfig();
  return axios.create({
    baseURL: baseUrl.replace(/\/$/, ""),
    timeout: 35000,
    headers: {
      "Content-Type": "application/json",
      "Client-Token": apiKey,
    },
  });
}

export function formatZapiPhone(phone: string): string {
  const trimmed = String(phone || "").trim();
  if (
    trimmed.includes("@lid") ||
    trimmed.endsWith("-group") ||
    trimmed.includes("@g.us") ||
    /^\d+-\d+$/.test(trimmed)
  ) {
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") || digits.length > 11 ? digits : `55${digits}`;
}

/**
 * Gera todas as variações brasileiras (com/sem DDI 55 e com/sem 9º dígito)
 * para localizar sempre o documento único do chat no Firestore sem duplicar conversas.
 */
export function buildBrPhoneVariants(rawPhone: string): string[] {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  if (!digits) return [];
  const list: string[] = [digits];

  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length >= 10 && local.length <= 11) {
    const ddd = local.slice(0, 2);
    const rest = local.slice(2);
    list.push(local, `55${local}`);
    if (rest.length === 9 && rest.startsWith("9")) {
      const noNine = `${ddd}${rest.slice(1)}`;
      list.push(noNine, `55${noNine}`);
    } else if (rest.length === 8) {
      const withNine = `${ddd}9${rest}`;
      list.push(withNine, `55${withNine}`);
    }
  }
  return Array.from(new Set(list.filter((v) => v.length >= 8)));
}

export function sanitizeIndexKey(rawId: string): string {
  return String(rawId || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 120);
}

/**
 * Indexa o messageId retornado pela Z-API para permitir atualização O(1) de ticks
 * (SENT -> RECEIVED -> READ -> PLAYED) quando o webhook de status disparar.
 */
export async function indexZapiMessageForTracking(params: {
  messageId?: string | null;
  zaapId?: string | null;
  collectionPath: string;
  docId: string;
  chatId?: string | null;
}): Promise<void> {
  const db = admin.firestore();
  const ids = [params.messageId, params.zaapId]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  if (ids.length === 0) return;

  const uniqueIds = Array.from(new Set(ids));
  const batch = db.batch();
  for (const rawId of uniqueIds) {
    const key = sanitizeIndexKey(rawId);
    if (!key) continue;
    batch.set(
      db.collection("zapi_message_index").doc(key),
      {
        rawId,
        collectionPath: params.collectionPath,
        docId: params.docId,
        chatId: params.chatId || null,
        createdAtMs: Date.now(),
        expireAt: admin.firestore.Timestamp.fromMillis(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ),
      },
      { merge: true }
    );
  }
  await batch.commit().catch(() => undefined);
}

/**
 * Envia PIX com botão nativo de copiar via Z-API:
 * - Para PIX Copia e Cola (EMV 000201...): usa /send-button-otp (botão "Copiar código PIX")
 * - Para Chave PIX simples (CPF/CNPJ/Email/Telefone/EVP): usa /send-button-pix
 * - Em qualquer falha (inclusive erro no corpo 200 da Z-API): fallback automático em /send-text.
 */
export async function sendZapiButtonPix(params: {
  phone: string;
  pixCode: string;
  message?: string;
  merchantName?: string;
  pixType?: "EVP" | "CPF" | "CNPJ" | "EMAIL" | "PHONE";
}): Promise<ZapiActionResponse> {
  const client = createZapiClient();
  const formattedPhone = formatZapiPhone(params.phone);
  if (!formattedPhone) {
    return { sent: false, error: "Telefone inválido para envio de PIX." };
  }

  const pixCode = String(params.pixCode || "").trim();
  if (!pixCode) {
    return { sent: false, error: "Código PIX vazio." };
  }

  const isEmvCopiaECola = pixCode.startsWith("000201") || pixCode.length > 77;
  const headerMessage =
    params.message ||
    "💠 Segue seu código *PIX Copia e Cola*. Toque no botão abaixo para copiar e pagar no app do seu banco:";

  try {
    const resp = isEmvCopiaECola
      ? await client.post("/send-button-otp", {
          phone: formattedPhone,
          message: headerMessage,
          code: pixCode,
          buttonText: "Copiar código PIX",
        })
      : await client.post("/send-button-pix", {
          phone: formattedPhone,
          pixKey: pixCode,
          type: params.pixType || "EVP",
          merchantName: params.merchantName || "AVL Telecom",
          ...(params.message ? { message: params.message } : {}),
        });

    if (resp.data?.error || resp.data?.status === "error") {
      throw new Error(String(resp.data?.message || resp.data?.error || "Z-API recusou o botão PIX"));
    }

    return {
      sent: true,
      id: resp.data?.messageId || resp.data?.id,
      zaapId: resp.data?.zaapId,
      data: resp.data,
    };
  } catch (pixErr: unknown) {
    const errMsg = axios.isAxiosError(pixErr)
      ? pixErr.response?.data?.message || pixErr.message
      : pixErr instanceof Error
      ? pixErr.message
      : "Falha no botão PIX";
    console.warn(
      `[zapiSuite] Fallback /send-text após falha no ${isEmvCopiaECola ? "/send-button-otp" : "/send-button-pix"}:`,
      errMsg
    );

    try {
      const fallbackText =
        `${params.message ? `${params.message}\n\n` : ""}` +
        `💠 *PIX Copia e Cola:*\n\n${pixCode}\n\n` +
        `_Abra o app do seu banco, escolha "PIX Copia e Cola" e cole o código acima._`;
      const textResp = await client.post("/send-text", {
        phone: formattedPhone,
        message: fallbackText,
      });
      return {
        sent: true,
        usedFallback: true,
        id: textResp.data?.messageId || textResp.data?.id,
        zaapId: textResp.data?.zaapId,
        data: textResp.data,
      };
    } catch (fallbackErr: unknown) {
      return {
        sent: false,
        error: axios.isAxiosError(fallbackErr)
          ? fallbackErr.response?.data?.message || fallbackErr.message
          : "Erro ao enviar PIX.",
      };
    }
  }
}

/**
 * Envia lista de botões interativos (/send-button-list) com fallback em texto numerado.
 */
export async function sendZapiButtonList(params: {
  phone: string;
  message: string;
  buttons: ZapiButtonItem[];
}): Promise<ZapiActionResponse> {
  const client = createZapiClient();
  const formattedPhone = formatZapiPhone(params.phone);
  if (!formattedPhone) {
    return { sent: false, error: "Telefone inválido." };
  }

  try {
    const resp = await client.post("/send-button-list", {
      phone: formattedPhone,
      message: params.message,
      buttonList: {
        buttons: params.buttons.map((b) => ({ id: b.id, label: b.label })),
      },
    });
    return {
      sent: true,
      id: resp.data?.messageId || resp.data?.id,
      zaapId: resp.data?.zaapId,
      data: resp.data,
    };
  } catch (btnErr: unknown) {
    console.warn(
      "[zapiSuite] Fallback texto após erro em /send-button-list:",
      axios.isAxiosError(btnErr) ? btnErr.response?.data || btnErr.message : btnErr
    );
    try {
      const optionsText = params.buttons
        .map((b, idx) => `${idx + 1}. ${b.label}`)
        .join("\n");
      const textResp = await client.post("/send-text", {
        phone: formattedPhone,
        message: `${params.message}\n\n${optionsText}`,
      });
      return {
        sent: true,
        usedFallback: true,
        id: textResp.data?.messageId || textResp.data?.id,
        zaapId: textResp.data?.zaapId,
        data: textResp.data,
      };
    } catch (fallbackErr: unknown) {
      return {
        sent: false,
        error: axios.isAxiosError(fallbackErr)
          ? fallbackErr.response?.data?.message || fallbackErr.message
          : "Erro ao enviar botões.",
      };
    }
  }
}

export async function sendZapiLocation(params: {
  phone: string;
  latitude: number;
  longitude: number;
  title?: string;
  address?: string;
}): Promise<ZapiActionResponse> {
  const client = createZapiClient();
  const formattedPhone = formatZapiPhone(params.phone);
  if (!formattedPhone) {
    return { sent: false, error: "Destino inválido." };
  }

  try {
    const resp = await client.post("/send-location", {
      phone: formattedPhone,
      latitude: Number(params.latitude),
      longitude: Number(params.longitude),
      title: params.title || "Localização AVL Telecom",
      address: params.address || "",
    });
    return {
      sent: true,
      id: resp.data?.messageId || resp.data?.id,
      zaapId: resp.data?.zaapId,
      data: resp.data,
    };
  } catch (err: unknown) {
    return {
      sent: false,
      error: axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : "Erro ao enviar localização.",
    };
  }
}

export async function sendZapiDocument(params: {
  phone: string;
  document: string;
  fileName?: string;
  caption?: string;
  extension?: string;
}): Promise<ZapiActionResponse> {
  const client = createZapiClient();
  const formattedPhone = formatZapiPhone(params.phone);
  if (!formattedPhone) {
    return { sent: false, error: "Telefone inválido." };
  }

  const ext = (params.extension || "pdf").replace(/[^a-z0-9]/gi, "").toLowerCase() || "pdf";
  const payload = {
    phone: formattedPhone,
    document: params.document,
    fileName: params.fileName || `documento_avl.${ext}`,
    ...(params.caption ? { caption: params.caption } : {}),
  };

  try {
    const resp = await client.post(`/send-document/${ext}`, payload, { timeout: 45000 });
    return {
      sent: true,
      id: resp.data?.messageId || resp.data?.id,
      zaapId: resp.data?.zaapId,
      data: resp.data,
    };
  } catch {
    try {
      const resp = await client.post("/send-document", payload, { timeout: 45000 });
      return {
        sent: true,
        id: resp.data?.messageId || resp.data?.id,
        zaapId: resp.data?.zaapId,
        data: resp.data,
      };
    } catch (err: unknown) {
      return {
        sent: false,
        error: axios.isAxiosError(err)
          ? err.response?.data?.message || err.message
          : "Erro ao enviar documento.",
      };
    }
  }
}

export async function sendZapiReaction(params: {
  phone: string;
  messageId: string;
  reaction: string;
}): Promise<ZapiActionResponse> {
  const client = createZapiClient();
  const formattedPhone = formatZapiPhone(params.phone);
  if (!formattedPhone || !params.messageId) {
    return { sent: false, error: "Telefone ou messageId ausente." };
  }
  try {
    const resp = await client.post("/send-reaction", {
      phone: formattedPhone,
      messageId: params.messageId,
      reaction: params.reaction,
    });
    return { sent: true, data: resp.data };
  } catch (err: unknown) {
    return {
      sent: false,
      error: axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : "Erro ao enviar reação.",
    };
  }
}

/**
 * Edita o texto de uma mensagem já enviada via Z-API (/send-text com editMessageId).
 * Respeita o limite oficial do WhatsApp (~15 minutos após o envio original).
 */
export async function editZapiTextMessage(params: {
  phone: string;
  messageId: string;
  message: string;
}): Promise<ZapiActionResponse> {
  const client = createZapiClient();
  const formattedPhone = formatZapiPhone(params.phone);
  const messageId = String(params.messageId || "").trim();
  const newText = String(params.message || "").trim();

  if (!formattedPhone || !messageId || !newText) {
    return {
      sent: false,
      error: "Telefone, ID da mensagem e novo texto são obrigatórios.",
    };
  }

  try {
    const resp = await client.post("/send-text", {
      phone: formattedPhone,
      message: newText,
      editMessageId: messageId,
    });
    if (resp.data?.error || resp.data?.status === "error") {
      return {
        sent: false,
        error: String(resp.data?.message || resp.data?.error || "Z-API recusou a edição."),
      };
    }
    return {
      sent: true,
      id: resp.data?.messageId || resp.data?.id || messageId,
      zaapId: resp.data?.zaapId,
      data: resp.data,
    };
  } catch (err: unknown) {
    return {
      sent: false,
      error: axios.isAxiosError(err)
        ? err.response?.data?.message || err.response?.data?.error || err.message
        : "Erro ao editar mensagem no WhatsApp.",
    };
  }
}

/**
 * Apaga uma mensagem no WhatsApp via Z-API (DELETE /messages).
 * Quando deleteForMe é false/omitido e owner é true, apaga PARA TODOS.
 */
export async function deleteZapiMessage(params: {
  phone: string;
  messageId: string;
  owner?: boolean;
  deleteForMe?: boolean;
}): Promise<ZapiActionResponse> {
  const client = createZapiClient();
  const formattedPhone = formatZapiPhone(params.phone);
  const messageId = String(params.messageId || "").trim();

  if (!formattedPhone || !messageId) {
    return { sent: false, error: "Telefone e ID da mensagem são obrigatórios." };
  }

  try {
    const queryParams: Record<string, string> = {
      messageId,
      phone: formattedPhone,
      owner: params.owner === false ? "false" : "true",
    };
    if (params.deleteForMe === true) {
      queryParams.deleteForMe = "true";
    }

    const resp = await client.delete("/messages", { params: queryParams });
    if (resp.data?.error || resp.data?.status === "error") {
      return {
        sent: false,
        error: String(resp.data?.message || resp.data?.error || "Z-API recusou a exclusão."),
      };
    }
    return { sent: true, data: resp.data };
  } catch (err: unknown) {
    return {
      sent: false,
      error: axios.isAxiosError(err)
        ? err.response?.data?.message || err.response?.data?.error || err.message
        : "Erro ao apagar mensagem no WhatsApp.",
    };
  }
}

/**
 * Proxy autenticado central da Z-API: protege credenciais no servidor e expõe
 * saúde/QR Code, botão PIX nativo, botões CSAT, validação de WhatsApp em lote,
 * documentos PDF, localização de campo e grupos.
 */
export const zapiToolActions = functions
  .runWith({ memory: "256MB", timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    verifyAuth(context);
    const action = String(data?.action || "").trim();
    const client = createZapiClient();
    const db = admin.firestore();

    try {
      if (action === "status") {
        const resp = await client.get("/status");
        const statusData = resp.data || {};
        const connected = Boolean(statusData.connected);
        const smartphoneConnected = statusData.smartphoneConnected !== false;

        await db
          .collection("settings")
          .doc("zapi_health")
          .set(
            {
              connected,
              smartphoneConnected,
              error: statusData.error || null,
              checkedAtMs: Date.now(),
              source: "manual_or_poll",
            },
            { merge: true }
          )
          .catch(() => undefined);

        return { success: true, connected, smartphoneConnected, raw: statusData };
      }

      if (action === "qr_code") {
        try {
          const resp = await client.get("/qr-code/image");
          return {
            success: true,
            connected: Boolean(resp.data?.connected),
            qrCodeBase64: resp.data?.value || resp.data?.qrcode || null,
            raw: resp.data,
          };
        } catch {
          const resp = await client.get("/qr-code");
          return {
            success: true,
            connected: Boolean(resp.data?.connected),
            qrCodeBase64: resp.data?.value || resp.data?.qrcode || null,
            raw: resp.data,
          };
        }
      }

      if (action === "restart") {
        const resp = await client.get("/restart");
        return { success: true, raw: resp.data };
      }

      if (action === "disconnect") {
        const resp = await client.get("/disconnect");
        await db
          .collection("settings")
          .doc("zapi_health")
          .set({ connected: false, checkedAtMs: Date.now() }, { merge: true })
          .catch(() => undefined);
        return { success: true, raw: resp.data };
      }

      if (action === "presence") {
        const phone = formatZapiPhone(String(data?.phone || ""));
        const presence = String(data?.presence || "composing");
        if (!phone) return { success: false };
        await client.post("/presence", { phone, presence }).catch(() => undefined);
        return { success: true };
      }

      if (action === "mark_chat_read") {
        const phone = formatZapiPhone(String(data?.phone || ""));
        const messageId = String(data?.messageId || "").trim();
        if (!phone) return { success: false };

        const tasks: Promise<unknown>[] = [
          client.post("/modify-chat", { phone, action: "read" }).catch(() => undefined),
        ];
        if (messageId) {
          tasks.push(
            client.post("/read-message", { phone, messageId }).catch(() => undefined)
          );
        }
        await Promise.all(tasks);
        return { success: true };
      }

      if (action === "mark_chat_unread") {
        const phone = formatZapiPhone(String(data?.phone || ""));
        if (!phone) return { success: false };
        await client.post("/modify-chat", { phone, action: "unread" }).catch(() => undefined);
        return { success: true };
      }

      if (action === "send_text") {
        const phone = formatZapiPhone(String(data?.phone || ""));
        const message = String(data?.message || "");
        if (!phone || !message.trim()) {
          throw new functions.https.HttpsError("invalid-argument", "Telefone e mensagem são obrigatórios.");
        }
        const resp = await client.post("/send-text", { phone, message });
        return {
          success: true,
          sent: true,
          id: resp.data?.messageId || resp.data?.id || resp.data?.zaapId,
          zaapId: resp.data?.zaapId,
        };
      }

      if (action === "send_image") {
        const phone = formatZapiPhone(String(data?.phone || ""));
        const image = String(data?.image || "");
        const caption = String(data?.caption || "");
        if (!phone || !image) {
          throw new functions.https.HttpsError("invalid-argument", "Telefone e imagem são obrigatórios.");
        }
        const resp = await client.post("/send-image", { phone, image, caption }, { timeout: 45000 });
        return {
          success: true,
          sent: true,
          id: resp.data?.messageId || resp.data?.id || resp.data?.zaapId,
          zaapId: resp.data?.zaapId,
        };
      }

      if (action === "send_document") {
        const res = await sendZapiDocument({
          phone: String(data?.phone || ""),
          document: String(data?.document || ""),
          fileName: data?.fileName ? String(data.fileName) : undefined,
          caption: data?.caption ? String(data.caption) : undefined,
          extension: data?.extension ? String(data.extension) : "pdf",
        });
        return { success: res.sent, ...res };
      }

      if (action === "send_location") {
        const res = await sendZapiLocation({
          phone: String(data?.phone || ""),
          latitude: Number(data?.latitude),
          longitude: Number(data?.longitude),
          title: data?.title ? String(data.title) : undefined,
          address: data?.address ? String(data.address) : undefined,
        });
        return { success: res.sent, ...res };
      }

      if (action === "send_reaction") {
        const res = await sendZapiReaction({
          phone: String(data?.phone || ""),
          messageId: String(data?.messageId || ""),
          reaction: String(data?.reaction || "✅"),
        });
        return { success: res.sent, ...res };
      }

      if (action === "edit_message") {
        const res = await editZapiTextMessage({
          phone: String(data?.phone || ""),
          messageId: String(data?.messageId || ""),
          message: String(data?.message || ""),
        });
        return { success: res.sent, ...res };
      }

      if (action === "delete_message") {
        const res = await deleteZapiMessage({
          phone: String(data?.phone || ""),
          messageId: String(data?.messageId || ""),
          owner: data?.owner !== false,
          deleteForMe: data?.deleteForMe === true,
        });
        return { success: res.sent, ...res };
      }

      if (action === "send_button_pix") {
        const res = await sendZapiButtonPix({
          phone: String(data?.phone || ""),
          pixCode: String(data?.pixCode || ""),
          message: data?.message ? String(data.message) : undefined,
          merchantName: data?.merchantName ? String(data.merchantName) : "AVL Telecom",
        });
        return { success: res.sent, ...res };
      }

      if (action === "send_button_list") {
        const buttons = Array.isArray(data?.buttons)
          ? (data.buttons as ZapiButtonItem[]).filter((b) => b?.id && b?.label)
          : [];
        const res = await sendZapiButtonList({
          phone: String(data?.phone || ""),
          message: String(data?.message || ""),
          buttons,
        });
        return { success: res.sent, ...res };
      }

      if (action === "send_csat_survey") {
        const phone = String(data?.phone || "");
        const firstName = String(data?.clientName || "Cliente").trim().split(" ")[0] || "Cliente";
        const refId = String(data?.ticketId || data?.chatId || "atendimento").replace(/[^a-zA-Z0-9_-]/g, "");
        const prefix = data?.ticketId ? `csat_os_${refId}` : `csat_chat_${refId}`;
        const res = await sendZapiButtonList({
          phone,
          message:
            `Olá, *${firstName}*! 💙\n\n` +
            `Como você avalia o atendimento que recebeu hoje da *AVL Telecom*? Clique em uma opção abaixo:`,
          buttons: [
            { id: `${prefix}_5`, label: "⭐ Excelente" },
            { id: `${prefix}_4`, label: "👍 Bom" },
            { id: `${prefix}_1`, label: "⚠️ Ainda com problema" },
          ],
        });
        return { success: res.sent, ...res };
      }

      if (action === "phone_exists") {
        const phone = formatZapiPhone(String(data?.phone || ""));
        if (!phone) return { success: true, exists: false, phone };
        const resp = await client.get(`/phone-exists/${encodeURIComponent(phone)}`);
        return {
          success: true,
          phone,
          exists: Boolean(resp.data?.exists),
        };
      }

      if (action === "phone_exists_batch") {
        const rawPhones = Array.isArray(data?.phones) ? (data.phones as unknown[]) : [];
        const formatted = Array.from(
          new Set(rawPhones.map((p) => formatZapiPhone(String(p || ""))).filter((p) => p.length >= 12))
        ).slice(0, 150);

        if (formatted.length === 0) {
          return { success: true, results: [] };
        }

        const results: Array<{ phone: string; exists: boolean }> = [];
        const chunkSize = 50;
        for (let i = 0; i < formatted.length; i += chunkSize) {
          const chunk = formatted.slice(i, i + chunkSize);
          try {
            const resp = await client.post("/phone-exists-batch", { phones: chunk });
            const arr = Array.isArray(resp.data) ? resp.data : [];
            for (const row of arr) {
              if (row?.outputPhone || row?.inputPhone || row?.phone) {
                results.push({
                  phone: String(row.inputPhone || row.phone || row.outputPhone),
                  exists: Boolean(row.exists),
                });
              }
            }
          } catch {
            // Fallback unitário caso o plano da instância não tenha batch
            const settled = await Promise.allSettled(
              chunk.map(async (ph) => {
                const r = await client.get(`/phone-exists/${encodeURIComponent(ph)}`);
                return { phone: ph, exists: Boolean(r.data?.exists) };
              })
            );
            for (const item of settled) {
              if (item.status === "fulfilled") results.push(item.value);
            }
          }
        }
        return { success: true, results };
      }

      if (action === "get_groups") {
        const resp = await client.get("/groups");
        const arr = Array.isArray(resp.data) ? resp.data : [];
        return {
          success: true,
          groups: arr
            .filter((g: any) => g?.phone && g?.name)
            .map((g: any) => ({
              phone: String(g.phone),
              name: String(g.name).trim(),
              unread: String(g.unread || g.messagesUnread || "0"),
              lastMessageTime: String(g.lastMessageTime || ""),
            })),
        };
      }

      if (action === "get_profile_picture") {
        const phone = formatZapiPhone(String(data?.phone || ""));
        if (!phone) return { success: true, pictureUrl: null };
        const resp = await client.get(`/profile-picture?phone=${encodeURIComponent(phone)}`);
        return {
          success: true,
          pictureUrl: resp.data?.pictureUrl || resp.data?.link || null,
        };
      }

      if (action === "get_contact_info") {
        const rawInput = String(data?.phone || "").trim();
        const phone = rawInput.includes("@lid") ? rawInput : formatZapiPhone(rawInput);
        if (!phone) {
          return {
            success: true,
            name: null,
            phoneBookName: null,
            pushName: null,
            pictureUrl: null,
          };
        }

        const cleanNameCandidate = (val: unknown): string => {
          const s = String(val || "").trim();
          if (!s || s.includes("@lid") || s.includes("@c.us") || s.includes("@s.whatsapp.net")) {
            return "";
          }
          if (/^[\d\s()+-]{6,}$/.test(s)) return "";
          const lower = s.toLowerCase();
          if (
            lower === "cliente whatsapp" ||
            lower === "cliente sem nome" ||
            lower === "sem nome" ||
            lower === "unknown"
          ) {
            return "";
          }
          return s;
        };

        const [contactResp, chatResp, picResp] = await Promise.all([
          client.get(`/contacts/${encodeURIComponent(phone)}`, { timeout: 6000 }).catch(() => null),
          client.get(`/chats/${encodeURIComponent(phone)}`, { timeout: 6000 }).catch(() => null),
          !phone.includes("@lid")
            ? client
                .get(`/profile-picture?phone=${encodeURIComponent(phone)}`, { timeout: 6000 })
                .catch(() => null)
            : Promise.resolve(null),
        ]);

        const cData = (contactResp?.data || {}) as Record<string, unknown>;
        const chatData = (chatResp?.data || {}) as Record<string, unknown>;
        const picData = (picResp?.data || {}) as Record<string, unknown>;

        const phoneBookName =
          cleanNameCandidate(cData.name) || cleanNameCandidate(cData.short) || "";
        const pushName =
          cleanNameCandidate(cData.notify) ||
          cleanNameCandidate(cData.vname) ||
          cleanNameCandidate(cData.pushname) ||
          cleanNameCandidate(chatData.name) ||
          cleanNameCandidate(chatData.contactName) ||
          "";
        const bestName = phoneBookName || pushName || null;
        const pictureUrl =
          String(picData.pictureUrl || picData.link || cData.imgUrl || chatData.profileThumbnail || "").trim() ||
          null;

        return {
          success: true,
          name: bestName,
          phoneBookName: phoneBookName || null,
          pushName: pushName || null,
          pictureUrl,
        };
      }

      if (action === "add_contact") {
        const phone = formatZapiPhone(String(data?.phone || ""));
        const fullName = String(data?.name || "").trim();
        if (!phone || !fullName) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "Informe telefone e nome do contato."
          );
        }
        const parts = fullName.split(/\s+/).filter(Boolean);
        const firstName = parts[0] || fullName;
        const lastName = parts.slice(1).join(" ");

        try {
          const resp = await client.post(
            "/contacts/add",
            [
              {
                firstName,
                ...(lastName ? { lastName } : {}),
                phone,
              },
            ],
            { timeout: 10000 }
          );
          return {
            success: true,
            syncedToWhatsApp: true,
            raw: resp.data,
          };
        } catch (err: unknown) {
          const reason = axios.isAxiosError(err)
            ? err.response?.data?.message || err.message
            : err instanceof Error
            ? err.message
            : "Não suportado nesta instância Z-API";
          return {
            success: true,
            syncedToWhatsApp: false,
            reason,
          };
        }
      }

      throw new functions.https.HttpsError("invalid-argument", `Ação Z-API desconhecida: ${action}`);
    } catch (err: unknown) {
      if (err instanceof functions.https.HttpsError) throw err;
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : err instanceof Error
        ? err.message
        : "Erro na comunicação com a Z-API";
      throw new functions.https.HttpsError("internal", msg);
    }
  });

/**
 * Webhook da Z-API para status de entrega/leitura (SENT, RECEIVED, READ, PLAYED)
 * e eventos de conexão/desconexão da instância (ConnectedCallback / DisconnectedCallback).
 */
export const zapiStatusWebhook = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onRequest(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS" || req.method === "GET") {
      res.status(200).send("Z-API Status Webhook active");
      return;
    }

    try {
      const body = req.body || {};
      const db = admin.firestore();
      const eventType = String(body.type || body.event || "").toLowerCase();

      // 1. Eventos de conexão / desconexão da instância Z-API
      if (
        eventType.includes("disconnect") ||
        body.disconnected === true ||
        body.connected === false
      ) {
        await db.collection("settings").doc("zapi_health").set(
          {
            connected: false,
            smartphoneConnected: false,
            error: String(body.error || body.reason || "Instância desconectada"),
            disconnectedAtMs: Date.now(),
            checkedAtMs: Date.now(),
            source: "webhook_disconnected",
          },
          { merge: true }
        );
        res.status(200).json({ ok: true, handled: "disconnected" });
        return;
      }

      if (eventType.includes("connect") && body.connected !== false) {
        await db.collection("settings").doc("zapi_health").set(
          {
            connected: true,
            smartphoneConnected: true,
            error: null,
            connectedAtMs: Date.now(),
            checkedAtMs: Date.now(),
            source: "webhook_connected",
          },
          { merge: true }
        );
        res.status(200).json({ ok: true, handled: "connected" });
        return;
      }

      // 2. Status de entrega/leitura de mensagem (MessageStatusCallback)
      const rawStatus = String(body.status || body.ack || "").toUpperCase();
      const rawPhoneStr = String(body.phone || body.chatId || "").trim();
      const rawChatLid = String(
        body.chatLid || (rawPhoneStr.includes("@lid") ? rawPhoneStr : "")
      ).trim();
      const rawPhone = rawPhoneStr.includes("@lid") ? "" : rawPhoneStr.replace(/\D/g, "");
      const phoneVariants = rawPhone ? buildBrPhoneVariants(rawPhone) : [];

      // Helper para resolver telefone real de um @lid via Z-API /contacts/{lid}
      const resolvePhoneVariantsFromLid = async (lid: string): Promise<string[]> => {
        if (!lid) return [];
        try {
          const client = createZapiClient();
          const resp = await client.get(`/contacts/${encodeURIComponent(lid)}`, { timeout: 5000 });
          const maybePhone = String(resp.data?.phone || "").trim();
          if (maybePhone && !maybePhone.includes("@lid")) {
            return buildBrPhoneVariants(maybePhone);
          }
        } catch {
          // ignora silenciosamente se Z-API não resolver
        }
        return [];
      };

      // 2a. READ_BY_ME: você visualizou a conversa diretamente pelo celular -> zera não lidas no Dashboard!
      if (rawStatus === "READ_BY_ME" && (phoneVariants.length > 0 || rawChatLid) && !body.isGroup) {
        let targetRef: admin.firestore.DocumentReference | null = null;
        if (rawChatLid) {
          const lidSnap = await db
            .collection("chat")
            .where("chatLid", "==", rawChatLid)
            .limit(5)
            .get()
            .catch(() => null);
          if (lidSnap && !lidSnap.empty) {
            const realDoc = lidSnap.docs.find((d) => !d.id.includes("@lid"));
            if (realDoc) targetRef = realDoc.ref;
          }
        }
        let lookupVariants = phoneVariants;
        if (!targetRef && lookupVariants.length === 0 && rawChatLid) {
          lookupVariants = await resolvePhoneVariantsFromLid(rawChatLid);
        }
        if (!targetRef && lookupVariants.length > 0) {
          const snaps = await db.getAll(
            ...lookupVariants.map((v) => db.collection("chat").doc(v))
          );
          const found = snaps.find((s) => s.exists);
          if (found) targetRef = found.ref;
        }
        if (targetRef) {
          const snap = await targetRef.get();
          const currentUnread = Number(snap.data()?.unreadCount || 0);
          const patch: Record<string, unknown> = { lastReadByMeAtMs: Date.now() };
          if (currentUnread > 0) patch.unreadCount = 0;
          if (rawChatLid && !snap.data()?.chatLid) patch.chatLid = rawChatLid;
          if (currentUnread > 0 || (rawChatLid && !snap.data()?.chatLid)) {
            await targetRef.set(patch, { merge: true });
          }
        }
        res.status(200).json({ ok: true, status: "READ_BY_ME" });
        return;
      }

      const normalizedStatus =
        rawStatus === "PLAYED"
          ? "PLAYED"
          : rawStatus === "READ" || rawStatus === "3"
          ? "READ"
          : rawStatus === "RECEIVED" || rawStatus === "DELIVERED" || rawStatus === "2"
          ? "RECEIVED"
          : rawStatus === "SENT" || rawStatus === "1"
          ? "SENT"
          : null;

      const candidateIds: string[] = [];
      if (Array.isArray(body.ids)) {
        body.ids.forEach((id: unknown) => {
          if (id) candidateIds.push(String(id));
        });
      }
      if (body.messageId) candidateIds.push(String(body.messageId));
      if (body.zaapId) candidateIds.push(String(body.zaapId));
      if (body.id) candidateIds.push(String(body.id));

      if (normalizedStatus && candidateIds.length > 0) {
        const statusRank: Record<string, number> = {
          SENT: 1,
          RECEIVED: 2,
          READ: 3,
          PLAYED: 4,
        };
        const uniqueIds = Array.from(new Set(candidateIds));

        const updateMessageDoc = async (targetRef: admin.firestore.DocumentReference) => {
          await db.runTransaction(async (tx) => {
            const snap = await tx.get(targetRef);
            if (!snap.exists) return;
            const current = String(snap.data()?.deliveryStatus || "SENT").toUpperCase();
            if ((statusRank[normalizedStatus] || 0) >= (statusRank[current] || 0)) {
              tx.set(
                targetRef,
                {
                  deliveryStatus: normalizedStatus,
                  deliveryUpdatedAtMs: Date.now(),
                },
                { merge: true }
              );
            }
          });
        };

        for (const rawId of uniqueIds) {
          let updated = false;
          const idxKey = sanitizeIndexKey(rawId);
          if (idxKey) {
            const idxSnap = await db.collection("zapi_message_index").doc(idxKey).get();
            if (idxSnap.exists) {
              const idx = idxSnap.data() || {};
              const collectionPath = String(idx.collectionPath || "");
              const docId = String(idx.docId || "");
              const indexedChatId = String(idx.chatId || "").trim();
              if (collectionPath && docId) {
                await updateMessageDoc(db.collection(collectionPath).doc(docId));
                if (rawChatLid && indexedChatId && !body.isGroup) {
                  await db
                    .collection("chat")
                    .doc(indexedChatId)
                    .set({ chatLid: rawChatLid }, { merge: true })
                    .catch(() => undefined);
                }
                updated = true;
              }
            }
          }

          // Fallback por zapiMessageId na subcoleção do chat (testa todas as variantes BR e chatLid)
          if (!updated && !body.isGroup && (phoneVariants.length > 0 || rawChatLid)) {
            const chatIdsToTry = [...phoneVariants];
            if (rawChatLid) {
              const lidSnap = await db
                .collection("chat")
                .where("chatLid", "==", rawChatLid)
                .limit(5)
                .get()
                .catch(() => null);
              if (lidSnap && !lidSnap.empty) {
                const realDocs = lidSnap.docs.filter((d) => !d.id.includes("@lid"));
                for (const d of realDocs.length > 0 ? realDocs : lidSnap.docs) {
                  chatIdsToTry.unshift(d.id);
                }
              }
              if (chatIdsToTry.length === 0) {
                const resolved = await resolvePhoneVariantsFromLid(rawChatLid);
                chatIdsToTry.push(...resolved);
              }
            }
            for (const cid of Array.from(new Set(chatIdsToTry)).slice(0, 5)) {
              const msgSnap = await db
                .collection("chat")
                .doc(cid)
                .collection("mensagens")
                .where("zapiMessageId", "==", rawId)
                .limit(1)
                .get()
                .catch(() => null);
              if (msgSnap && !msgSnap.empty) {
                await updateMessageDoc(msgSnap.docs[0].ref);
                break;
              }
            }
          }
        }
      }

      res.status(200).json({ ok: true, status: normalizedStatus });
    } catch (err: unknown) {
      console.error("[zapiStatusWebhook] Erro:", err);
      res.status(500).json({ ok: false });
    }
  });
