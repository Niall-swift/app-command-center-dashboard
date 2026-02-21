import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {WhapiService} from "./whapiService";
import {ClientData, WelcomeMessageLog} from "./types";

// Inicializar Firebase Admin
admin.initializeApp();

/**
 * Cloud Function que dispara quando um novo cliente se cadastra no sorteio
 * Envia automaticamente uma mensagem de boas-vindas via WhatsApp
 */
export const onNewRaffleRegistration = functions.firestore
  .document("usuariosDoPreMix/{userId}")
  .onCreate(async (snapshot, context) => {
    const userId = context.params.userId;
    const clientData = snapshot.data() as ClientData;

    console.log("🎉 Novo cadastro detectado:", {
      userId,
      name: clientData.name || clientData.nome,
      phone: clientData.whatsapp || clientData.phone,
    });

    // Verificar se já foi enviada mensagem (evitar duplicatas)
    if (snapshot.get("mensagem_enviada")) {
      console.log("⚠️ Mensagem já foi enviada anteriormente. Ignorando.");
      return null;
    }

    // Configurações hardcoded (temporário para deploy funcionar)
    const whapiApiKey = "37oG32qZ2Ltk15Pm3aOs9il1JOYfYOdM";
    const whapiBaseUrl = "https://gate.whapi.cloud";

    if (!whapiApiKey) {
      console.error("❌ WHAPI_API_KEY não configurado!");
      await updateClientWithError(
        userId,
        "Configuração de API não encontrada"
      );
      return null;
    }

    // Extrair dados do cliente
    const clientName = clientData.name || clientData.nome || "Cliente";
    const clientPhone = clientData.whatsapp || clientData.phone;

    if (!clientPhone) {
      console.error("❌ Cliente não possui telefone cadastrado");
      await updateClientWithError(userId, "Telefone não cadastrado");
      return null;
    }

    try {
      // Enviar mensagem de boas-vindas
      const whapiService = new WhapiService(whapiApiKey, whapiBaseUrl);
      const result = await whapiService.sendWelcomeMessage(
        clientName,
        clientPhone
      );

      // Criar log de envio
      const log: WelcomeMessageLog = {
        clientId: userId,
        clientName: clientName,
        phone: clientPhone,
        status: result.sent ? "success" : "failed",
        error: result.error,
        messageId: result.id,
        timestamp: new Date().toISOString(),
      };

      // Salvar log no Firestore
      await admin.firestore()
        .collection("welcome_message_logs")
        .add(log);

      // Atualizar documento do cliente
      if (result.sent) {
        await snapshot.ref.update({
          mensagem_enviada: true,
          mensagem_enviada_em: admin.firestore.FieldValue.serverTimestamp(),
          mensagem_id: result.id,
        });

        console.log("✅ Mensagem de boas-vindas enviada com sucesso!");
      } else {
        await snapshot.ref.update({
          mensagem_enviada: false,
          mensagem_erro: result.error,
          mensagem_tentativa_em:
            admin.firestore.FieldValue.serverTimestamp(),
        });

        console.error("❌ Falha ao enviar mensagem:", result.error);
      }

      return log;
    } catch (error) {
      console.error("❌ Erro ao processar cadastro:", error);
      await updateClientWithError(
        userId,
        error instanceof Error ? error.message : "Erro desconhecido"
      );
      return null;
    }
  });

/**
 * Atualiza o documento do cliente com informações de erro
 */
async function updateClientWithError(
  userId: string,
  errorMessage: string
): Promise<void> {
  try {
    await admin.firestore()
      .collection("usuariosDoPreMix")
      .doc(userId)
      .update({
        mensagem_enviada: false,
        mensagem_erro: errorMessage,
        mensagem_tentativa_em: admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch (error) {
    console.error("Erro ao atualizar documento:", error);
  }
}
