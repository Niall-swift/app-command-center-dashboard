import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { ISPFYAuditDeletedRecord, ISPFYClienteData } from '@/types/ispfy';
import { obterTimestampBrasil } from '@/utils/date';
import { obterNomeClienteISPFY } from '@/utils/ispfyFormatters';

const COLECAO_SNAPSHOTS = 'ispfy_audit_snapshots';
const DOC_CATALOGO = 'clients_catalog';
const DOC_EXCLUIDOS = 'deleted_history';
const CHAVE_LOCAL_CATALOGO = 'ispfy_audit_global_catalog_v1';
const CHAVE_LOCAL_EXCLUIDOS = 'ispfy_audit_global_deleted_v1';
const LIMITE_CATALOGO_FIRESTORE = 4500;
const LIMITE_HISTORICO_EXCLUIDOS = 500;

interface EntradaCatalogoCompacta {
  nome_razao: string;
  cpf_cnpj: string;
  data_cadastro: string;
  usuario_cadastrou: string;
  bairro: string;
}

export interface ResultadoSincronizacaoSnapshot {
  registrosExcluidos: ISPFYAuditDeletedRecord[];
  nuvemAtiva: boolean;
  atualizadoEm?: string;
}

function converterParaMapaCatalogo(
  clientes: ISPFYClienteData[]
): Record<string, EntradaCatalogoCompacta> {
  const mapa: Record<string, EntradaCatalogoCompacta> = {};
  for (const cliente of clientes) {
    if (!cliente.id) continue;
    mapa[String(cliente.id)] = {
      nome_razao: obterNomeClienteISPFY(cliente, ''),
      cpf_cnpj: String(cliente.cpf_cnpj || cliente.cnpj_cpf || '').trim(),
      data_cadastro: String(cliente.data_cadastro || '').trim(),
      usuario_cadastrou: String(cliente.usuario_cadastrou || '').trim(),
      bairro: String(cliente.endereco_cobranca_bairro || cliente.bairro || '').trim(),
    };
  }
  return mapa;
}

function podarCatalogoFirestore(
  mapa: Record<string, EntradaCatalogoCompacta>
): Record<string, EntradaCatalogoCompacta> {
  const chaves = Object.keys(mapa);
  if (chaves.length <= LIMITE_CATALOGO_FIRESTORE) return mapa;

  const chavesRecentes = chaves
    .sort((a, b) => Number(a) - Number(b))
    .slice(-LIMITE_CATALOGO_FIRESTORE);
  const podado: Record<string, EntradaCatalogoCompacta> = {};
  for (const chave of chavesRecentes) {
    podado[chave] = mapa[chave];
  }
  return podado;
}

function lerJsonLocal<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravarJsonLocal(chave: string, valor: unknown): void {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Quota excedida ou modo privado no navegador
  }
}

function buscarVizinhosProximos(
  idAusente: number,
  idsOrdenados: number[],
  mapaAtual: Record<string, EntradaCatalogoCompacta>
): Pick<ISPFYAuditDeletedRecord, 'referencia_anterior' | 'referencia_posterior'> {
  let idAnterior: number | undefined;
  let idPosterior: number | undefined;

  for (let i = idsOrdenados.length - 1; i >= 0; i--) {
    if (idsOrdenados[i] < idAusente) {
      idAnterior = idsOrdenados[i];
      break;
    }
  }
  for (let i = 0; i < idsOrdenados.length; i++) {
    if (idsOrdenados[i] > idAusente) {
      idPosterior = idsOrdenados[i];
      break;
    }
  }

  return {
    referencia_anterior: idAnterior
      ? {
          id: String(idAnterior),
          nome: mapaAtual[String(idAnterior)]?.nome_razao || `ID #${idAnterior}`,
          data_cadastro: mapaAtual[String(idAnterior)]?.data_cadastro,
        }
      : undefined,
    referencia_posterior: idPosterior
      ? {
          id: String(idPosterior),
          nome: mapaAtual[String(idPosterior)]?.nome_razao || `ID #${idPosterior}`,
          data_cadastro: mapaAtual[String(idPosterior)]?.data_cadastro,
        }
      : undefined,
  };
}

/**
 * Sincroniza o catálogo global de clientes do ISPFY no Firestore (com fallback localStorage)
 * e registra qualquer cliente que existia anteriormente e foi excluído da base.
 */
