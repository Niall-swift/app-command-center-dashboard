import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface SlashMacro {
  id: string;
  cmd: string;
  label: string;
  text: string;
  isDefault?: boolean;
  updatedAt?: number;
}

export const DEFAULT_SLASH_MACROS: SlashMacro[] = [
  {
    id: 'default-pix',
    cmd: '/pix',
    label: 'Solicitar CPF p/ PIX',
    text: 'Olá! Para agilizar o envio da sua 2ª via PIX, poderia me confirmar seu CPF ou CNPJ, por favor? 💠',
    isDefault: true,
  },
  {
    id: 'default-reiniciar',
    cmd: '/reiniciar',
    label: 'Teste de reinício ONT/Roteador',
    text: 'Por gentileza, desligue o roteador e a caixinha da fibra da tomada por 30 segundos e ligue novamente. Me avise se a luz PON/Internet ficou verde fixa! 📶',
    isDefault: true,
  },
  {
    id: 'default-rompimento',
    cmd: '/rompimento',
    label: 'Aviso de rompimento/manutenção',
    text: 'Identificamos uma instabilidade técnica na sua região. Nossa equipe de campo já está atuando no local para restabelecer o sinal o mais rápido possível! 🙏',
    isDefault: true,
  },
  {
    id: 'default-desbloqueio',
    cmd: '/desbloqueio',
    label: 'Confirmar desbloqueio em confiança',
    text: '✅ Liberação em confiança realizada com sucesso! Reinicie o equipamento em alguns instantes para retomar a navegação.',
    isDefault: true,
  },
  {
    id: 'default-agendamento',
    cmd: '/agendamento',
    label: 'Confirmar visita técnica',
    text: '🚗 Sua visita técnica está programada! Por favor, mantenha um responsável no local para receber nossa equipe.',
    isDefault: true,
  },
  {
    id: 'default-avaliacao',
    cmd: '/avaliacao',
    label: 'Pedir avaliação do atendimento',
    text: 'Fico feliz em ajudar! Se precisar de qualquer outra coisa, estamos sempre à disposição aqui na AVL Telecom. 💙',
    isDefault: true,
  },
];

const SLASH_MACROS_STORAGE_KEY = 'avl_chat_slash_macros_v1';
const SLASH_MACROS_DOC_REF = () => doc(db, 'bot_config', 'chat_slash_macros');

/**
 * Normaliza qualquer comando digitado para formato seguro `/comando`
 * (sem acentos, minúsculo, apenas letras, números, hífen e underscore).
 */
export function normalizeSlashCommand(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\/+/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');

  return cleaned ? `/${cleaned}` : '';
}

/**
 * Substitui variáveis dinâmicas como `{nome}` ou `{client.name}` pelo nome do cliente.
 */
export function applySlashMacroVariables(text: string, clientName?: string): string {
  const safeName = (clientName || '').trim() || 'Cliente';
  const firstName = safeName.split(/\s+/)[0] || safeName;
  return text
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{nome\}/gi, safeName)
    .replace(/\{client\.name\}/gi, safeName);
}

function readCachedMacros(): SlashMacro[] {
  try {
    const raw = localStorage.getItem(SLASH_MACROS_STORAGE_KEY);
    if (!raw) return DEFAULT_SLASH_MACROS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SLASH_MACROS;
    return parsed.filter(
      (item): item is SlashMacro =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as SlashMacro).id === 'string' &&
        typeof (item as SlashMacro).cmd === 'string' &&
        typeof (item as SlashMacro).text === 'string'
    );
  } catch {
    return DEFAULT_SLASH_MACROS;
  }
}

