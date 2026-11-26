import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { verifyAuth } from "./config/auth";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export type PanelUserRole = "creator" | "admin" | "operador";

export interface PanelUserDoc {
  uid: string;
  name: string;
  email: string;
  role: PanelUserRole;
  active: boolean;
  allowedRoutes: string[];
  photoUrl?: string;
  jobTitle?: string;
  hasPin?: boolean;
  pinUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  lastLoginAt?: string;
}

interface PanelUserPinDoc {
  hash: string;
  salt: string;
  failedAttempts?: number;
  lockedUntilMs?: number;
  updatedAt: string;
}

const CREATOR_EMAIL = "niallswift@gmail.com";
const COLLECTION = "panel_users";
const PIN_COLLECTION = "panel_user_pins";
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_MS = 30 * 1000;

function sanitizePinInput(raw: unknown): string {
  return String(raw || "").trim();
}

function assertValidSixDigitPin(pin: string): void {
  if (!/^\d{6}$/.test(pin)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "A senha numérica de entrada (PIN) deve conter exatamente 6 dígitos numéricos."
    );
  }
}

function hashPin(pin: string, salt: string): string {
  return crypto.scryptSync(pin, salt, 32).toString("hex");
}

async function saveUserPin(uid: string, pin: string): Promise<string> {
  assertValidSixDigitPin(pin);
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPin(pin, salt);
  const now = new Date().toISOString();
  const payload: PanelUserPinDoc = {
    hash,
    salt,
    failedAttempts: 0,
    lockedUntilMs: 0,
    updatedAt: now,
  };
  await admin.firestore().collection(PIN_COLLECTION).doc(uid).set(payload);
  return now;
}

async function clearUserPin(uid: string): Promise<void> {
  await admin
    .firestore()
    .collection(PIN_COLLECTION)
    .doc(uid)
    .delete()
    .catch(() => undefined);
}

const ALL_PANEL_ROUTES = [
  "/",
  "/ispfy/regiao",
  "/ispfy/inteligencia",
  "/ispfy/nova-os",
  "/ispfy/tickets",
  "/network-map",
  "/technical-support",
  "/chat",
  "/whatsapp/bulk",
  "/bots",
  "/notifications",
  "/requests",
  "/ispfy/consulta",
  "/ispfy/financeiro",
  "/ispfy/auditoria",
  "/ispfy/vencimentos",
  "/ispfy/carencia",
  "/ispfy/dici",
  "/ispfy/exportar-ativos",
  "/raffle",
  "/paid-raffles",
  "/movies",
  "/series",
  "/avlplay-analytics",
  "/rewards-management",
  "/redemption-orders",
  "/analytics",
  "/settings",
];

const VALID_ROUTE_SET = new Set(ALL_PANEL_ROUTES);

function normalizeEmail(raw: unknown): string {
  return String(raw || "").trim().toLowerCase();
}

function sanitizePhotoUrl(raw: unknown): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.length > 2048) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "URL da foto excede o limite permitido."
    );
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "A URL da foto deve começar com http:// ou https://."
    );
  }
  return trimmed;
}

function sanitizeRoutes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<string>();
  for (const item of raw) {
    const str = String(item || "").trim();
    if (VALID_ROUTE_SET.has(str)) {
      unique.add(str);
    }
  }
  return Array.from(unique);
}

function isCreator(email?: string | null): boolean {
  return normalizeEmail(email) === CREATOR_EMAIL;
}

async function ensureCreatorProfile(
  uid: string,
  displayName?: string | null
): Promise<PanelUserDoc> {
  const db = admin.firestore();
  const ref = db.collection(COLLECTION).doc(uid);
  const snap = await ref.get();
  const now = new Date().toISOString();

  const existing = snap.exists ? (snap.data() as Partial<PanelUserDoc>) : null;
  let authPhotoUrl = "";
  if (!existing?.photoUrl) {
    const authRec = await admin
      .auth()
      .getUser(uid)
      .catch(() => null);
    authPhotoUrl = authRec?.photoURL || "";
  }

  const profile: PanelUserDoc = {
    uid,
    name: existing?.name || displayName || "Niall (Criador)",
    email: CREATOR_EMAIL,
    role: "creator",
    active: true,
    allowedRoutes: ALL_PANEL_ROUTES,
    photoUrl: existing?.photoUrl || authPhotoUrl || "",
    jobTitle: existing?.jobTitle || "Criador & Administrador Master",
    hasPin: Boolean(existing?.hasPin),
    ...(existing?.pinUpdatedAt ? { pinUpdatedAt: existing.pinUpdatedAt } : {}),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    createdBy: existing?.createdBy || "system",
    lastLoginAt: now,
  };

  await ref.set(profile, { merge: true });
  await admin
    .auth()
    .setCustomUserClaims(uid, { role: "creator", admin: true })
    .catch(() => undefined);

  return profile;
}

