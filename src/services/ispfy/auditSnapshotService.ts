import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { ISPFYAuditDeletedRecord, ISPFYClienteData } from '@/types/ispfy';

const SNAPSHOT_COLLECTION = 'ispfy_audit_snapshots';
const CATALOG_DOC_ID = 'clients_catalog';
const DELETED_DOC_ID = 'deleted_history';
const LOCAL_CATALOG_KEY = 'ispfy_audit_global_catalog_v1';
const LOCAL_DELETED_KEY = 'ispfy_audit_global_deleted_v1';
const MAX_FIRESTORE_CATALOG_ENTRIES = 4500;
const MAX_DELETED_HISTORY = 500;

interface CompactClientEntry {
  nome_razao: string;
  cpf_cnpj: string;
  data_cadastro: string;
  usuario_cadastrou: string;
  bairro: string;
}

interface SnapshotSyncResult {
  deletedRecords: ISPFYAuditDeletedRecord[];
  cloudActive: boolean;
  updatedAt?: string;
}

function getBrazilTimestamp(): string {
  try {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());
    return parts.replace('T', ' ');
  } catch {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }
}

function toCompactMap(clients: ISPFYClienteData[]): Record<string, CompactClientEntry> {
  const map: Record<string, CompactClientEntry> = {};
  for (const c of clients) {
    if (!c.id) continue;
    map[String(c.id)] = {
      nome_razao: String(c.nome_razao || c.nome || '').trim(),
      cpf_cnpj: String(c.cpf_cnpj || c.cnpj_cpf || '').trim(),
      data_cadastro: String(c.data_cadastro || '').trim(),
      usuario_cadastrou: String(c.usuario_cadastrou || '').trim(),
      bairro: String(c.endereco_cobranca_bairro || c.bairro || '').trim(),
    };
  }
  return map;
}

function trimCatalogForFirestore(
  map: Record<string, CompactClientEntry>
): Record<string, CompactClientEntry> {
  const keys = Object.keys(map);
  if (keys.length <= MAX_FIRESTORE_CATALOG_ENTRIES) return map;

  const recentKeys = keys
    .sort((a, b) => Number(a) - Number(b))
    .slice(-MAX_FIRESTORE_CATALOG_ENTRIES);
  const trimmed: Record<string, CompactClientEntry> = {};
  for (const k of recentKeys) {
    trimmed[k] = map[k];
  }
  return trimmed;
}

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota excedida ou modo privado
  }
}

function findNearestNeighbors(
  missingId: number,
  sortedNumericIds: number[],
  currentMap: Record<string, CompactClientEntry>
): Pick<ISPFYAuditDeletedRecord, 'referencia_anterior' | 'referencia_posterior'> {
  let prevId: number | undefined;
  let nextId: number | undefined;

  for (let i = sortedNumericIds.length - 1; i >= 0; i--) {
    if (sortedNumericIds[i] < missingId) {
      prevId = sortedNumericIds[i];
      break;
    }
  }
  for (let i = 0; i < sortedNumericIds.length; i++) {
    if (sortedNumericIds[i] > missingId) {
      nextId = sortedNumericIds[i];
      break;
    }
  }

  return {
    referencia_anterior: prevId
      ? {
          id: String(prevId),
          nome: currentMap[String(prevId)]?.nome_razao || `ID #${prevId}`,
          data_cadastro: currentMap[String(prevId)]?.data_cadastro,
        }
      : undefined,
    referencia_posterior: nextId
      ? {
          id: String(nextId),
          nome: currentMap[String(nextId)]?.nome_razao || `ID #${nextId}`,
          data_cadastro: currentMap[String(nextId)]?.data_cadastro,
        }
      : undefined,
  };
}

/**
 * Sincroniza o catálogo global de clientes do ISPFY no Firestore (com fallback localStorage)
 * e registra qualquer cliente que existia anteriormente e foi excluído da base.
 */
