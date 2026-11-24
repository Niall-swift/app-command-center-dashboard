import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { verifyAuth } from "./config/auth";
import { getIspfyConfig, getWhapiConfig } from "./config/env";
import { IspfyBackendService, normalizeDigits } from "./ispfyBackendService";
import { WhatsAppService } from "./services/whatsappService";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export interface FinancialReportRecipient {
  id: string;
  name: string;
  phone: string;
  enabled: boolean;
}

export interface FinancialReportsSettings {
  recipients: FinancialReportRecipient[];
  dueDayReportEnabled: boolean;
  dueDays: number[];
  daysAfterDue: number;
  monthlyClosingEnabled: boolean;
  updatedAtMs?: number;
  updatedBy?: string;
}

export interface DueDayReportMetrics {
  yearMonth: string;
  dueDay: number;
  targetDueDateIso: string;
  totalFaturas: number;
  totalClientesUnicos: number;
  pagasCount: number;
  clientesPagosCount: number;
  totalEntrou: number;
  inadimplentesCount: number;
  clientesInadimplentesCount: number;
  clientesBloqueadosCount: number;
  clientesAtrasoLiberadosCount: number;
  totalInadimplente: number;
  totalPrevisto: number;
  taxaAdimplenciaQtd: number;
  taxaAdimplenciaValor: number;
  excluidasCount: number;
}

export interface MonthlyClosingMetrics {
  yearMonth: string;
  periodoLabel: string;
  totalInstalacoes: number;
  contratosAdesaoMes: number;
  pontosAtivadosMes: number;
  novosClientesCadastrados: number;
  totalCancelados: number;
  contratosRescindidosMes: number;
  ticketsRetiradaSemRescisao: number;
  totalExcluidos: number;
  faturasExcluidasMes: number;
  saldoLiquidoBase: number;
  totalBaseAtivaContratos: number;
  totalEntrouMes: number;
  pagamentosMesCount: number;
  totalInadimplenteMes: number;
  faturasInadimplentesMesCount: number;
}

const DEFAULT_DUE_DAYS = [5, 10, 15, 20, 25];

function getSaoPauloDateParts(now = new Date()): {
  iso: string;
  year: number;
  month: number;
  day: number;
  yearMonth: string;
  daysInMonth: number;
  isLastDayOfMonth: boolean;
} {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(now);
  const [yStr, mStr, dStr] = iso.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    iso,
    year,
    month,
    day,
    yearMonth: `${yStr}-${mStr}`,
    daysInMonth,
    isLastDayOfMonth: day === daysInMonth,
  };
}

function getMonthBounds(yearMonth: string): {
  startIso: string;
  endIso: string;
  daysInMonth: number;
  label: string;
} {
  const [yStr, mStr] = yearMonth.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthsPt = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return {
    startIso: `${yStr}-${mStr}-01`,
    endIso: `${yStr}-${mStr}-${String(daysInMonth).padStart(2, "0")}`,
    daysInMonth,
    label: `${monthsPt[(month || 1) - 1] || mStr}/${year}`,
  };
}

function extractDateOnly(raw?: unknown): string {
  if (!raw) return "";
  const str = String(raw).trim().split(" ")[0] || "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split("/");
    return `${y}-${m}-${d}`;
  }
  return "";
}