async function assertCallerIsAdmin(
  context: functions.https.CallableContext
): Promise<PanelUserDoc> {
  verifyAuth(context);
  const uid = context.auth!.uid;
  const callerEmail = normalizeEmail(context.auth!.token.email);

  if (isCreator(callerEmail)) {
    return ensureCreatorProfile(uid, String(context.auth!.token.name || ""));
  }

  const db = admin.firestore();
  const snap = await db.collection(COLLECTION).doc(uid).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Apenas administradores podem gerenciar logins de operadores."
    );
  }

  const profile = snap.data() as PanelUserDoc;
  if (!profile.active || (profile.role !== "admin" && profile.role !== "creator")) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Permissão insuficiente. Apenas administradores ativos podem executar esta ação."
    );
  }

  return profile;
}

function sortUsers(list: PanelUserDoc[]): PanelUserDoc[] {
  const weight: Record<PanelUserRole, number> = {
    creator: 0,
    admin: 1,
    operador: 2,
  };
  return [...list].sort((a, b) => {
    const diff = (weight[a.role] ?? 9) - (weight[b.role] ?? 9);
    if (diff !== 0) return diff;
    return String(a.name || a.email).localeCompare(String(b.name || b.email), "pt-BR");
  });
}

/**
 * Gestão segura de logins de Administradores e Operadores do painel AVL.
 * Ações: syncSelf | list | create | update | delete
 */
