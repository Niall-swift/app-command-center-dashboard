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

/**
 * Retorna a data atual no fuso local em formato YYYY-MM-DD (evita virada prematura de UTC à noite).
 */
export function getTodayLocalIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calcula a diferença em dias inteiros entre duas datas ISO (newerIso - olderIso).
 */
export function diffDaysIso(olderIso: string, newerIso: string): number {
  const [y1, m1, d1] = olderIso.slice(0, 10).split('-').map(Number);
  const [y2, m2, d2] = newerIso.slice(0, 10).split('-').map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.max(0, Math.round((t2 - t1) / 86400000));
}

export function normalizeDueDayKey(rawDay?: string | number | null): string {
  const num = parseInt(String(rawDay ?? '').trim(), 10);
  if (isNaN(num) || num < 1 || num > 31) return 'NA';
  return String(num).padStart(2, '0');
}

export function formatDueDayLabel(dueDayKey: string): string {
  if (!dueDayKey || dueDayKey === 'NA') return 'Sem dia fixo';
  return `Dia ${dueDayKey}`;
}

function formatBrDate(isoDate: string): string {
  const parts = isoDate.slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function isEmptyDate(value?: string | null): boolean {
  if (!value) return true;
  const trimmed = String(value).trim();
  return !trimmed || trimmed === '0000-00-00' || trimmed.startsWith('0000-00-00');
}

/**
 * Agrega clientes em atraso por Dia de Vencimento do Contrato e por Data Exata da Fatura.
 */
export function buildOverdueAnalytics(params: {
  cobrancas: ISPFYFaturaData[];
  contratos: ISPFYContratoData[];
  clientes?: ISPFYClienteData[];
  regionRecords?: ISPFYClientRegionRecord[];
  todayIso?: string;
}): ISPFYOverdueAnalyticsResult {
  const todayIso = params.todayIso || getTodayLocalIsoDate();

  const contratoById = new Map<string, ISPFYContratoData>();
  const baseAtivaByDueDay = new Map<string, Set<string>>();
  const activeClientsSet = new Set<string>();

  for (const ct of params.contratos) {
    if (!ct?.id) continue;
    contratoById.set(String(ct.id), ct);

    const isActive = String(ct.contrato_ativo ?? 's').toLowerCase() !== 'n';
    if (isActive) {
      const clienteId = String(ct.id_cliente || ct.id);
      activeClientsSet.add(clienteId);
      const dueDayKey = normalizeDueDayKey(ct.dia_vencimento);
      const set = baseAtivaByDueDay.get(dueDayKey) || new Set<string>();
      set.add(clienteId);
      baseAtivaByDueDay.set(dueDayKey, set);
    }
  }

  const clienteById = new Map<string, ISPFYClienteData>();
  for (const cli of params.clientes || []) {
    if (cli?.id) clienteById.set(String(cli.id), cli);
  }

  const regionByContrato = new Map<string, ISPFYClientRegionRecord>();
  const regionByCliente = new Map<string, ISPFYClientRegionRecord>();
  for (const rec of params.regionRecords || []) {
    if (rec.contratoId && !regionByContrato.has(rec.contratoId)) {
      regionByContrato.set(rec.contratoId, rec);
    }
    if (rec.clienteId && !regionByCliente.has(rec.clienteId)) {
      regionByCliente.set(rec.clienteId, rec);
    }
  }

  const overdueInvoices = params.cobrancas.filter((fat) => {
    const status = String(fat?.status || '').toLowerCase();
    if (status && status !== 'aberto' && status !== 'a') return false;
    if (!isEmptyDate(fat?.data_pagamento) || !isEmptyDate(fat?.pagamento_data)) return false;
    if (!isEmptyDate(fat?.data_exclusao)) return false;
    const dueIso = String(fat?.data_vencimento || '').slice(0, 10);
    return dueIso.length === 10 && dueIso < todayIso;
  });

  // Agrupa por cliente/contrato único para listar e contabilizar sem duplicar cliente no mesmo vencimento
  const clientAggMap = new Map<string, ISPFYOverdueClientItem>();
  const dueDayMap = new Map<
    string,
    {
      allClients: Set<string>;
      liberados: Set<string>;
      bloqueados: Set<string>;
      faturas: number;
      valor: number;
    }
  >();
  const exactDateMap = new Map<
    string,
    {
      allClients: Set<string>;
      liberados: Set<string>;
      bloqueados: Set<string>;
      faturas: number;
      valor: number;
    }
  >();

  const globalOverdueClients = new Set<string>();
  const globalBlockedOverdue = new Set<string>();
  const globalLiberatedOverdue = new Set<string>();
  let totalFaturasEmAtraso = 0;
  let valorTotalAtraso = 0;

  for (const fat of overdueInvoices) {
    const contratoId = String(fat.id_contrato || '');
    const contrato = contratoById.get(contratoId);

    // Mantém consistência com clientes/contratos ativos (ignora boletos residuais de contratos já cancelados)
    if (contrato && String(contrato.contrato_ativo ?? 's').toLowerCase() === 'n') {
      continue;
    }

    const clienteId = String(contrato?.id_cliente || fat.id_cliente || contratoId || fat.id || '');
    if (!clienteId) continue;

    const regionRec =
      regionByContrato.get(contratoId) || regionByCliente.get(clienteId);
    const clienteObj = clienteById.get(clienteId);

    const dueIso = String(fat.data_vencimento || '').slice(0, 10);
    const diaVencimento = normalizeDueDayKey(
      contrato?.dia_vencimento || dueIso.split('-')[2]
    );
    const diaVencimentoLabel = formatDueDayLabel(diaVencimento);

    const isBlocked =
      regionRec?.isBlocked ??
      String(contrato?.status_contrato || '').toLowerCase() === 'bloqueado';

    const valor = parseFloat(String(fat.valor || '0')) || 0;
    const daysOverdue = diffDaysIso(dueIso, todayIso);

    totalFaturasEmAtraso += 1;
    valorTotalAtraso += valor;
    globalOverdueClients.add(clienteId);
    if (isBlocked) {
      globalBlockedOverdue.add(clienteId);
    } else {
      globalLiberatedOverdue.add(clienteId);
    }

    // Por Dia de Vencimento
    let dayBucket = dueDayMap.get(diaVencimento);
    if (!dayBucket) {
      dayBucket = {
        allClients: new Set(),
        liberados: new Set(),
        bloqueados: new Set(),
        faturas: 0,
        valor: 0,
      };
      dueDayMap.set(diaVencimento, dayBucket);
    }
    dayBucket.allClients.add(clienteId);
    if (isBlocked) {
      dayBucket.bloqueados.add(clienteId);
    } else {
      dayBucket.liberados.add(clienteId);
    }
    dayBucket.faturas += 1;
    dayBucket.valor += valor;

    // Por Data Exata do Vencimento
    let dateBucket = exactDateMap.get(dueIso);
    if (!dateBucket) {
      dateBucket = {
        allClients: new Set(),
        liberados: new Set(),
        bloqueados: new Set(),
        faturas: 0,
        valor: 0,
      };
      exactDateMap.set(dueIso, dateBucket);
    }
    dateBucket.allClients.add(clienteId);
    if (isBlocked) {
      dateBucket.bloqueados.add(clienteId);
    } else {
      dateBucket.liberados.add(clienteId);
    }
    dateBucket.faturas += 1;
    dateBucket.valor += valor;

    // Item individual por cliente + dia de vencimento
    const clientKey = `${clienteId}::${diaVencimento}`;
    const existingItem = clientAggMap.get(clientKey);
    if (!existingItem) {
      clientAggMap.set(clientKey, {
        clienteId,
        contratoId,
        nome:
          regionRec?.nome ||
          String(
            clienteObj?.nome_razao ||
              clienteObj?.nome ||
              clienteObj?.razao ||
              `Cliente #${clienteId}`
          ).trim(),
        telefone: regionRec?.telefone || String(clienteObj?.whatsapp || clienteObj?.celular || ''),
        bairro: regionRec?.bairroLabel || '',
        rua: regionRec?.ruaLabel || '',
        diaVencimento,
        diaVencimentoLabel,
        isBlocked,
        connectionHealth: regionRec?.connectionHealth || (isBlocked ? 'bloqueado_offline' : 'ok'),
        faturasEmAtraso: 1,
        valorTotalAtraso: valor,
        vencimentoMaisAntigo: dueIso,
        vencimentoMaisRecente: dueIso,
        diasMaxAtraso: daysOverdue,
      });
    } else {
      existingItem.faturasEmAtraso += 1;
      existingItem.valorTotalAtraso =
        Math.round((existingItem.valorTotalAtraso + valor) * 100) / 100;
      if (dueIso < existingItem.vencimentoMaisAntigo) {
        existingItem.vencimentoMaisAntigo = dueIso;
      }
      if (dueIso > existingItem.vencimentoMaisRecente) {
        existingItem.vencimentoMaisRecente = dueIso;
      }
      if (daysOverdue > existingItem.diasMaxAtraso) {
        existingItem.diasMaxAtraso = daysOverdue;
      }
      if (isBlocked) existingItem.isBlocked = true;
    }
  }

  // Garante presença de todos os dias de vencimento encontrados na base ativa ou em atraso
  const allDueDays = new Set<string>([
    ...baseAtivaByDueDay.keys(),
    ...dueDayMap.keys(),
  ]);

  const porDiaVencimento: ISPFYOverdueDueDayGroup[] = Array.from(allDueDays)
    .sort((a, b) => {
      if (a === 'NA') return 1;
      if (b === 'NA') return -1;
      return a.localeCompare(b);
    })
    .map((dia) => {
      const totalBaseAtiva = baseAtivaByDueDay.get(dia)?.size || 0;
      const bucket = dueDayMap.get(dia);
      const clientesEmAtraso = bucket?.allClients.size || 0;
      const clientesAtrasoBloqueados = bucket?.bloqueados.size || 0;
      // Cliente bloqueado prevalece caso tenha múltiplos contratos no mesmo dia
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
        label: formatDueDayLabel(dia),
        totalBaseAtiva,
        clientesEmAtraso,
        clientesAtrasoLiberados,
        clientesAtrasoBloqueados,
        faturasEmAtraso: bucket?.faturas || 0,
        valorTotalAtraso: Math.round((bucket?.valor || 0) * 100) / 100,
        taxaInadimplencia,
      };
    });

  const porDataVencimento: ISPFYOverdueExactDateGroup[] = Array.from(
    exactDateMap.entries()
  )
    .sort(([dA], [dB]) => dB.localeCompare(dA))
    .slice(0, 14)
    .reverse()
    .map(([dataVencimento, bucket]) => {
      const clientesEmAtraso = bucket.allClients.size;
      const clientesAtrasoBloqueados = bucket.bloqueados.size;
      return {
        dataVencimento,
        label: formatBrDate(dataVencimento),
        clientesEmAtraso,
        clientesAtrasoLiberados: Math.max(
          0,
          clientesEmAtraso - clientesAtrasoBloqueados
        ),
        clientesAtrasoBloqueados,
        faturasEmAtraso: bucket.faturas,
        valorTotalAtraso: Math.round(bucket.valor * 100) / 100,
      };
    });

  const clientes = Array.from(clientAggMap.values()).sort(
    (a, b) =>
      b.diasMaxAtraso - a.diasMaxAtraso ||
      b.valorTotalAtraso - a.valorTotalAtraso ||
      a.nome.localeCompare(b.nome, 'pt-BR')
  );

  const totalBaseAtiva = activeClientsSet.size;
  const totalClientesEmAtraso = globalOverdueClients.size;
  const totalClientesAtrasoBloqueados = globalBlockedOverdue.size;
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