export async function syncAndDetectDeletedClients(
  currentClients: ISPFYClienteData[]
): Promise<SnapshotSyncResult> {
  if (currentClients.length === 0) {
    return { deletedRecords: [], cloudActive: false };
  }

  const currentMap = toCompactMap(currentClients);
  const currentIds = Object.keys(currentMap);
  const sortedNumericIds = currentIds
    .map((id) => parseInt(id, 10))
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);

  let cloudActive = false;
  let updatedAt: string | undefined;
  let previousCatalog: Record<string, CompactClientEntry> = readLocalJson(LOCAL_CATALOG_KEY, {});
  let existingDeleted: ISPFYAuditDeletedRecord[] = readLocalJson(LOCAL_DELETED_KEY, []);

  try {
    const [catalogSnap, deletedSnap] = await Promise.all([
      getDoc(doc(db, SNAPSHOT_COLLECTION, CATALOG_DOC_ID)),
      getDoc(doc(db, SNAPSHOT_COLLECTION, DELETED_DOC_ID)),
    ]);

    cloudActive = true;
    if (catalogSnap.exists()) {
      const data = catalogSnap.data();
      if (data?.clients && typeof data.clients === 'object') {
        previousCatalog = data.clients as Record<string, CompactClientEntry>;
      }
      if (data?.updatedAt) updatedAt = String(data.updatedAt);
    }

    if (deletedSnap.exists()) {
      const data = deletedSnap.data();
      if (Array.isArray(data?.records)) {
        const merged = new Map<string, ISPFYAuditDeletedRecord>();
        for (const rec of existingDeleted) merged.set(rec.id, rec);
        for (const rec of data.records as ISPFYAuditDeletedRecord[]) merged.set(rec.id, rec);
        existingDeleted = Array.from(merged.values());
      }
    }
  } catch (err) {
    console.warn('[auditSnapshot] Leitura do snapshot em nuvem indisponível, usando cache local:', err);
  }

  const nowTs = getBrazilTimestamp();
  const minCatalogId = sortedNumericIds[0] ?? 0;
  const newlyDeleted: ISPFYAuditDeletedRecord[] = [];
  const deletedById = new Map<string, ISPFYAuditDeletedRecord>(
    existingDeleted.map((r) => [String(r.id), r])
  );

  for (const [id, prev] of Object.entries(previousCatalog)) {
    const numId = parseInt(id, 10);
    // Ignora IDs fora da janela se o snapshot estava podado, ou detecta ausência real
    if (!isNaN(numId) && numId < minCatalogId) continue;
    if (currentMap[id]) {
      // Caso raríssimo de reaparecimento: remove do log se voltou a existir
      deletedById.delete(id);
      continue;
    }

    if (!deletedById.has(id)) {
      const neighbors = !isNaN(numId)
        ? findNearestNeighbors(numId, sortedNumericIds, currentMap)
        : {};
      const record: ISPFYAuditDeletedRecord = {
        id,
        tipo: 'snapshot_removido',
        nome: prev.nome_razao || 'Cadastro Excluído',
        cpf_cnpj: prev.cpf_cnpj || '',
        usuario_cadastrou: prev.usuario_cadastrou || '',
        bairro: prev.bairro || '',
        provavel_data: prev.data_cadastro || nowTs,
        detectado_em: nowTs,
        ...neighbors,
        motivo: `Registro cadastrado em ${prev.data_cadastro || 'data desconhecida'} (${prev.usuario_cadastrou || 'operador'}) foi excluído do banco de dados do ISPFY.`,
      };
      deletedById.set(id, record);
      newlyDeleted.push(record);
    }
  }

  const mergedDeleted = Array.from(deletedById.values())
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, MAX_DELETED_HISTORY);

  const prevCount = Object.keys(previousCatalog).length;
  const needsCatalogSave =
    newlyDeleted.length > 0 ||
    prevCount !== currentIds.length ||
    currentIds.some((id) => !previousCatalog[id]);

  if (needsCatalogSave) {
    updatedAt = nowTs;
    writeLocalJson(LOCAL_CATALOG_KEY, currentMap);
    writeLocalJson(LOCAL_DELETED_KEY, mergedDeleted);

    try {
      const writes: Promise<void>[] = [
        setDoc(doc(db, SNAPSHOT_COLLECTION, CATALOG_DOC_ID), {
          updatedAt: nowTs,
          count: currentIds.length,
          clients: trimCatalogForFirestore(currentMap),
        }),
      ];
      if (newlyDeleted.length > 0 || existingDeleted.length !== mergedDeleted.length) {
        writes.push(
          setDoc(doc(db, SNAPSHOT_COLLECTION, DELETED_DOC_ID), {
            updatedAt: nowTs,
            records: mergedDeleted,
          })
        );
      }
      await Promise.all(writes);
      cloudActive = true;
    } catch (err) {
      console.warn('[auditSnapshot] Não foi possível gravar snapshot na nuvem:', err);
    }
  } else {
    writeLocalJson(LOCAL_CATALOG_KEY, currentMap);
  }

  return {
    deletedRecords: mergedDeleted,
    cloudActive,
    updatedAt: updatedAt || nowTs,
  };
}
