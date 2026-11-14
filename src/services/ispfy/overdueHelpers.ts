import type {
  ISPFYClienteData,
  ISPFYClientRegionRecord,
  ISPFYContratoData,
  ISPFYFaturaData,
  ISPFYOverdueAnalyticsResult,
  ISPFYOverdueClientItem,
  ISPFYOverdueDueDayGroup,
  ISPFYOverdueExactDateGroup,
} from '@/types/ispfy';
import { obterDataLocalIso } from '@/utils/date';
import {
  isFaturaEmAberto,
  obterNomeClienteISPFY,
  obterTelefoneClienteISPFY,
} from '@/utils/ispfyFormatters';

interface BaldeAtraso {
  todosClientes: Set<string>;
  liberados: Set<string>;
  bloqueados: Set<string>;
  faturas: number;
  valor: number;
}

/**
 * Calcula a diferença em dias inteiros entre duas datas ISO (dataMaisNova - dataMaisAntiga).
 */
export function calcularDiferencaDiasIso(
  dataMaisAntiga: string,
  dataMaisNova: string
): number {
  const [ano1, mes1, dia1] = dataMaisAntiga.slice(0, 10).split('-').map(Number);
  const [ano2, mes2, dia2] = dataMaisNova.slice(0, 10).split('-').map(Number);
  if (!ano1 || !mes1 || !dia1 || !ano2 || !mes2 || !dia2) return 0;
  const tempo1 = Date.UTC(ano1, mes1 - 1, dia1);
  const tempo2 = Date.UTC(ano2, mes2 - 1, dia2);
  return Math.max(0, Math.round((tempo2 - tempo1) / 86400000));
}

export function normalizarChaveDiaVencimento(diaBruto?: string | number | null): string {
  const numero = parseInt(String(diaBruto ?? '').trim(), 10);
  if (isNaN(numero) || numero < 1 || numero > 31) return 'NA';
  return String(numero).padStart(2, '0');
}

export function formatarRotuloDiaVencimento(chaveDia: string): string {
  if (!chaveDia || chaveDia === 'NA') return 'Sem dia fixo';
  return `Dia ${chaveDia}`;
}