function parseAmount(raw?: unknown): number {
  const num = parseFloat(String(raw ?? "0").replace(",", "."));
  return Number.isFinite(num) ? num : 0;
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function isInvoiceDeleted(inv: Record<string, unknown>): boolean {
  const st = String(inv.status || "").toLowerCase();
  return (
    st.includes("excl") ||
    st.includes("cancel") ||
    st === "c" ||
    Boolean(inv.data_exclusao)
  );
}

function isInvoicePaid(inv: Record<string, unknown>): boolean {
  const st = String(inv.status || "").toLowerCase();
  return (
    st === "pago" ||
    st === "recebido" ||
    st === "r" ||
    st === "p" ||
    Boolean(inv.data_pagamento) ||
    Boolean(inv.pagamento_data)
  );
}

function isContractBlocked(ct?: Record<string, unknown>): boolean {
  if (!ct) return false;
  const st = String(ct.status_contrato || "").toLowerCase();
  const net = String(ct.status_internet || "").toLowerCase();
  return (
    st.includes("bloq") ||
    st.includes("susp") ||
    net === "fa" ||
    net === "ca" ||
    net === "cm" ||
    net === "ba"
  );
}

async function loadReportSettings(): Promise<FinancialReportsSettings> {
  const db = admin.firestore();
  const snap = await db.collection("settings").doc("financial_reports").get();
  const raw = snap.exists ? (snap.data() as Partial<FinancialReportsSettings>) : {};
  const recipients = Array.isArray(raw.recipients)
    ? raw.recipients
        .filter((r) => r && normalizeDigits(r.phone).length >= 10)
        .map((r) => ({
          id: String(r.id || normalizeDigits(r.phone)),
          name: String(r.name || "Gestor"),
          phone: normalizeDigits(r.phone),
          enabled: r.enabled !== false,
        }))
    : [];

  const dueDays =
    Array.isArray(raw.dueDays) && raw.dueDays.length > 0
      ? raw.dueDays
          .map((d) => Number(d))
          .filter((d) => Number.isInteger(d) && d >= 1 && d <= 31)
      : DEFAULT_DUE_DAYS;

  return {
    recipients,
    dueDayReportEnabled: raw.dueDayReportEnabled !== false,
    dueDays,
    daysAfterDue:
      typeof raw.daysAfterDue === "number" && raw.daysAfterDue >= 0 && raw.daysAfterDue <= 15
        ? raw.daysAfterDue
        : 5,
    monthlyClosingEnabled: raw.monthlyClosingEnabled !== false,
    updatedAtMs: raw.updatedAtMs,
    updatedBy: raw.updatedBy,
  };
}

/**
 * Calcula o relatório completo D+5 de um dia de vencimento específico (ex.: 5, 10, 15, 20 ou 25).
 */
export async function computeDueDayReport(
  dueDay: number,
  yearMonthInput?: string
): Promise<{ metrics: DueDayReportMetrics; message: string }> {
  const sp = getSaoPauloDateParts();
  const yearMonth = yearMonthInput || sp.yearMonth;
  const bounds = getMonthBounds(yearMonth);
  const clampedDay = Math.min(dueDay, bounds.daysInMonth);
  const targetDueDateIso = `${yearMonth}-${String(clampedDay).padStart(2, "0")}`;

  const { host, token } = getIspfyConfig();
  const ispfy = new IspfyBackendService(host, token);

  const [monthInvoices, allContracts] = await Promise.all([
    ispfy.fetchAllObject<Record<string, unknown>>("/cliente/contrato/cobranca", {
      filter: `data_vencimento:GTE:${bounds.startIso} [AND] data_vencimento:LTE:${bounds.endIso}`,
      sort: "id:DESC",
    }),
    ispfy.fetchAllObject<Record<string, unknown>>("/cliente/contrato", {
      sort: "id:DESC",
    }),
  ]);

  const contractMap = new Map<string, Record<string, unknown>>();
  for (const ct of allContracts) {
    if (ct.id) contractMap.set(String(ct.id), ct);
  }

  let pagasCount = 0;
  let totalEntrou = 0;
  let inadimplentesCount = 0;
  let totalInadimplente = 0;
  let excluidasCount = 0;

  const allClientsSet = new Set<string>();
  const paidClientsSet = new Set<string>();
  const overdueClientsSet = new Set<string>();
  const blockedOverdueClientsSet = new Set<string>();

  for (const inv of monthInvoices) {
    const dueIso = extractDateOnly(inv.data_vencimento);
    if (!dueIso || !dueIso.startsWith(yearMonth)) continue;

    const invDay = Number(dueIso.slice(8, 10));
    const ct = inv.id_contrato ? contractMap.get(String(inv.id_contrato)) : undefined;
    const contractDueDay = Number(ct?.dia_vencimento || 0);

    // Pertence ao vencimento se cair exatamente no dia OU se o contrato for daquele dia com ajuste de fim de semana (±3 dias)
    const exactMatch = invDay === clampedDay;
    const weekendShiftedMatch =
      contractDueDay === dueDay && Math.abs(invDay - clampedDay) <= 3;

    if (!exactMatch && !weekendShiftedMatch) continue;

    if (isInvoiceDeleted(inv)) {
      excluidasCount += 1;
      continue;
    }

    const clientId = String(ct?.id_cliente || inv.id_cliente || inv.id_contrato || inv.id || "");
    const paid = isInvoicePaid(inv);

    if (paid) {
      pagasCount += 1;
      totalEntrou += parseAmount(inv.valor_pago ?? inv.pagamento_valor ?? inv.valor);
      if (clientId) {
        allClientsSet.add(clientId);
        paidClientsSet.add(clientId);
      }
    } else {
      // Ignora boletos em aberto residuais de contratos já cancelados
      if (ct && String(ct.contrato_ativo ?? "s").toLowerCase() === "n") {
        continue;
      }
      inadimplentesCount += 1;
      totalInadimplente += parseAmount(inv.valor);
      if (clientId) {
        allClientsSet.add(clientId);
        overdueClientsSet.add(clientId);
        if (isContractBlocked(ct)) {
          blockedOverdueClientsSet.add(clientId);
        }
      }
    }
  }

  const totalFaturas = pagasCount + inadimplentesCount;
  const totalPrevisto = totalEntrou + totalInadimplente;
  const taxaAdimplenciaQtd =
    totalFaturas > 0 ? Number(((pagasCount / totalFaturas) * 100).toFixed(1)) : 0;
  const taxaAdimplenciaValor =
    totalPrevisto > 0 ? Number(((totalEntrou / totalPrevisto) * 100).toFixed(1)) : 0;
  const clientesAtrasoLiberadosCount = Math.max(
    0,
    overdueClientsSet.size - blockedOverdueClientsSet.size
  );

  const metrics: DueDayReportMetrics = {
    yearMonth,
    dueDay,
    targetDueDateIso,
    totalFaturas,
    totalClientesUnicos: allClientsSet.size,
    pagasCount,
    clientesPagosCount: paidClientsSet.size,
    totalEntrou: Number(totalEntrou.toFixed(2)),
    inadimplentesCount,
    clientesInadimplentesCount: overdueClientsSet.size,
    clientesBloqueadosCount: blockedOverdueClientsSet.size,
    clientesAtrasoLiberadosCount,
    totalInadimplente: Number(totalInadimplente.toFixed(2)),
    totalPrevisto: Number(totalPrevisto.toFixed(2)),
    taxaAdimplenciaQtd,
    taxaAdimplenciaValor,
    excluidasCount,
  };

  const dueDayPadded = String(dueDay).padStart(2, "0");
  const lines = [
    `📊 *RELATÓRIO FINANCEIRO — VENCIMENTO DIA ${dueDayPadded}*`,
    `📅 *Referência:* ${bounds.label} (Apuração D+5 em ${sp.iso.split("-").reverse().join("/")})`,
    ``,
    `✅ *ENTRARAM / PAGOS:*`,
    `• Quantidade: *${pagasCount} fatura(s)* (${paidClientsSet.size} clientes)`,
    `• Total que entrou: *${formatBrl(metrics.totalEntrou)}*`,
    ``,
    `⚠️ *INADIMPLENTES / EM ATRASO:*`,
    `• Quantidade em atraso: *${inadimplentesCount} fatura(s)* (${overdueClientsSet.size} clientes)`,
    `• Bloqueados: *${blockedOverdueClientsSet.size}* | Liberados em atraso: *${clientesAtrasoLiberadosCount}*`,
    `• Total inadimplente: *${formatBrl(metrics.totalInadimplente)}*`,
    ``,
    `📈 *RESUMO DO VENCIMENTO DIA ${dueDayPadded}:*`,
    `• Total faturado no ciclo: *${totalFaturas} fatura(s)* • *${formatBrl(metrics.totalPrevisto)}*`,
    `• Taxa de recebimento: *${taxaAdimplenciaValor}%* em R$ (*${taxaAdimplenciaQtd}%* em faturas)`,
    ...(excluidasCount > 0 ? [`• Cobranças excluídas/canceladas nesta data: ${excluidasCount}`] : []),
    ``,
    `_Enviado automaticamente pelo Painel AVL Telecom._`,
  ];

  return { metrics, message: lines.join("\n") };
}

/**
 * Calcula o relatório de Fechamento Mensal (Instalações, Cancelados, Excluídos e Financeiro do Mês).
 */
export async function computeMonthlyClosingReport(
  yearMonthInput?: string
): Promise<{ metrics: MonthlyClosingMetrics; message: string }> {
  const sp = getSaoPauloDateParts();
  const yearMonth = yearMonthInput || sp.yearMonth;
  const bounds = getMonthBounds(yearMonth);

  const db = admin.firestore();
  const { host, token } = getIspfyConfig();
  const ispfy = new IspfyBackendService(host, token);

  const [
    allClients,
    allContracts,
    allPoints,
    ticketsRemocao,
    paidMonthInvoices,
    dueMonthInvoices,
    snapCatalogo,
    snapExcluidos,
  ] = await Promise.all([
    ispfy.fetchAllObject<Record<string, unknown>>("/cliente", { sort: "id:DESC" }),
    ispfy.fetchAllObject<Record<string, unknown>>("/cliente/contrato", { sort: "id:DESC" }),
    ispfy.fetchAllObject<Record<string, unknown>>("/cliente/contrato/ponto", { sort: "id:DESC" }),
    ispfy
      .fetchAllObject<Record<string, unknown>>("/suporte/ticket", {
        filter: "id_topico:EQ:7",
        sort: "id:DESC",
      })
      .catch(() => [] as Record<string, unknown>[]),
    ispfy.fetchAllObject<Record<string, unknown>>("/cliente/contrato/cobranca", {
      filter: `status:EQ:pago [AND] data_pagamento:GTE:${bounds.startIso}`,
      sort: "data_pagamento:DESC",
    }),
    ispfy.fetchAllObject<Record<string, unknown>>("/cliente/contrato/cobranca", {
      filter: `data_vencimento:GTE:${bounds.startIso} [AND] data_vencimento:LTE:${bounds.endIso}`,
      sort: "id:DESC",
    }),
    db.collection("ispfy_audit_snapshots").doc("clients_catalog").get().catch(() => null),
    db.collection("ispfy_audit_snapshots").doc("deleted_history").get().catch(() => null),
  ]);

  const contractMap = new Map<string, Record<string, unknown>>();
  let totalBaseAtivaContratos = 0;
  for (const ct of allContracts) {
    if (ct.id) contractMap.set(String(ct.id), ct);
    if (String(ct.contrato_ativo ?? "").toLowerCase() === "s") {
      totalBaseAtivaContratos += 1;
    }
  }

  // 1. Instalações / Novas Ativações no Mês
  const novosClientesCadastrados = allClients.filter((c) => {
    const dt = extractDateOnly(c.data_cadastro);
    return Boolean(dt && dt >= bounds.startIso && dt <= bounds.endIso);
  }).length;

  const contratosAdesaoSet = new Set<string>();
  const instalacoesUnicasSet = new Set<string>();

  for (const ct of allContracts) {
    const dtAdesao = extractDateOnly(ct.data_adesao || ct.data_inicio);
    if (dtAdesao && dtAdesao >= bounds.startIso && dtAdesao <= bounds.endIso) {
      const ctId = String(ct.id || "");
      const cliId = String(ct.id_cliente || ctId);
      if (ctId) contratosAdesaoSet.add(ctId);
      if (cliId) instalacoesUnicasSet.add(cliId);
    }
  }

  const pontosAtivadosSet = new Set<string>();
  for (const pt of allPoints) {
    const dtAtiv = extractDateOnly(pt.data_ativacao);
    if (dtAtiv && dtAtiv >= bounds.startIso && dtAtiv <= bounds.endIso) {
      const ptId = String(pt.id || "");
      if (ptId) pontosAtivadosSet.add(ptId);
      const ct = pt.id_contrato ? contractMap.get(String(pt.id_contrato)) : undefined;
      const cliId = String(ct?.id_cliente || pt.id_contrato || ptId);
      if (cliId) instalacoesUnicasSet.add(cliId);
    }
  }

  const totalInstalacoes = Math.max(instalacoesUnicasSet.size, contratosAdesaoSet.size);

  // 2. Cancelamentos no Mês (contratos com data_rescisao no mês + tickets tópico 7 sem rescisão)
  const canceladosClientsSet = new Set<string>();
  let contratosRescindidosMes = 0;
  for (const ct of allContracts) {
    const dtResc = extractDateOnly(ct.data_rescisao);
    if (dtResc && dtResc >= bounds.startIso && dtResc <= bounds.endIso) {
      contratosRescindidosMes += 1;
      canceladosClientsSet.add(String(ct.id_cliente || ct.id || ""));
    }
  }

  const ticketsRetiradaSet = new Set<string>();
  for (const tk of ticketsRemocao) {
    const dtTk = extractDateOnly(tk.data_abertura || tk.data_cadastro);
    if (dtTk && dtTk >= bounds.startIso && dtTk <= bounds.endIso) {
      const cliId = String(tk.id_cliente || "");
      if (cliId && !canceladosClientsSet.has(cliId)) {
        ticketsRetiradaSet.add(cliId);
      }
    }
  }
  const totalCancelados = canceladosClientsSet.size + ticketsRetiradaSet.size;

  // 3. Excluídos da base no mês (compara catálogo atual x snapshot da nuvem + histórico)
  const currentIdsSet = new Set<string>(
    allClients.map((c) => String(c.id || "")).filter(Boolean)
  );
  const deletedRecords: Array<{ id: string; detectado_em?: string }> = Array.isArray(
    snapExcluidos?.data()?.records
  )
    ? snapExcluidos!.data()!.records
    : [];

  const prevCatalog = (snapCatalogo?.data()?.entries || {}) as Record<
    string,
    { nome_razao?: string; cpf_cnpj?: string; data_cadastro?: string; bairro?: string }
  >;

  const alreadyRecordedIds = new Set(deletedRecords.map((r) => String(r.id)));
  const newlyDetectedDeleted: Array<Record<string, unknown>> = [];

  if (Object.keys(prevCatalog).length > 0 && currentIdsSet.size > 0) {
    for (const [prevId, info] of Object.entries(prevCatalog)) {
      if (!currentIdsSet.has(prevId) && !alreadyRecordedIds.has(prevId)) {
        newlyDetectedDeleted.push({
          id: prevId,
          nome_razao: info?.nome_razao || `ID #${prevId}`,
          cpf_cnpj: info?.cpf_cnpj || "",
          bairro: info?.bairro || "",
          detectado_em: sp.iso,
          origem: "snapshot_cron_mensal",
        });
      }
    }
    if (newlyDetectedDeleted.length > 0) {
      await db
        .collection("ispfy_audit_snapshots")
        .doc("deleted_history")
        .set(
          {
            records: [...newlyDetectedDeleted, ...deletedRecords].slice(0, 500),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
        .catch(() => undefined);
    }
  }

  const allDeletedCombined = [
    ...newlyDetectedDeleted.map((r) => ({
      id: String(r.id),
      detectado_em: String(r.detectado_em || ""),
    })),
    ...deletedRecords,
  ];

  const excluidosMesIds = new Set<string>();
  for (const rec of allDeletedCombined) {
    const dt = extractDateOnly(rec.detectado_em);
    if (dt && dt >= bounds.startIso && dt <= bounds.endIso) {
      excluidosMesIds.add(String(rec.id));
    }
  }
  const totalExcluidos = excluidosMesIds.size;

  // 4. Resumo financeiro do mês + faturas excluídas no mês
  let totalEntrouMes = 0;
  let pagamentosMesCount = 0;
  for (const p of paidMonthInvoices) {
    const dtPgto = extractDateOnly(p.data_pagamento || p.pagamento_data);
    if (dtPgto && dtPgto >= bounds.startIso && dtPgto <= bounds.endIso) {
      totalEntrouMes += parseAmount(p.valor_pago ?? p.pagamento_valor ?? p.valor);
      pagamentosMesCount += 1;
    }
  }

  let totalInadimplenteMes = 0;
  let faturasInadimplentesMesCount = 0;
  let faturasExcluidasMes = 0;
  for (const inv of dueMonthInvoices) {
    if (isInvoiceDeleted(inv)) {
      const dtEx = extractDateOnly(inv.data_exclusao || inv.data_vencimento);
      if (!dtEx || (dtEx >= bounds.startIso && dtEx <= bounds.endIso)) {
        faturasExcluidasMes += 1;
      }
      continue;
    }
    if (!isInvoicePaid(inv)) {
      const ct = inv.id_contrato ? contractMap.get(String(inv.id_contrato)) : undefined;
      if (ct && String(ct.contrato_ativo ?? "s").toLowerCase() === "n") continue;
      totalInadimplenteMes += parseAmount(inv.valor);
      faturasInadimplentesMesCount += 1;
    }
  }

  const saldoLiquidoBase = totalInstalacoes - totalCancelados - totalExcluidos;

  const metrics: MonthlyClosingMetrics = {
    yearMonth,
    periodoLabel: bounds.label,
    totalInstalacoes,
    contratosAdesaoMes: contratosAdesaoSet.size,
    pontosAtivadosMes: pontosAtivadosSet.size,
    novosClientesCadastrados,
    totalCancelados,
    contratosRescindidosMes,
    ticketsRetiradaSemRescisao: ticketsRetiradaSet.size,
    totalExcluidos,
    faturasExcluidasMes,
    saldoLiquidoBase,
    totalBaseAtivaContratos,
    totalEntrouMes: Number(totalEntrouMes.toFixed(2)),
    pagamentosMesCount,
    totalInadimplenteMes: Number(totalInadimplenteMes.toFixed(2)),
    faturasInadimplentesMesCount,
  };

  const saldoPrefix = saldoLiquidoBase > 0 ? "+" : "";
  const lines = [
    `🏁 *FECHAMENTO MENSAL AVL TELECOM — ${bounds.label.toUpperCase()}*`,
    `📅 *Período:* ${bounds.startIso.split("-").reverse().join("/")} a ${bounds.endIso.split("-").reverse().join("/")}`,
    ``,
    `🚀 *INSTALAÇÕES & NOVOS CLIENTES:*`,
    `• Total de instalações no mês: *${totalInstalacoes}*`,
    `• Novos cadastros: *${novosClientesCadastrados}* | Contratos novos: *${contratosAdesaoSet.size}* | Pontos ativados: *${pontosAtivadosSet.size}*`,
    ``,
    `❌ *CANCELAMENTOS & EXCLUÍDOS:*`,
    `• Total de cancelados: *${totalCancelados}* (${contratosRescindidosMes} rescisões${ticketsRetiradaSet.size > 0 ? ` + ${ticketsRetiradaSet.size} O.S. retirada` : ""})`,
    `• Clientes excluídos da base: *${totalExcluidos}*`,
    `• Cobranças excluídas no mês: *${faturasExcluidasMes}*`,
    ``,
    `📊 *SALDO DA BASE:*`,
    `• Crescimento líquido: *${saldoPrefix}${saldoLiquidoBase} cliente(s)*`,
    `• Contratos ativos atuais: *${totalBaseAtivaContratos}*`,
    ``,
    `💰 *RESUMO FINANCEIRO DO MÊS:*`,
    `• Total que entrou: *${formatBrl(metrics.totalEntrouMes)}* (${pagamentosMesCount} baixas)`,
    `• Total inadimplente do mês: *${formatBrl(metrics.totalInadimplenteMes)}* (${faturasInadimplentesMesCount} faturas em aberto)`,
    ``,
    `_Enviado automaticamente pelo Painel AVL Telecom._`,
  ];

  return { metrics, message: lines.join("\n") };
}

async function sendReportToRecipients(
  recipients: FinancialReportRecipient[],
  message: string
): Promise<{ sentCount: number; failedCount: number; sentTo: string[] }> {
  const { apiKey, baseUrl } = getWhapiConfig();
  const wa = new WhatsAppService(baseUrl, apiKey);
  const enabledRecipients = recipients.filter((r) => r.enabled && normalizeDigits(r.phone).length >= 10);

  let sentCount = 0;
  let failedCount = 0;
  const sentTo: string[] = [];

  for (const rec of enabledRecipients) {
    try {
      await wa.sendTextMessage(rec.phone, message);
      sentCount += 1;
      sentTo.push(`${rec.name} (${rec.phone})`);
    } catch (err: unknown) {
      failedCount += 1;
      console.error(
        `❌ [FinancialReports] Falha ao enviar relatório para ${rec.phone}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return { sentCount, failedCount, sentTo };
}

async function writeReportLog(entry: {
  reportType: "due_day_d5" | "monthly_closing";
  referenceKey: string;
  trigger: "cron" | "manual";
  sentCount: number;
  failedCount: number;
  sentTo: string[];
  message: string;
  metrics: DueDayReportMetrics | MonthlyClosingMetrics;
  triggeredBy?: string;
}): Promise<void> {
  const db = admin.firestore();
  await db.collection("financial_report_logs").add({
    ...entry,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
  });
}

/**
 * ⏰ CRON DIÁRIO (09:00 BRT): Verifica se hoje é D+5 (ou offset configurado) de algum vencimento
 * (padrão: dias 5, 10, 15, 20, 25 -> dispara nos dias 10, 15, 20, 25 e 30).
 */
export const ispfyDueDayReportCron = functions
  .runWith({ memory: "512MB", timeoutSeconds: 180 })
  .pubsub.schedule("0 9 * * *")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    const db = admin.firestore();
    const settings = await loadReportSettings();
    const activeRecipients = settings.recipients.filter((r) => r.enabled);

    if (!settings.dueDayReportEnabled || activeRecipients.length === 0) {
      console.log("ℹ️ [ispfyDueDayReportCron] Desativado ou sem contatos WhatsApp configurados.");
      return null;
    }

    const sp = getSaoPauloDateParts();

    for (const dueDay of settings.dueDays) {
      const targetSendDay = Math.min(dueDay + settings.daysAfterDue, sp.daysInMonth);
      if (sp.day !== targetSendDay) continue;

      const runKey = `${sp.yearMonth}_due_${String(dueDay).padStart(2, "0")}`;
      const runRef = db.collection("financial_report_runs").doc(runKey);
      const runSnap = await runRef.get();
      if (runSnap.exists) {
        console.log(`⏭️ [ispfyDueDayReportCron] Relatório ${runKey} já enviado anteriormente.`);
        continue;
      }

      try {
        console.log(`📊 [ispfyDueDayReportCron] Gerando relatório D+${settings.daysAfterDue} do vencimento dia ${dueDay}...`);
        const { metrics, message } = await computeDueDayReport(dueDay, sp.yearMonth);
        const delivery = await sendReportToRecipients(activeRecipients, message);

        if (delivery.sentCount > 0) {
          await runRef.set({
            runKey,
            reportType: "due_day_d5",
            dueDay,
            yearMonth: sp.yearMonth,
            sentAtMs: Date.now(),
            sentTo: delivery.sentTo,
          });
        }

        await writeReportLog({
          reportType: "due_day_d5",
          referenceKey: runKey,
          trigger: "cron",
          sentCount: delivery.sentCount,
          failedCount: delivery.failedCount,
          sentTo: delivery.sentTo,
          message,
          metrics,
        });
      } catch (err: unknown) {
        console.error(
          `❌ [ispfyDueDayReportCron] Erro ao processar vencimento dia ${dueDay}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    return null;
  });

/**
 * ⏰ CRON FIM DE MÊS (19:00 BRT nos dias 28-31): Dispara exatamente no último dia do mês
 * com o balanço de Instalações, Cancelados, Excluídos e Financeiro do Mês.
 */
export const ispfyMonthlyClosingReportCron = functions
  .runWith({ memory: "512MB", timeoutSeconds: 240 })
  .pubsub.schedule("0 19 28-31 * *")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    const sp = getSaoPauloDateParts();
    if (!sp.isLastDayOfMonth) {
      return null;
    }

    const db = admin.firestore();
    const settings = await loadReportSettings();
    const activeRecipients = settings.recipients.filter((r) => r.enabled);

    if (!settings.monthlyClosingEnabled || activeRecipients.length === 0) {
      console.log("ℹ️ [ispfyMonthlyClosingReportCron] Desativado ou sem contatos WhatsApp configurados.");
      return null;
    }

    const runKey = `${sp.yearMonth}_monthly_closing`;
    const runRef = db.collection("financial_report_runs").doc(runKey);
    const runSnap = await runRef.get();
    if (runSnap.exists) {
      console.log(`⏭️ [ispfyMonthlyClosingReportCron] Fechamento ${runKey} já enviado.`);
      return null;
    }

    try {
      console.log(`🏁 [ispfyMonthlyClosingReportCron] Gerando fechamento mensal de ${sp.yearMonth}...`);
      const { metrics, message } = await computeMonthlyClosingReport(sp.yearMonth);
      const delivery = await sendReportToRecipients(activeRecipients, message);

      if (delivery.sentCount > 0) {
        await runRef.set({
          runKey,
          reportType: "monthly_closing",
          yearMonth: sp.yearMonth,
          sentAtMs: Date.now(),
          sentTo: delivery.sentTo,
        });
      }

      await writeReportLog({
        reportType: "monthly_closing",
        referenceKey: runKey,
        trigger: "cron",
        sentCount: delivery.sentCount,
        failedCount: delivery.failedCount,
        sentTo: delivery.sentTo,
        message,
        metrics,
      });
    } catch (err: unknown) {
      console.error(
        "❌ [ispfyMonthlyClosingReportCron] Erro no fechamento mensal:",
        err instanceof Error ? err.message : err
      );
    }

    return null;
  });

/**
 * 📲 Callable autenticado: Pré-visualizar ou disparar imediatamente no WhatsApp
 * tanto o relatório por data de vencimento (5, 10, 15, 20, 25) quanto o Fechamento Mensal.
 */
export const runIspfyFinancialReport = functions
  .runWith({ memory: "512MB", timeoutSeconds: 180 })
  .https.onCall(async (data, context) => {
    verifyAuth(context);

    const mode = data?.mode === "send" ? "send" : "preview";
    const reportType =
      data?.reportType === "monthly_closing" ? "monthly_closing" : "due_day";
    const sp = getSaoPauloDateParts();
    const yearMonth =
      typeof data?.yearMonth === "string" && /^\d{4}-\d{2}$/.test(data.yearMonth)
        ? data.yearMonth
        : sp.yearMonth;
    const dueDay = Number(data?.dueDay || 5);

    const result =
      reportType === "monthly_closing"
        ? await computeMonthlyClosingReport(yearMonth)
        : await computeDueDayReport(dueDay, yearMonth);

    if (mode === "preview") {
      return {
        success: true,
        mode: "preview",
        reportType,
        metrics: result.metrics,
        message: result.message,
      };
    }

    const settings = await loadReportSettings();
    let recipients = settings.recipients.filter((r) => r.enabled);

    if (Array.isArray(data?.overridePhones) && data.overridePhones.length > 0) {
      recipients = data.overridePhones
        .map((p: unknown, idx: number) => ({
          id: `override_${idx}`,
          name: "Destinatário",
          phone: normalizeDigits(String(p || "")),
          enabled: true,
        }))
        .filter((r: FinancialReportRecipient) => r.phone.length >= 10);
    }

    if (recipients.length === 0) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Nenhum contato de WhatsApp ativo salvo para envio do relatório."
      );
    }

    const delivery = await sendReportToRecipients(recipients, result.message);
    const refKey =
      reportType === "monthly_closing"
        ? `${yearMonth}_monthly_closing`
        : `${yearMonth}_due_${String(dueDay).padStart(2, "0")}`;

    await writeReportLog({
      reportType: reportType === "monthly_closing" ? "monthly_closing" : "due_day_d5",
      referenceKey: refKey,
      trigger: "manual",
      sentCount: delivery.sentCount,
      failedCount: delivery.failedCount,
      sentTo: delivery.sentTo,
      message: result.message,
      metrics: result.metrics,
      triggeredBy: context.auth?.token?.email || context.auth?.uid || "operador",
    });

    return {
      success: delivery.sentCount > 0,
      mode: "send",
      reportType,
      sentCount: delivery.sentCount,
      failedCount: delivery.failedCount,
      sentTo: delivery.sentTo,
      metrics: result.metrics,
      message: result.message,
    };
  });
