import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
  Save,
  Send,
  Trash2,
  TrendingUp,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { db, functions } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BentoGrid,
  BentoMetricCard,
  MovingBorderButton,
  ShimmerBadge,
  SpotlightCard,
} from '@/components/ui/aceternity';

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
}

interface ReportLogItem {
  id: string;
  reportType: 'due_day_d5' | 'monthly_closing';
  referenceKey: string;
  trigger: 'cron' | 'manual';
  sentCount: number;
  failedCount: number;
  sentTo: string[];
  message: string;
  createdAtMs: number;
}

interface DueDayMetrics {
  dueDay: number;
  pagasCount: number;
  clientesPagosCount: number;
  totalEntrou: number;
  inadimplentesCount: number;
  clientesInadimplentesCount: number;
  clientesBloqueadosCount: number;
  clientesAtrasoLiberadosCount: number;
  totalInadimplente: number;
  totalPrevisto: number;
  taxaAdimplenciaValor: number;
  taxaAdimplenciaQtd: number;
}

interface MonthlyClosingMetrics {
  periodoLabel: string;
  totalInstalacoes: number;
  novosClientesCadastrados: number;
  totalCancelados: number;
  totalExcluidos: number;
  faturasExcluidasMes: number;
  saldoLiquidoBase: number;
  totalBaseAtivaContratos: number;
  totalEntrouMes: number;
  totalInadimplenteMes: number;
}

interface CallableReportResult {
  success: boolean;
  mode: 'preview' | 'send';
  reportType: 'due_day' | 'monthly_closing';
  sentCount?: number;
  failedCount?: number;
  sentTo?: string[];
  metrics: DueDayMetrics | MonthlyClosingMetrics;
  message: string;
}

const AVAILABLE_DUE_DAYS = [5, 10, 15, 20, 25, 30];
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function normalizePhoneBr(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function formatPhoneDisplay(phone: string): string {
  const d = phone.replace(/\D/g, '');
  const local = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return phone;
}

function getCurrentYearMonth(): string {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());
  return iso.slice(0, 7);
}