function formatarDataBr(dataIso: string): string {
  const partes = dataIso.slice(0, 10).split('-');
  if (partes.length !== 3) return dataIso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function acumularNoBaldeAtraso(
  mapa: Map<string, BaldeAtraso>,
  chave: string,
  clienteId: string,
  bloqueado: boolean,
  valor: number
): void {
  let balde = mapa.get(chave);
  if (!balde) {
    balde = {
      todosClientes: new Set(),
      liberados: new Set(),
      bloqueados: new Set(),
      faturas: 0,
      valor: 0,
    };
    mapa.set(chave, balde);
  }
  balde.todosClientes.add(clienteId);
  if (bloqueado) {
    balde.bloqueados.add(clienteId);
  } else {
    balde.liberados.add(clienteId);
  }
  balde.faturas += 1;
  balde.valor += valor;
}

/**
 * Agrega clientes em atraso por Dia de Vencimento do Contrato e por Data Exata da Fatura.
 */
export function calcularAnaliseInadimplencia(params: {
  cobrancas: ISPFYFaturaData[];
  contratos: ISPFYContratoData[];
  clientes?: ISPFYClienteData[];
  registrosRegiao?: ISPFYClientRegionRecord[];
  dataHojeIso?: string;
}): ISPFYOverdueAnalyticsResult {
  const dataHojeIso = params.dataHojeIso || obterDataLocalIso();

  const contratosPorId = new Map<string, ISPFYContratoData>();
  const baseAtivaPorDia = new Map<string, Set<string>>();
  const clientesAtivosSet = new Set<string>();

  for (const contrato of params.contratos) {
    if (!contrato?.id) continue;
    contratosPorId.set(String(contrato.id), contrato);

    const ativo = String(contrato.contrato_ativo ?? 's').toLowerCase() !== 'n';
    if (ativo) {
      const clienteId = String(contrato.id_cliente || contrato.id);
      clientesAtivosSet.add(clienteId);
      const chaveDia = normalizarChaveDiaVencimento(contrato.dia_vencimento);
      const conjunto = baseAtivaPorDia.get(chaveDia) || new Set<string>();
      conjunto.add(clienteId);
      baseAtivaPorDia.set(chaveDia, conjunto);
    }
  }

  const clientesPorId = new Map<string, ISPFYClienteData>();
  for (const cliente of params.clientes || []) {
    if (cliente?.id) clientesPorId.set(String(cliente.id), cliente);
  }

  const regiaoPorContrato = new Map<string, ISPFYClientRegionRecord>();
  const regiaoPorCliente = new Map<string, ISPFYClientRegionRecord>();
  for (const registro of params.registrosRegiao || []) {
    if (registro.contratoId && !regiaoPorContrato.has(registro.contratoId)) {
      regiaoPorContrato.set(registro.contratoId, registro);
    }
    if (registro.clienteId && !regiaoPorCliente.has(registro.clienteId)) {
      regiaoPorCliente.set(registro.clienteId, registro);
    }
  }

  const faturasVencidas = params.cobrancas.filter((fatura) => {
    if (!isFaturaEmAberto(fatura)) return false;
    const vencimentoIso = String(fatura?.data_vencimento || '').slice(0, 10);
    return vencimentoIso.length === 10 && vencimentoIso < dataHojeIso;
  });

  // Agrupa por cliente + dia de vencimento para não duplicar o mesmo cliente no placar
  const clientesAgregadosMap = new Map<string, ISPFYOverdueClientItem>();
  const atrasoPorDiaMap = new Map<string, BaldeAtraso>();
  const atrasoPorDataMap = new Map<string, BaldeAtraso>();

  const clientesEmAtrasoSet = new Set<string>();
  const clientesAtrasoBloqueadosSet = new Set<string>();
  let totalFaturasEmAtraso = 0;
  let valorTotalAtraso = 0;

  for (const fatura of faturasVencidas) {
    const contratoId = String(fatura.id_contrato || '');
    const contrato = contratosPorId.get(contratoId);

    // Ignora boletos residuais de contratos já cancelados
    if (contrato && String(contrato.contrato_ativo ?? 's').toLowerCase() === 'n') {
      continue;
    }

    const clienteId = String(
      contrato?.id_cliente || fatura.id_cliente || contratoId || fatura.id || ''
    );
    if (!clienteId) continue;

    const registroRegiao =
      regiaoPorContrato.get(contratoId) || regiaoPorCliente.get(clienteId);
    const clienteObj = clientesPorId.get(clienteId);

    const vencimentoIso = String(fatura.data_vencimento || '').slice(0, 10);
    const diaVencimento = normalizarChaveDiaVencimento(
      contrato?.dia_vencimento || vencimentoIso.split('-')[2]
    );
    const diaVencimentoLabel = formatarRotuloDiaVencimento(diaVencimento);

    const bloqueado =
      registroRegiao?.isBlocked ??
      String(contrato?.status_contrato || '').toLowerCase() === 'bloqueado';

    const valor = parseFloat(String(fatura.valor || '0')) || 0;
    const diasAtraso = calcularDiferencaDiasIso(vencimentoIso, dataHojeIso);

    totalFaturasEmAtraso += 1;
    valorTotalAtraso += valor;
    clientesEmAtrasoSet.add(clienteId);
    if (bloqueado) {
      clientesAtrasoBloqueadosSet.add(clienteId);
    }

    acumularNoBaldeAtraso(atrasoPorDiaMap, diaVencimento, clienteId, bloqueado, valor);
    acumularNoBaldeAtraso(atrasoPorDataMap, vencimentoIso, clienteId, bloqueado, valor);

    const chaveCliente = `${clienteId}::${diaVencimento}`;
    const itemExistente = clientesAgregadosMap.get(chaveCliente);

    if (!itemExistente) {
      clientesAgregadosMap.set(chaveCliente, {
        clienteId,
        contratoId,
        nome:
          registroRegiao?.nome ||
          obterNomeClienteISPFY(clienteObj, `Cliente #${clienteId}`),
        telefone:
          registroRegiao?.telefone || obterTelefoneClienteISPFY(clienteObj, ''),
        bairro: registroRegiao?.bairroLabel || '',
        rua: registroRegiao?.ruaLabel || '',
        diaVencimento,
        diaVencimentoLabel,
        isBlocked: bloqueado,
        connectionHealth:
          registroRegiao?.connectionHealth || (bloqueado ? 'bloqueado_offline' : 'ok'),
        faturasEmAtraso: 1,
        valorTotalAtraso: valor,
        vencimentoMaisAntigo: vencimentoIso,
        vencimentoMaisRecente: vencimentoIso,
        diasMaxAtraso: diasAtraso,
      });
    } else {
      itemExistente.faturasEmAtraso += 1;
      itemExistente.valorTotalAtraso =
        Math.round((itemExistente.valorTotalAtraso + valor) * 100) / 100;
      if (vencimentoIso < itemExistente.vencimentoMaisAntigo) {
        itemExistente.vencimentoMaisAntigo = vencimentoIso;
      }
      if (vencimentoIso > itemExistente.vencimentoMaisRecente) {
        itemExistente.vencimentoMaisRecente = vencimentoIso;
      }
      if (diasAtraso > itemExistente.diasMaxAtraso) {
        itemExistente.diasMaxAtraso = diasAtraso;
      }
      if (bloqueado) itemExistente.isBlocked = true;
    }
  }

  const todosDiasVencimento = new Set<string>([
    ...baseAtivaPorDia.keys(),
    ...atrasoPorDiaMap.keys(),
  ]);

  const porDiaVencimento: ISPFYOverdueDueDayGroup[] = Array.from(todosDiasVencimento)
    .sort((a, b) => {
      if (a === 'NA') return 1;
      if (b === 'NA') return -1;
      return a.localeCompare(b);
    })
    .map((dia) => {
      const totalBaseAtiva = baseAtivaPorDia.get(dia)?.size || 0;
      const balde = atrasoPorDiaMap.get(dia);
      const clientesEmAtraso = balde?.todosClientes.size || 0;
      const clientesAtrasoBloqueados = balde?.bloqueados.size || 0;
      // Cliente bloqueado prevalece caso possua múltiplos contratos no mesmo vencimento
      const clientesAtrasoLiberados = Math.max(
        0,
        clientesEmAtraso - clientesAtrasoBloqueados
      );
      const taxaInadimplencia =
        totalBaseAtiva > 0
          ? Math.round((clientesEmAtraso / totalBaseAtiva) * 1000) / 10
          : 0;

      return {
        diaVencimento: dia,
        label: formatarRotuloDiaVencimento(dia),
        totalBaseAtiva,
        clientesEmAtraso,
        clientesAtrasoLiberados,
        clientesAtrasoBloqueados,
        faturasEmAtraso: balde?.faturas || 0,
        valorTotalAtraso: Math.round((balde?.valor || 0) * 100) / 100,
        taxaInadimplencia,
      };
    });

  const porDataVencimento: ISPFYOverdueExactDateGroup[] = Array.from(
    atrasoPorDataMap.entries()
  )
    .sort(([dataA], [dataB]) => dataB.localeCompare(dataA))
    .slice(0, 14)
    .reverse()
    .map(([dataVencimento, balde]) => {
      const clientesEmAtraso = balde.todosClientes.size;
      const clientesAtrasoBloqueados = balde.bloqueados.size;
      return {
        dataVencimento,
        label: formatarDataBr(dataVencimento),
        clientesEmAtraso,
        clientesAtrasoLiberados: Math.max(
          0,
          clientesEmAtraso - clientesAtrasoBloqueados
        ),
        clientesAtrasoBloqueados,
        faturasEmAtraso: balde.faturas,
        valorTotalAtraso: Math.round(balde.valor * 100) / 100,
      };
    });

  const clientes = Array.from(clientesAgregadosMap.values()).sort(
    (a, b) =>
      b.diasMaxAtraso - a.diasMaxAtraso ||
      b.valorTotalAtraso - a.valorTotalAtraso ||
      a.nome.localeCompare(b.nome, 'pt-BR')
  );

  const totalBaseAtiva = clientesAtivosSet.size;
  const totalClientesEmAtraso = clientesEmAtrasoSet.size;
  const totalClientesAtrasoBloqueados = clientesAtrasoBloqueadosSet.size;
  const totalClientesAtrasoLiberados = Math.max(
    0,
    totalClientesEmAtraso - totalClientesAtrasoBloqueados
  );
  const taxaGeralInadimplencia =
    totalBaseAtiva > 0
      ? Math.round((totalClientesEmAtraso / totalBaseAtiva) * 1000) / 10
      : 0;

  return {
    fetchedAt: new Date().toISOString(),
    totalClientesEmAtraso,
    totalClientesAtrasoLiberados,
    totalClientesAtrasoBloqueados,
    totalFaturasEmAtraso,
    valorTotalAtraso: Math.round(valorTotalAtraso * 100) / 100,
    totalBaseAtiva,
    taxaGeralInadimplencia,
    porDiaVencimento,
    porDataVencimento,
    clientes,
  };
}