export const managePanelUsers = functions
  .runWith({ memory: "256MB", timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    verifyAuth(context);

    const action = String(data?.action || "").trim();
    const db = admin.firestore();

    // ─── 1. syncSelf: bootstrap do Criador ou validação do próprio usuário logado ───
    if (action === "syncSelf") {
      const uid = context.auth!.uid;
      const email = normalizeEmail(context.auth!.token.email);
      const tokenName = String(context.auth!.token.name || "").trim();

      if (isCreator(email)) {
        const profile = await ensureCreatorProfile(uid, tokenName);
        return { success: true, authorized: true, profile };
      }

      const docRef = db.collection(COLLECTION).doc(uid);
      const snap = await docRef.get();
      if (snap.exists) {
        const current = snap.data() as PanelUserDoc;
        const now = new Date().toISOString();
        await docRef.set({ lastLoginAt: now }, { merge: true });
        return {
          success: true,
          authorized: true,
          profile: { ...current, uid, lastLoginAt: now },
        };
      }

      // Fallback: verificar se existe documento cadastrado pelo mesmo e-mail
      if (email) {
        const byEmail = await db
          .collection(COLLECTION)
          .where("email", "==", email)
          .limit(1)
          .get();

        if (!byEmail.empty) {
          const oldDoc = byEmail.docs[0];
          const oldData = oldDoc.data() as PanelUserDoc;
          const now = new Date().toISOString();
          const migrated: PanelUserDoc = {
            ...oldData,
            uid,
            email,
            lastLoginAt: now,
            updatedAt: now,
          };
          await docRef.set(migrated, { merge: true });
          if (oldDoc.id !== uid) {
            await oldDoc.ref.delete().catch(() => undefined);
          }
          await admin
            .auth()
            .setCustomUserClaims(uid, {
              role: migrated.role,
              admin: migrated.role === "admin" || migrated.role === "creator",
            })
            .catch(() => undefined);
          return { success: true, authorized: true, profile: migrated };
        }
      }

      return { success: true, authorized: false, profile: null };
    }

    // ─── 1b. verifyPin: valida a senha numérica de 6 dígitos do próprio usuário logado ───
    if (action === "verifyPin") {
      const uid = context.auth!.uid;
      const pin = sanitizePinInput(data?.pin);
      assertValidSixDigitPin(pin);

      const pinRef = db.collection(PIN_COLLECTION).doc(uid);
      const pinSnap = await pinRef.get();
      if (!pinSnap.exists) {
        await db.collection(COLLECTION).doc(uid).set({ hasPin: false }, { merge: true }).catch(() => undefined);
        return { success: true, valid: true, hasPin: false };
      }

      const pinDoc = pinSnap.data() as PanelUserPinDoc;
      const nowMs = Date.now();
      if (pinDoc.lockedUntilMs && pinDoc.lockedUntilMs > nowMs) {
        return {
          success: true,
          valid: false,
          hasPin: true,
          lockedUntilMs: pinDoc.lockedUntilMs,
          remainingAttempts: 0,
        };
      }

      const derived = hashPin(pin, pinDoc.salt);
      const storedBuf = Buffer.from(pinDoc.hash, "hex");
      const derivedBuf = Buffer.from(derived, "hex");
      const isMatch =
        storedBuf.length === derivedBuf.length &&
        crypto.timingSafeEqual(storedBuf, derivedBuf);

      if (isMatch) {
        if ((pinDoc.failedAttempts || 0) > 0 || (pinDoc.lockedUntilMs || 0) > 0) {
          await pinRef.set({ failedAttempts: 0, lockedUntilMs: 0 }, { merge: true });
        }
        return { success: true, valid: true, hasPin: true };
      }

      const nextAttempts = (pinDoc.failedAttempts || 0) + 1;
      const shouldLock = nextAttempts >= MAX_PIN_ATTEMPTS;
      const lockedUntilMs = shouldLock ? nowMs + PIN_LOCK_MS : 0;
      await pinRef.set(
        {
          failedAttempts: shouldLock ? 0 : nextAttempts,
          lockedUntilMs,
        },
        { merge: true }
      );

      return {
        success: true,
        valid: false,
        hasPin: true,
        remainingAttempts: shouldLock ? 0 : Math.max(0, MAX_PIN_ATTEMPTS - nextAttempts),
        ...(shouldLock ? { lockedUntilMs } : {}),
      };
    }

    // Todas as ações administrativas exigem Criador ou Admin ativo
    const caller = await assertCallerIsAdmin(context);

    // ─── 2. list: listar todos os usuários do painel ───
    if (action === "list") {
      const snap = await db.collection(COLLECTION).get();
      const users = snap.docs.map((d) => ({
        ...(d.data() as PanelUserDoc),
        uid: d.id,
      }));
      return { success: true, users: sortUsers(users) };
    }

    // ─── 3. create: criar novo Administrador ou Operador ───
    if (action === "create") {
      const name = String(data?.name || "").trim();
      const email = normalizeEmail(data?.email);
      const password = String(data?.password || "");
      const role: PanelUserRole = data?.role === "admin" ? "admin" : "operador";
      const active = data?.active !== false;
      const jobTitle = String(data?.jobTitle || "").trim();
      const photoUrl = sanitizePhotoUrl(data?.photoUrl);
      const rawPin = sanitizePinInput(data?.pin);
      if (rawPin) {
        assertValidSixDigitPin(rawPin);
      }
      const syncToAttendants = Boolean(data?.syncToAttendants);
      const allowedRoutes =
        role === "admin" ? ALL_PANEL_ROUTES : sanitizeRoutes(data?.allowedRoutes);

      if (name.length < 2) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Informe o nome completo do operador (mínimo 2 caracteres)."
        );
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Informe um e-mail válido."
        );
      }
      if (isCreator(email)) {
        throw new functions.https.HttpsError(
          "already-exists",
          "Este e-mail é reservado à conta do Criador (Administrador Master)."
        );
      }
      if (password.length > 0 && password.length < 6) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "A senha deve ter no mínimo 6 caracteres."
        );
      }
      if (role === "operador" && allowedRoutes.length === 0) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Selecione pelo menos uma tela liberada para o operador."
        );
      }

      let authUser: admin.auth.UserRecord;
      try {
        const existingAuth = await admin
          .auth()
          .getUserByEmail(email)
          .catch(() => null);

        if (existingAuth) {
          const existingPanelDoc = await db
            .collection(COLLECTION)
            .doc(existingAuth.uid)
            .get();
          if (existingPanelDoc.exists) {
            throw new functions.https.HttpsError(
              "already-exists",
              "Já existe um operador/administrador cadastrado com este e-mail."
            );
          }

          const updatePayload: admin.auth.UpdateRequest = {
            displayName: name,
            disabled: !active,
            ...(photoUrl ? { photoURL: photoUrl } : {}),
          };
          if (password.length >= 6) {
            updatePayload.password = password;
          }
          authUser = await admin.auth().updateUser(existingAuth.uid, updatePayload);
        } else {
          if (password.length < 6) {
            throw new functions.https.HttpsError(
              "invalid-argument",
              "Defina uma senha inicial com pelo menos 6 caracteres."
            );
          }
          authUser = await admin.auth().createUser({
            email,
            password,
            displayName: name,
            disabled: !active,
            ...(photoUrl ? { photoURL: photoUrl } : {}),
          });
        }
      } catch (err: unknown) {
        if (err instanceof functions.https.HttpsError) throw err;
        const msg = err instanceof Error ? err.message : "Erro ao criar conta no Firebase Auth.";
        throw new functions.https.HttpsError("internal", msg);
      }

      await admin.auth().setCustomUserClaims(authUser.uid, {
        role,
        admin: role === "admin",
      });

      const now = new Date().toISOString();
      let pinUpdatedAt: string | undefined;
      if (rawPin) {
        pinUpdatedAt = await saveUserPin(authUser.uid, rawPin);
      }
      const newProfile: PanelUserDoc = {
        uid: authUser.uid,
        name,
        email,
        role,
        active,
        allowedRoutes,
        photoUrl: photoUrl || authUser.photoURL || "",
        jobTitle: jobTitle || (role === "admin" ? "Administrador" : "Operador"),
        hasPin: Boolean(rawPin),
        ...(pinUpdatedAt ? { pinUpdatedAt } : {}),
        createdAt: now,
        updatedAt: now,
        createdBy: caller.email,
      };

      await db.collection(COLLECTION).doc(authUser.uid).set(newProfile);

      if (syncToAttendants) {
        const attSnap = await db
          .collection("attendants")
          .where("email", "==", email)
          .limit(1)
          .get();
        if (attSnap.empty) {
          await db.collection("attendants").add({
            name,
            email,
            avatar: photoUrl || "",
            role: role === "admin" ? "tecnico" : "atendente",
            status: active ? "ativo" : "inativo",
            createdAt: now,
            panelUid: authUser.uid,
          });
        }
      }

      return { success: true, user: newProfile };
    }

    // ─── 4. update: atualizar permissões, cargo, status ou senha ───
    if (action === "update") {
      const targetUid = String(data?.uid || "").trim();
      if (!targetUid) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "UID do usuário é obrigatório."
        );
      }

      const targetRef = db.collection(COLLECTION).doc(targetUid);
      const targetSnap = await targetRef.get();
      if (!targetSnap.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Operador não encontrado."
        );
      }

      const current = targetSnap.data() as PanelUserDoc;
      const targetIsCreator =
        current.role === "creator" || isCreator(current.email);

      if (targetIsCreator && caller.uid !== targetUid) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Apenas o próprio Criador pode alterar dados da conta master."
        );
      }

      const nextName =
        typeof data?.name === "string" && data.name.trim().length >= 2
          ? data.name.trim()
          : current.name;
      const nextJobTitle =
        typeof data?.jobTitle === "string" ? data.jobTitle.trim() : current.jobTitle || "";
      const hasPhotoUpdate = typeof data?.photoUrl === "string";
      const nextPhotoUrl = hasPhotoUpdate
        ? sanitizePhotoUrl(data?.photoUrl)
        : current.photoUrl || "";
      const nextRole: PanelUserRole = targetIsCreator
        ? "creator"
        : data?.role === "admin"
        ? "admin"
        : "operador";
      const nextActive = targetIsCreator
        ? true
        : typeof data?.active === "boolean"
        ? data.active
        : current.active;

      if (caller.uid === targetUid && (!nextActive || nextRole === "operador")) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Você não pode desativar ou remover o acesso administrativo da sua própria conta."
        );
      }

      const nextRoutes =
        nextRole === "creator" || nextRole === "admin"
          ? ALL_PANEL_ROUTES
          : Array.isArray(data?.allowedRoutes)
          ? sanitizeRoutes(data.allowedRoutes)
          : current.allowedRoutes;

      if (nextRole === "operador" && nextRoutes.length === 0) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Selecione pelo menos uma tela liberada para o operador."
        );
      }

      const newPassword = typeof data?.password === "string" ? data.password : "";
      if (newPassword.length > 0 && newPassword.length < 6) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "A nova senha deve ter no mínimo 6 caracteres."
        );
      }

      const rawPin = sanitizePinInput(data?.pin);
      const shouldClearPin = Boolean(data?.clearPin);
      if (rawPin) {
        assertValidSixDigitPin(rawPin);
      }

      const authUpdate: admin.auth.UpdateRequest = {
        displayName: nextName,
        disabled: !nextActive,
      };
      if (hasPhotoUpdate) {
        authUpdate.photoURL = nextPhotoUrl || null;
      }
      if (newPassword.length >= 6) {
        authUpdate.password = newPassword;
      }

      await admin
        .auth()
        .updateUser(targetUid, authUpdate)
        .catch((err) => {
          throw new functions.https.HttpsError(
            "internal",
            err instanceof Error ? err.message : "Falha ao atualizar usuário no Firebase Auth."
          );
        });

      await admin.auth().setCustomUserClaims(targetUid, {
        role: nextRole,
        admin: nextRole === "admin" || nextRole === "creator",
      });

      if (!nextActive) {
        await admin.auth().revokeRefreshTokens(targetUid).catch(() => undefined);
      }

      let nextHasPin = Boolean(current.hasPin);
      let nextPinUpdatedAt = current.pinUpdatedAt;
      if (shouldClearPin) {
        await clearUserPin(targetUid);
        nextHasPin = false;
        nextPinUpdatedAt = undefined;
      } else if (rawPin) {
        nextPinUpdatedAt = await saveUserPin(targetUid, rawPin);
        nextHasPin = true;
      }

      const updated: PanelUserDoc = {
        ...current,
        uid: targetUid,
        name: nextName,
        photoUrl: nextPhotoUrl,
        jobTitle: nextJobTitle,
        role: nextRole,
        active: nextActive,
        allowedRoutes: nextRoutes,
        hasPin: nextHasPin,
        ...(nextPinUpdatedAt ? { pinUpdatedAt: nextPinUpdatedAt } : {}),
        updatedAt: new Date().toISOString(),
      };

      if (shouldClearPin) {
        delete updated.pinUpdatedAt;
      }

      await targetRef.set(
        shouldClearPin
          ? {
              ...updated,
              pinUpdatedAt: admin.firestore.FieldValue.delete(),
            }
          : updated,
        { merge: true }
      );

      // Se existir assinatura em attendants vinculada a este login, mantém foto e nome sincronizados
      if (hasPhotoUpdate || nextName !== current.name) {
        const attByUid = await db
          .collection("attendants")
          .where("panelUid", "==", targetUid)
          .limit(1)
          .get();
        if (!attByUid.empty) {
          await attByUid.docs[0].ref
            .set(
              {
                name: nextName,
                ...(hasPhotoUpdate ? { avatar: nextPhotoUrl } : {}),
                status: nextActive ? "ativo" : "inativo",
              },
              { merge: true }
            )
            .catch(() => undefined);
        }
      }

      return { success: true, user: updated };
    }

    // ─── 5. delete: remover operador/admin ───
    if (action === "delete") {
      const targetUid = String(data?.uid || "").trim();
      if (!targetUid) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "UID do usuário é obrigatório."
        );
      }
      if (targetUid === caller.uid) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Você não pode excluir sua própria conta."
        );
      }

      const targetRef = db.collection(COLLECTION).doc(targetUid);
      const targetSnap = await targetRef.get();
      if (targetSnap.exists) {
        const current = targetSnap.data() as PanelUserDoc;
        if (current.role === "creator" || isCreator(current.email)) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "A conta do Criador não pode ser excluída."
          );
        }
      }

      await admin
        .auth()
        .deleteUser(targetUid)
        .catch((err: { code?: string }) => {
          if (err?.code !== "auth/user-not-found") {
            throw new functions.https.HttpsError(
              "internal",
              "Erro ao remover usuário no Firebase Auth."
            );
          }
        });

      await targetRef.delete();
      await clearUserPin(targetUid);
      return { success: true, deletedUid: targetUid };
    }

    throw new functions.https.HttpsError(
      "invalid-argument",
      `Ação inválida: ${action}`
    );
  });