export const FinancialWhatsAppReportsPanel: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<FinancialReportsSettings>({
    recipients: [],
    dueDayReportEnabled: true,
    dueDays: [5, 10, 15, 20, 25],
    daysAfterDue: 5,
    monthlyClosingEnabled: true,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Form de novo contato WhatsApp
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Prévia & disparo manual
  const [yearMonth, setYearMonth] = useState<string>(getCurrentYearMonth());
  const [selectedReportKind, setSelectedReportKind] = useState<'due_day' | 'monthly_closing'>('due_day');
  const [selectedDueDay, setSelectedDueDay] = useState<number>(5);
  const [runningMode, setRunningMode] = useState<'preview' | 'send' | null>(null);
  const [previewResult, setPreviewResult] = useState<CallableReportResult | null>(null);

  // Histórico de disparos
  const [logs, setLogs] = useState<ReportLogItem[]>([]);

  useEffect(() => {
    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'financial_reports'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as Partial<FinancialReportsSettings>;
        setSettings({
          recipients: Array.isArray(data.recipients) ? data.recipients : [],
          dueDayReportEnabled: data.dueDayReportEnabled !== false,
          dueDays:
            Array.isArray(data.dueDays) && data.dueDays.length > 0
              ? data.dueDays.map(Number)
              : [5, 10, 15, 20, 25],
          daysAfterDue: typeof data.daysAfterDue === 'number' ? data.daysAfterDue : 5,
          monthlyClosingEnabled: data.monthlyClosingEnabled !== false,
        });
      },
      (err) => console.error('Erro ao ler settings/financial_reports:', err)
    );

    const logsQuery = query(
      collection(db, 'financial_report_logs'),
      orderBy('createdAtMs', 'desc'),
      limit(15)
    );
    const unsubLogs = onSnapshot(
      logsQuery,
      (snap) => {
        setLogs(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ReportLogItem, 'id'>),
          }))
        );
      },
      () => setLogs([])
    );

    return () => {
      unsubSettings();
      unsubLogs();
    };
  }, []);

  const persistSettings = async (next: FinancialReportsSettings, feedback?: string) => {
    setSavingSettings(true);
    try {
      await setDoc(
        doc(db, 'settings', 'financial_reports'),
        {
          ...next,
          updatedAtMs: Date.now(),
          updatedBy: user?.email || user?.displayName || 'operador',
        },
        { merge: true }
      );
      if (feedback) toast.success(feedback);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar configurações no Firestore.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = normalizePhoneBr(newPhone);
    if (cleanPhone.length < 12) {
      toast.error('Informe um número de WhatsApp válido com DDD (ex: 21 99999-9999).');
      return;
    }
    if (settings.recipients.some((r) => r.phone === cleanPhone)) {
      toast.info('Este número já está salvo na lista.');
      return;
    }

    const updated: FinancialReportsSettings = {
      ...settings,
      recipients: [
        ...settings.recipients,
        {
          id: `${cleanPhone}_${Date.now()}`,
          name: newName.trim() || 'Gestor Financeiro',
          phone: cleanPhone,
          enabled: true,
        },
      ],
    };
    setSettings(updated);
    setNewName('');
    setNewPhone('');
    await persistSettings(updated, 'Contato de WhatsApp salvo para relatórios!');
  };

  const handleToggleRecipient = async (id: string) => {
    const updated: FinancialReportsSettings = {
      ...settings,
      recipients: settings.recipients.map((r) =>
        r.id === id ? { ...r, enabled: !r.enabled } : r
      ),
    };
    setSettings(updated);
    await persistSettings(updated);
  };

  const handleRemoveRecipient = async (id: string) => {
    const updated: FinancialReportsSettings = {
      ...settings,
      recipients: settings.recipients.filter((r) => r.id !== id),
    };
    setSettings(updated);
    await persistSettings(updated, 'Contato removido.');
  };

  const handleToggleDueDay = (day: number) => {
    const exists = settings.dueDays.includes(day);
    const nextDays = exists
      ? settings.dueDays.filter((d) => d !== day)
      : [...settings.dueDays, day].sort((a, b) => a - b);
    if (nextDays.length === 0) {
      toast.warning('Mantenha ao menos 1 data de vencimento selecionada.');
      return;
    }
    setSettings((prev) => ({ ...prev, dueDays: nextDays }));
  };

  const handleRunReport = async (mode: 'preview' | 'send') => {
    if (mode === 'send' && settings.recipients.filter((r) => r.enabled).length === 0) {
      toast.error('Salve e ative ao menos 1 contato de WhatsApp antes de enviar.');
      return;
    }

    setRunningMode(mode);
    try {
      const callable = httpsCallable<Record<string, unknown>, CallableReportResult>(
        functions,
        'runIspfyFinancialReport'
      );
      const resp = await callable({
        mode,
        reportType: selectedReportKind,
        dueDay: selectedDueDay,
        yearMonth,
      });
      setPreviewResult(resp.data);
      if (mode === 'send') {
        toast.success(
          `Relatório enviado para ${resp.data.sentCount || 0} contato(s) no WhatsApp!`
        );
      } else {
        toast.success('Prévia atualizada com dados reais do ISPFY!');
      }
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Falha ao executar relatório.';
      toast.error(msg);
    } finally {
      setRunningMode(null);
    }
  };

  const scheduleSummary = useMemo(() => {
    return settings.dueDays
      .map((d) => {
        const sendDay = Math.min(d + settings.daysAfterDue, 30);
        return `Venc. ${String(d).padStart(2, '0')} → envia dia ${String(sendDay).padStart(2, '0')}`;
      })
      .join('  •  ');
  }, [settings.dueDays, settings.daysAfterDue]);

  const activeRecipientsCount = settings.recipients.filter((r) => r.enabled).length;

  return (
    <div className="space-y-6">
      {/* Linha 1: Contatos WhatsApp + Regras de Agendamento Automático */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card 1: Contatos de WhatsApp */}
        <SpotlightCard tone="emerald" showTopBeam className="lg:col-span-5 p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-500" />
                Contatos de WhatsApp Salvos
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Números que receberão os relatórios automáticos D+5 e Fechamento Mensal.
              </p>
            </div>
            <ShimmerBadge tone={activeRecipientsCount > 0 ? 'emerald' : 'amber'}>
              {activeRecipientsCount} ativo(s)
            </ShimmerBadge>
          </div>

          <form onSubmit={handleAddRecipient} className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome (ex.: Diretor / Financeiro)"
                className="h-9 text-xs rounded-xl"
              />
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="WhatsApp (ex.: 22 99999-9999)"
                className="h-9 text-xs rounded-xl font-mono"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={savingSettings}
              className="w-full h-9 rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <Plus className="w-4 h-4" />
              Salvar Contato WhatsApp
            </Button>
          </form>

          <div className="space-y-2 pt-1">
            {settings.recipients.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 p-4 text-center text-xs text-muted-foreground">
                Nenhum contato salvo ainda. Cadastre seu WhatsApp acima para ativar os envios automáticos.
              </div>
            ) : (
              settings.recipients.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border/75 bg-background/70 dark:bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{rec.name}</p>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        +{rec.phone.slice(0, 2)} {formatPhoneDisplay(rec.phone)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rec.enabled}
                      onCheckedChange={() => handleToggleRecipient(rec.id)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                      onClick={() => handleRemoveRecipient(rec.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SpotlightCard>

        {/* Card 2: Agenda Automática D+5 + Fim de Mês */}
        <SpotlightCard tone="blue" showTopBeam className="lg:col-span-7 p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Agendamento Automático (24/7 na Nuvem)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Roda automaticamente no servidor Firebase mesmo com o painel fechado.
              </p>
            </div>
            <Button
              size="sm"
              disabled={savingSettings}
              onClick={() => persistSettings(settings, 'Agenda de relatórios salva com sucesso!')}
              className="h-8 rounded-xl gap-1.5 text-xs"
            >
              {savingSettings ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Salvar Regras
            </Button>
          </div>

          {/* Bloco 1: Vencimentos D+5 */}
          <div className="rounded-xl border border-border/75 bg-background/70 dark:bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-foreground">
                  1. Relatório por Data de Vencimento (D+{settings.daysAfterDue})
                </p>
                <p className="text-xs text-muted-foreground">
                  Envia às 09:00 com pagos, total que entrou (R$), inadimplentes/atraso e total inadimplente (R$).
                </p>
              </div>
              <Switch
                checked={settings.dueDayReportEnabled}
                onCheckedChange={(v) =>
                  setSettings((prev) => ({ ...prev, dueDayReportEnabled: v }))
                }
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground mr-1">
                Vencimentos monitorados:
              </span>
              {AVAILABLE_DUE_DAYS.map((day) => {
                const active = settings.dueDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleToggleDueDay(day)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-muted/40 text-muted-foreground border-border hover:border-primary/40'
                    }`}
                  >
                    Dia {String(day).padStart(2, '0')}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Label className="text-xs text-muted-foreground">Enviar quantos dias após o vencimento:</Label>
              <Select
                value={String(settings.daysAfterDue)}
                onValueChange={(val) =>
                  setSettings((prev) => ({ ...prev, daysAfterDue: Number(val) }))
                }
              >
                <SelectTrigger className="w-40 h-8 text-xs rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 5, 7, 10].map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} dias depois (D+{d})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg bg-primary/8 border border-primary/20 px-3 py-2 text-[11px] font-mono text-primary">
              {scheduleSummary}
            </div>
          </div>

          {/* Bloco 2: Fechamento Mensal */}
          <div className="rounded-xl border border-border/75 bg-background/70 dark:bg-white/[0.02] p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-foreground">
                2. Fechamento de Final de Mês (Instalações, Cancelados e Excluídos)
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dispara automaticamente no último dia de cada mês (28/29/30/31) às 19:00 com total de instalações, cancelados, excluídos da base, crescimento líquido e resumo financeiro.
              </p>
            </div>
            <Switch
              checked={settings.monthlyClosingEnabled}
              onCheckedChange={(v) =>
                setSettings((prev) => ({ ...prev, monthlyClosingEnabled: v }))
              }
            />
          </div>
        </SpotlightCard>
      </div>

      {/* Linha 2: Gerador de Prévia ao Vivo & Envio Imediato */}
      <SpotlightCard tone="violet" showTopBeam className="p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Eye className="w-4 h-4 text-violet-500" />
              Pré-Visualizar ou Enviar Relatório Agora
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Escolha o vencimento (ou Fechamento Mensal) para consultar os números reais do ISPFY e testar o envio no WhatsApp.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="w-40 h-9 text-xs rounded-xl font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={runningMode !== null}
              onClick={() => handleRunReport('preview')}
              className="h-9 rounded-xl gap-1.5 text-xs"
            >
              {runningMode === 'preview' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              Gerar Prévia ao Vivo
            </Button>
            <MovingBorderButton
              size="sm"
              tone="emerald"
              loading={runningMode === 'send'}
              disabled={runningMode !== null}
              onClick={() => handleRunReport('send')}
            >
              <Send className="w-3.5 h-3.5" />
              Enviar Agora no WhatsApp
            </MovingBorderButton>
          </div>
        </div>

        {/* Botões seletores rápidos */}
        <div className="flex flex-wrap items-center gap-2">
          {[5, 10, 15, 20, 25].map((day) => {
            const active = selectedReportKind === 'due_day' && selectedDueDay === day;
            return (
              <Button
                key={day}
                size="sm"
                variant={active ? 'default' : 'outline'}
                className="h-8 rounded-xl text-xs"
                onClick={() => {
                  setSelectedReportKind('due_day');
                  setSelectedDueDay(day);
                }}
              >
                Vencimento Dia {String(day).padStart(2, '0')}
              </Button>
            );
          })}
          <Button
            size="sm"
            variant={selectedReportKind === 'monthly_closing' ? 'default' : 'outline'}
            className="h-8 rounded-xl text-xs gap-1.5"
            onClick={() => setSelectedReportKind('monthly_closing')}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Fechamento do Mês (Instalações / Cancelados / Excluídos)
          </Button>
        </div>

        {/* Resultado da Prévia / Envio */}
        {previewResult && (
          <div className="space-y-4 pt-2">
            {previewResult.reportType === 'due_day' ? (
              <BentoGrid cols={4}>
                {(() => {
                  const m = previewResult.metrics as DueDayMetrics;
                  return (
                    <>
                      <BentoMetricCard
                        tone="emerald"
                        label={`Entraram (Dia ${String(m.dueDay).padStart(2, '0')})`}
                        value={BRL.format(m.totalEntrou)}
                        sublabel={`${m.pagasCount} fatura(s) • ${m.clientesPagosCount} clientes`}
                        icon={<CheckCircle2 className="w-5 h-5" />}
                      />
                      <BentoMetricCard
                        tone="rose"
                        label="Total Inadimplente"
                        value={BRL.format(m.totalInadimplente)}
                        sublabel={`${m.inadimplentesCount} faturas • ${m.clientesInadimplentesCount} clientes`}
                        icon={<Clock className="w-5 h-5" />}
                      />
                      <BentoMetricCard
                        tone="amber"
                        label="Bloqueados vs Atraso"
                        value={`${m.clientesBloqueadosCount} / ${m.clientesAtrasoLiberadosCount}`}
                        sublabel="Bloqueados / Liberados em atraso"
                        icon={<UserMinus className="w-5 h-5" />}
                      />
                      <BentoMetricCard
                        tone="blue"
                        label="Taxa de Recebimento"
                        value={`${m.taxaAdimplenciaValor}%`}
                        sublabel={`Previsto total: ${BRL.format(m.totalPrevisto)}`}
                        icon={<TrendingUp className="w-5 h-5" />}
                      />
                    </>
                  );
                })()}
              </BentoGrid>
            ) : (
              <BentoGrid cols={4}>
                {(() => {
                  const m = previewResult.metrics as MonthlyClosingMetrics;
                  return (
                    <>
                      <BentoMetricCard
                        tone="emerald"
                        label="Total de Instalações"
                        value={m.totalInstalacoes}
                        sublabel={`${m.novosClientesCadastrados} novos cadastros no mês`}
                        icon={<UserPlus className="w-5 h-5" />}
                      />
                      <BentoMetricCard
                        tone="rose"
                        label="Total Cancelados"
                        value={m.totalCancelados}
                        sublabel="Rescisões e retiradas no mês"
                        icon={<UserMinus className="w-5 h-5" />}
                      />
                      <BentoMetricCard
                        tone="amber"
                        label="Total Excluídos"
                        value={m.totalExcluidos}
                        sublabel={`${m.faturasExcluidasMes} cobranças excluídas no mês`}
                        icon={<Trash2 className="w-5 h-5" />}
                      />
                      <BentoMetricCard
                        tone={m.saldoLiquidoBase >= 0 ? 'blue' : 'rose'}
                        label="Saldo Líquido da Base"
                        value={`${m.saldoLiquidoBase > 0 ? '+' : ''}${m.saldoLiquidoBase}`}
                        sublabel={`Entrou: ${BRL.format(m.totalEntrouMes)}`}
                        icon={<TrendingUp className="w-5 h-5" />}
                      />
                    </>
                  );
                })()}
              </BentoGrid>
            )}

            <div className="rounded-2xl border border-border/80 bg-muted/35 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Mensagem exata que vai no WhatsApp
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(previewResult.message);
                    toast.success('Texto do relatório copiado!');
                  }}
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar texto
                </Button>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-foreground leading-relaxed bg-background/80 rounded-xl p-4 border border-border/70">
                {previewResult.message}
              </pre>
            </div>
          </div>
        )}
      </SpotlightCard>

      {/* Linha 3: Histórico de Envios */}
      {logs.length > 0 && (
        <SpotlightCard tone="blue" className="p-5 space-y-3">
          <h3 className="text-sm font-bold text-foreground">
            Histórico de Relatórios Enviados no WhatsApp ({logs.length})
          </h3>
          <div className="space-y-2">
            {logs.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/70 dark:bg-white/[0.02] px-3.5 py-2.5 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={
                      item.reportType === 'monthly_closing'
                        ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30 text-[10px]'
                        : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[10px]'
                    }
                  >
                    {item.reportType === 'monthly_closing'
                      ? 'Fechamento Mensal'
                      : 'Vencimento D+5'}
                  </Badge>
                  <span className="font-mono font-semibold text-foreground">
                    {item.referenceKey}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {item.trigger === 'cron' ? 'Automático' : 'Manual'}
                  </Badge>
                  <span className="text-muted-foreground">
                    Enviado para {item.sentCount} contato(s)
                  </span>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {new Date(item.createdAtMs).toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </SpotlightCard>
      )}
    </div>
  );
};