function writeCachedMacros(list: SlashMacro[]): void {
  try {
    localStorage.setItem(SLASH_MACROS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // quota indisponível
  }
}

function sanitizeMacrosFromFirestore(rawItems: unknown): SlashMacro[] {
  if (!Array.isArray(rawItems)) return DEFAULT_SLASH_MACROS;
  const seen = new Set<string>();
  const result: SlashMacro[] = [];
  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Partial<SlashMacro>;
    const cmd = normalizeSlashCommand(String(rec.cmd || ''));
    const text = String(rec.text || '').trim();
    if (!cmd || !text || seen.has(cmd)) continue;
    seen.add(cmd);
    result.push({
      id: String(rec.id || `macro-${cmd.slice(1)}`),
      cmd,
      label: String(rec.label || cmd.slice(1)).trim(),
      text,
      isDefault: Boolean(rec.isDefault),
      updatedAt: typeof rec.updatedAt === 'number' ? rec.updatedAt : undefined,
    });
  }
  return result;
}

export function useSlashMacros() {
  const [macros, setMacros] = useState<SlashMacro[]>(readCachedMacros);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      SLASH_MACROS_DOC_REF(),
      (snap) => {
        if (!snap.exists()) {
          // Primeira vez: mantém padrões localmente sem forçar escrita desnecessária
          setMacros(DEFAULT_SLASH_MACROS);
          writeCachedMacros(DEFAULT_SLASH_MACROS);
          return;
        }
        const data = snap.data();
        const parsed = sanitizeMacrosFromFirestore(data?.items);
        setMacros(parsed);
        writeCachedMacros(parsed);
      },
      () => {
        // Fallback silencioso para cache local
      }
    );
    return () => unsub();
  }, []);

  const persistMacros = useCallback(async (nextList: SlashMacro[]) => {
    setSaving(true);
    setMacros(nextList);
    writeCachedMacros(nextList);
    try {
      await setDoc(
        SLASH_MACROS_DOC_REF(),
        {
          items: nextList,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } finally {
      setSaving(false);
    }
  }, []);

  const upsertMacro = useCallback(
    async (input: { id?: string; cmd: string; label: string; text: string }) => {
      const normalizedCmd = normalizeSlashCommand(input.cmd);
      if (!normalizedCmd) {
        throw new Error('Informe um atalho válido (ex.: /boasvindas).');
      }
      const trimmedText = input.text.trim();
      if (!trimmedText) {
        throw new Error('Digite o texto da mensagem rápida.');
      }
      const trimmedLabel = input.label.trim() || normalizedCmd.slice(1);

      const conflict = macros.find(
        (m) => m.cmd.toLowerCase() === normalizedCmd.toLowerCase() && m.id !== input.id
      );
      if (conflict) {
        throw new Error(`O atalho ${normalizedCmd} já existe. Escolha outro ou edite o existente.`);
      }

      const now = Date.now();
      let nextList: SlashMacro[];
      if (input.id) {
        nextList = macros.map((m) =>
          m.id === input.id
            ? {
                ...m,
                cmd: normalizedCmd,
                label: trimmedLabel,
                text: trimmedText,
                updatedAt: now,
              }
            : m
        );
      } else {
        const newMacro: SlashMacro = {
          id: `custom-${now}-${Math.random().toString(36).slice(2, 7)}`,
          cmd: normalizedCmd,
          label: trimmedLabel,
          text: trimmedText,
          isDefault: false,
          updatedAt: now,
        };
        nextList = [newMacro, ...macros];
      }

      await persistMacros(nextList);
    },
    [macros, persistMacros]
  );

  const deleteMacro = useCallback(
    async (id: string) => {
      const nextList = macros.filter((m) => m.id !== id);
      await persistMacros(nextList);
    },
    [macros, persistMacros]
  );

  const restoreDefaultMacros = useCallback(async () => {
    const existingCmds = new Set(macros.map((m) => m.cmd.toLowerCase()));
    const missingDefaults = DEFAULT_SLASH_MACROS.filter(
      (def) => !existingCmds.has(def.cmd.toLowerCase())
    );
    if (missingDefaults.length === 0) return 0;
    await persistMacros([...macros, ...missingDefaults]);
    return missingDefaults.length;
  }, [macros, persistMacros]);

  return {
    macros,
    saving,
    upsertMacro,
    deleteMacro,
    restoreDefaultMacros,
  };
}
