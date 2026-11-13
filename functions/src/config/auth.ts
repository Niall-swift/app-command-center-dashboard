import * as functions from "firebase-functions/v1";

/**
 * Garante que a função invocável (onCall) esteja sendo chamada por um usuário autenticado.
 */
export function verifyAuth(context: functions.https.CallableContext): void {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "O usuário deve estar autenticado para executar esta ação."
    );
  }
}