export async function sincronizarEDetectarExcluidos(
  clientesAtuais: ISPFYClienteData[]
): Promise<ResultadoSincronizacaoSnapshot> {
  if (clientesAtuais.length === 0) {
    return { registrosExcluidos: [], nuvemAtiva: false };
  }

  const mapaAtual = converterParaMapaCatalogo(clientesAtuais);
  const idsAtuais = Object.keys(mapaAtual);
  const idsOrdenados = idsAtuais
    .map((id) => parseInt(id, 10))
    .filter((numero) => !isNaN(numero))
    .sort((a, b) => a - b);

  let nuvemAtiva = false;
  let atualizadoEm: string | undefined;
  let catalogoAnterior: Record<string, EntradaCatalogoCompacta> = lerJsonLocal(
    CHAVE_LOCAL_CATALOGO,
    {}
  );
  let excluidosExistentes: ISPFYAuditDeletedRecord[] = lerJsonLocal(
    CHAVE_LOCAL_EXCLUIDOS,
    []
  );

  try {
    const [snapCatalogo, snapExcluidos] = await Promise.all([
      getDoc(doc(db, COLECAO_SNAPSHOTS, DOC_CATALOGO)),
      getDoc(doc(db, COLECAO_SNAPSHOTS, DOC_EXCLUIDOS)),
    ]);

    nuvemAtiva = true;
    if (snapCatalogo.exists()) {
      const dados = snapCatalogo.data();
      if (dados?.clients && typeof dados.clients === 'object') {
        catalogoAnterior = dados.clients as Record<string, EntradaCatalogoCompacta>;
      }
      if (dados?.updatedAt) atualizadoEm = String(dados.updatedAt);
    }

    if (snapExcluidos.exists()) {
      const dados = snapExcluidos.data();
      if (Array.isArray(dados?.records)) {
        const mesclados = new Map<string, ISPFYAuditDeletedRecord>();
        for (const registro of excluidosExistentes) mesclados.set(registro.id, registro);
        for (const registro of dados.records as ISPFYAuditDeletedRecord[]) {
          mesclados.set(registro.id, registro);
        }
        excluidosExistentes = Array.from(mesclados.values());
      }
    }
  } catch (erro) {
    console.warn('[auditSnapshot] Leitura do snapshot em nuvem indisponível, usando cache local:', erro);
  }

  const timestampAtual = obterTimestampBrasil();
  const menorIdBase = idsOrdenados[0] ?? 0;
  const novosExcluidos: ISPFYAuditDeletedRecord[] = [];
  const mapaExcluidosPorId = new Map<string, ISPFYAuditDeletedRecord>(
    excluidosExistentes.map((registro) => [String(registro.id), registro])
  );

  for (const [id, anterior] of Object.entries(catalogoAnterior)) {
    const idNumerico = parseInt(id, 10);
    if (!isNaN(idNumerico) && idNumerico < menorIdBase) continue;

    if (mapaAtual[id]) {
      mapaExcluidosPorId.delete(id);
      continue;
    }

    if (!mapaExcluidosPorId.has(id)) {
      const vizinhos = !isNaN(idNumerico)
        ? buscarVizinhosProximos(idNumerico, idsOrdenados, mapaAtual)
        : {};
      const registro: ISPFYAuditDeletedRecord = {
        id,
        tipo: 'snapshot_removido',
        nome: anterior.nome_razao || 'Cadastro Excluído',
        cpf_cnpj: anterior.cpf_cnpj || '',
        usuario_cadastrou: anterior.usuario_cadastrou || '',
        bairro: anterior.bairro || '',
        provavel_data: anterior.data_cadastro || timestampAtual,
        detectado_em: timestampAtual,
        ...vizinhos,
        motivo: `Registro cadastrado em ${anterior.data_cadastro || 'data desconhecida'} (${anterior.usuario_cadastrou || 'operador'}) foi excluído do banco de dados do ISPFY.`,
      };
      mapaExcluidosPorId.set(id, registro);
      novosExcluidos.push(registro);
    }
  }

  const excluidosConsolidados = Array.from(mapaExcluidosPorId.values())
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, LIMITE_HISTORICO_EXCLUIDOS);

  const qtdAnterior = Object.keys(catalogoAnterior).length;
  const precisaSalvarCatalogo =
    novosExcluidos.length > 0 ||
    qtdAnterior !== idsAtuais.length ||
    idsAtuais.some((id) => !catalogoAnterior[id]);

  if (precisaSalvarCatalogo) {
    atualizadoEm = timestampAtual;
    gravarJsonLocal(CHAVE_LOCAL_CATALOGO, mapaAtual);
    gravarJsonLocal(CHAVE_LOCAL_EXCLUIDOS, excluidosConsolidados);

    try {
      const gravacoes: Promise<void>[] = [
        setDoc(doc(db, COLECAO_SNAPSHOTS, DOC_CATALOGO), {
          updatedAt: timestampAtual,
          count: idsAtuais.length,
          clients: podarCatalogoFirestore(mapaAtual),
        }),
      ];
      if (
        novosExcluidos.length > 0 ||
        excluidosExistentes.length !== excluidosConsolidados.length
      ) {
        gravacoes.push(
          setDoc(doc(db, COLECAO_SNAPSHOTS, DOC_EXCLUIDOS), {
            updatedAt: timestampAtual,
            records: excluidosConsolidados,
          })
        );
      }
      await Promise.all(gravacoes);
      nuvemAtiva = true;
    } catch (erro) {
      console.warn('[auditSnapshot] Não foi possível gravar snapshot na nuvem:', erro);
    }
  } else {
    gravarJsonLocal(CHAVE_LOCAL_CATALOGO, mapaAtual);
  }

  return {
    registrosExcluidos: excluidosConsolidados,
    nuvemAtiva,
    atualizadoEm: atualizadoEm || timestampAtual,
  };
}
