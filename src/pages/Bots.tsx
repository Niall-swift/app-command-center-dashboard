import React, { useEffect, useState } from 'react';
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
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Copy,
  Flame,
  Loader2,
  MessageSquare,
  Play,
  Radio,
  Receipt,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Terminal,
  UserCheck,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import PageTransition from '@/components/PageTransition';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { db, functions } from '@/config/firebase';
import { DEFAULT_OUTAGE_DETECTION_CONFIG } from '@/services/ispfy/regionAuditHelpers';
import type {
  ISPFYActiveRegionOutage,
  ISPFYOutageDetectionConfig,
  ISPFYOutageWatchRecord,
} from '@/types/ispfy';

type BillingStage = 'D-2' | 'D0' | 'D+5' | 'D+15';

interface IspfyAutomationsSettings {
  botEnabled?: boolean;
  josueAutoReply?: boolean;
  carenciaD1Enabled?: boolean;
  massOutageWhatsappEnabled?: boolean;
  outageConfig?: Partial<ISPFYOutageDetectionConfig>;
  outageMonitorHeartbeat?: {
    lastRunAtMs?: number;
    durationMs?: number;
    status?: string;
    globalAnomalyDetected?: boolean;
    globalActivePoints?: number;
    globalOnlinePoints?: number;
    skippedChronicOfflineCount?: number;
    activeCount?: number;
    resolvedCount?: number;
    whatsappSentCount?: number;
    blockedDispatchCount?: number;
    source?: string;
    lastError?: string | null;
  };
  billingRuler?: {
    enabled?: boolean;
    sendD2Reminder?: boolean;
    sendD0DueToday?: boolean;
    sendD5Overdue?: boolean;
    sendD15Warning?: boolean;
  };
  welcomeSync?: {
    enabled?: boolean;
    autoSendWhatsapp?: boolean;
    lastSyncAt?: string;
    lastRunAt?: unknown;
  };
}

interface BillingRulerLogItem {
  id: string;
  invoiceId?: string;
  stage?: string;
  clientId?: string;
  clientName?: string;
  phone?: string;
  dueIso?: string;
  valor?: unknown;
  hasPix?: boolean;
  status?: string;
  error?: string | null;
  sentAt?: unknown;
}

interface TurboLogItem {
  id: string;
  source?: string;
  idPonto?: string;
  idPlano?: string;
  planName?: string | null;
  clientName?: string | null;
  dataFinal?: string;
  whatsappSent?: boolean;
  createdAt?: unknown;
}

interface BillingDryRunItem {
  invoiceId: string;
  stage: string;
  clientId: string;
  clientName: string;
  hasPix?: boolean;
  status: string;
  previewMessage?: string;
}

interface BillingRulerCallableResult {
  todayIso?: string;
  processed?: number;
  sent?: number;
  items?: BillingDryRunItem[];
}

interface WelcomeSyncClientItem {
  clientId: string;
  nome: string;
  phone?: string;
  welcomeStatus: string;
}

interface WelcomeSyncCallableResult {
  dryRun: boolean;
  sinceIso: string;
  found: number;
  cachedCount: number;
  welcomeSentCount: number;
  clients: WelcomeSyncClientItem[];
}

interface MikrotikScriptResult {
  success?: boolean;
  script?: string;
}

const getErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

const formatTimestamp = (ts: unknown): string => {
  if (!ts) return '—';
  let date: Date;
  if (
    typeof ts === 'object' &&
    ts !== null &&
    'toDate' in ts &&
    typeof (ts as { toDate: () => Date }).toDate === 'function'
  ) {
    date = (ts as { toDate: () => Date }).toDate();
  } else if (typeof ts === 'string' || typeof ts === 'number' || ts instanceof Date) {
    date = new Date(ts);
  } else {
    return '—';
  }
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function Bots() {
  const [settings, setSettings] = useState<IspfyAutomationsSettings>({
    botEnabled: true,
    josueAutoReply: false,
    carenciaD1Enabled: true,
    massOutageWhatsappEnabled: true,
    billingRuler: {
      enabled: false,
      sendD2Reminder: true,
      sendD0DueToday: true,
      sendD5Overdue: true,
      sendD15Warning: true,
    },
    welcomeSync: {
      enabled: true,
      autoSendWhatsapp: false,
    },
    outageConfig: DEFAULT_OUTAGE_DETECTION_CONFIG,
  });
  const [outageCfgDraft, setOutageCfgDraft] = useState<ISPFYOutageDetectionConfig>(
    DEFAULT_OUTAGE_DETECTION_CONFIG
  );
  const [botGlobalActive, setBotGlobalActive] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Logs & collections
  const [billingLogs, setBillingLogs] = useState<BillingRulerLogItem[]>([]);
  const [d1SentCount, setD1SentCount] = useState(0);
  const [turboLogs, setTurboLogs] = useState<TurboLogItem[]>([]);
  const [outages, setOutages] = useState<ISPFYActiveRegionOutage[]>([]);
  const [outageWatches, setOutageWatches] = useState<ISPFYOutageWatchRecord[]>([]);

  // Régua de Cobrança runner
  const [billingStageFilter, setBillingStageFilter] = useState<'ALL' | BillingStage>('ALL');
  const [runningBilling, setRunningBilling] = useState(false);
  const [billingPreview, setBillingPreview] = useState<BillingDryRunItem[] | null>(null);
  const [billingSummary, setBillingSummary] = useState<string | null>(null);

  // Welcome Sync runner
  const [syncSinceDate, setSyncSinceDate] = useState('');
  const [runningWelcomeSync, setRunningWelcomeSync] = useState(false);
  const [welcomePreview, setWelcomePreview] = useState<WelcomeSyncCallableResult | null>(null);

  // Rompimentos Regionais form
  const [outageBairros, setOutageBairros] = useState('');
  const [outageCidade, setOutageCidade] = useState('');
  const [outageTitulo, setOutageTitulo] = useState('');
  const [outageMensagem, setOutageMensagem] = useState('');
  const [outagePrevisao, setOutagePrevisao] = useState('');
  const [savingOutage, setSavingOutage] = useState(false);
  const [runningOutageCron, setRunningOutageCron] = useState(false);

  // MikroTik Script Generator
  const [mikrotikType, setMikrotikType] = useState<'secrets' | 'binding'>('secrets');
  const [mikrotikKey, setMikrotikKey] = useState('');
  const [mikrotikTime, setMikrotikTime] = useState('');
  const [mikrotikIface, setMikrotikIface] = useState('');
  const [loadingScript, setLoadingScript] = useState(false);
  const [mikrotikScript, setMikrotikScript] = useState('');

  useEffect(() => {
    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'ispfy_automations'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as IspfyAutomationsSettings;
        setSettings((prev) => ({
          ...prev,
          ...data,
          billingRuler: {
            ...prev.billingRuler,
            ...(data.billingRuler || {}),
          },
          welcomeSync: {
            ...prev.welcomeSync,
            ...(data.welcomeSync || {}),
          },
          outageConfig: {
            ...DEFAULT_OUTAGE_DETECTION_CONFIG,
            ...(data.outageConfig || {}),
          },
        }));
        setOutageCfgDraft({
          ...DEFAULT_OUTAGE_DETECTION_CONFIG,
          ...(data.outageConfig || {}),
        });
      },
      (err) => console.warn('Erro ao observar settings/ispfy_automations:', err)
    );

    const unsubGlobalBot = onSnapshot(
      doc(db, 'bot_config', 'global'),
      (snap) => {
        if (snap.exists()) {
          setBotGlobalActive(snap.data()?.active !== false);
        }
      },
      (err) => console.warn('Erro ao observar bot_config/global:', err)
    );

    const unsubBillingLogs = onSnapshot(
      query(collection(db, 'billing_ruler_logs'), orderBy('sentAt', 'desc'), limit(25)),
      (snap) => {
        setBillingLogs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BillingRulerLogItem, 'id'>) }))
        );
      },
      (err) => console.warn('Erro ao observar billing_ruler_logs:', err)
    );

    const unsubD1 = onSnapshot(
      query(collection(db, 'carencia_d1_notifications'), limit(100)),
      (snap) => setD1SentCount(snap.size),
      (err) => console.warn('Erro ao observar carencia_d1_notifications:', err)
    );

    const unsubTurbo = onSnapshot(
      query(collection(db, 'ispfy_turbo_logs'), orderBy('createdAt', 'desc'), limit(15)),
      (snap) => {
        setTurboLogs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TurboLogItem, 'id'>) }))
        );
      },
      (err) => console.warn('Erro ao observar ispfy_turbo_logs:', err)
    );

    const unsubOutages = onSnapshot(
      query(collection(db, 'active_region_outages'), orderBy('updatedAt', 'desc'), limit(20)),
      (snap) => {
        setOutages(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ISPFYActiveRegionOutage, 'id'>),
          }))
        );
      },
      (err) => console.warn('Erro ao observar active_region_outages:', err)
    );

    const unsubWatch = onSnapshot(
      query(collection(db, 'outage_watch'), orderBy('lastSeenAtMs', 'desc'), limit(20)),
      (snap) => {
        setOutageWatches(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<ISPFYOutageWatchRecord, 'incidentKey'>),
            incidentKey: d.id,
          }))
        );
      },
      (err) => console.warn('Erro ao observar outage_watch:', err)
    );

    return () => {
      unsubSettings();
      unsubGlobalBot();
      unsubBillingLogs();
      unsubD1();
      unsubTurbo();
      unsubOutages();
      unsubWatch();
    };
  }, []);

  const updateAutomationSettings = async (
    keyLabel: string,
    patch: Partial<IspfyAutomationsSettings>,
    syncGlobalBotActive?: boolean
  ) => {
    setSavingKey(keyLabel);
    try {
      await setDoc(doc(db, 'settings', 'ispfy_automations'), patch, { merge: true });
      if (syncGlobalBotActive !== undefined) {
        await setDoc(
          doc(db, 'bot_config', 'global'),
          { active: syncGlobalBotActive },
          { merge: true }
        );
      }
      toast.success('Configuração de automação salva!');
    } catch (err: unknown) {
      console.error('Erro ao salvar settings/ispfy_automations:', err);
      toast.error(getErrorMessage(err, 'Erro ao salvar configuração.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleRunBillingRuler = async (dryRun: boolean) => {
    if (!dryRun) {
      const scope =
        billingStageFilter === 'ALL'
          ? 'TODOS os estágios (D-2, D0, D+5, D+15)'
          : `estágio ${billingStageFilter}`;
      const ok = window.confirm(
        `Confirma o disparo REAL de mensagens WhatsApp da Régua de Cobrança para ${scope}? Clientes que já receberam este estágio hoje não serão duplicados.`
      );
      if (!ok) return;
    }

    setRunningBilling(true);
    try {
      const fn = httpsCallable<Record<string, unknown>, BillingRulerCallableResult>(
        functions,
        'triggerIspfyBillingRuler'
      );
      const res = await fn({
        dryRun,
        forceRun: !dryRun,
        ...(billingStageFilter !== 'ALL' ? { stage: billingStageFilter } : {}),
      });
      const data = res.data;
      setBillingPreview(data?.items || []);
      setBillingSummary(
        dryRun
          ? `Simulação (${data?.todayIso || 'hoje'}): ${data?.processed || 0} cobrança(s) elegível(eis) — nenhuma mensagem enviada.`
          : `Execução concluída: ${data?.sent || 0} mensagem(ns) enviada(s) de ${data?.processed || 0} processada(s).`
      );
      toast.success(dryRun ? 'Simulação da régua concluída!' : 'Régua de cobrança executada!');
    } catch (err: unknown) {
      console.error('Erro na régua de cobrança:', err);
      toast.error(getErrorMessage(err, 'Erro ao executar régua de cobrança.'));
    } finally {
      setRunningBilling(false);
    }
  };

  const handleRunWelcomeSync = async (dryRun: boolean) => {
    if (!dryRun && settings.welcomeSync?.autoSendWhatsapp) {
      const ok = window.confirm(
        'Boas-vindas automáticas estão ATIVADAS. Novos clientes sincronizados receberão mensagem no WhatsApp (sem duplicidade). Deseja continuar?'
      );
      if (!ok) return;
    }

    setRunningWelcomeSync(true);
    try {
      const fn = httpsCallable<Record<string, unknown>, WelcomeSyncCallableResult>(
        functions,
        'triggerIspfyWelcomeSync'
      );
      const res = await fn({
        dryRun,
        ...(syncSinceDate.trim() ? { since: syncSinceDate.trim() } : {}),
      });
      setWelcomePreview(res.data);
      toast.success(
        dryRun
          ? `Simulação: ${res.data?.found || 0} cliente(s) novo(s) encontrado(s).`
          : `Sync concluído: ${res.data?.cachedCount || 0} em cache, ${res.data?.welcomeSentCount || 0} boas-vindas enviadas.`
      );
    } catch (err: unknown) {
      console.error('Erro no sync incremental:', err);
      toast.error(getErrorMessage(err, 'Erro ao sincronizar novos clientes ISPFY.'));
    } finally {
      setRunningWelcomeSync(false);
    }
  };

  const handleSaveRegionOutage = async (e: React.FormEvent) => {
    e.preventDefault();
    const bairrosList = outageBairros
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (bairrosList.length === 0 || !outageTitulo.trim() || !outageMensagem.trim()) {
      toast.warning('Informe pelo menos 1 bairro, o título e a mensagem para os assinantes.');
      return;
    }

    setSavingOutage(true);
    try {
      const fn = httpsCallable<Record<string, unknown>, { success?: boolean }>(
        functions,
        'ispfyToolActions'
      );
      await fn({
        action: 'set_region_outage',
        bairros: bairrosList,
        cidade: outageCidade.trim() || undefined,
        titulo: outageTitulo.trim(),
        mensagem: outageMensagem.trim(),
        previsaoRetorno: outagePrevisao.trim() || undefined,
      });
      toast.success('Aviso de rompimento ativado! O Bot WhatsApp e Josué IA já irão informar os clientes da região.');
      setOutageBairros('');
      setOutageTitulo('');
      setOutageMensagem('');
      setOutagePrevisao('');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Erro ao registrar rompimento regional.'));
    } finally {
      setSavingOutage(false);
    }
  };

  const handleResolveOutage = async (outageId: string) => {
    try {
      const fn = httpsCallable<Record<string, unknown>, { success?: boolean }>(
        functions,
        'ispfyToolActions'
      );
      await fn({
        action: 'set_region_outage',
        id: outageId,
        resolve: true,
      });
      toast.success('Rompimento marcado como normalizado!');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Erro ao encerrar rompimento.'));
    }
  };

  const handleRunOutageCronNow = async () => {
    setRunningOutageCron(true);
    try {
      const fn = httpsCallable<
        Record<string, unknown>,
        { activeCount?: number; resolvedCount?: number; whatsappSentKeys?: string[] }
      >(functions, 'syncMassOutageWatch');
      const res = await fn({ action: 'run_backend_now' });
      const data = res.data || {};
      toast.success(
        `Cloud Function 24h executada: ${data.activeCount ?? 0} rompimento(s) ativo(s), ${(data.whatsappSentKeys || []).length} alerta(s) enviado(s).`
      );
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Erro ao executar monitor 24h na Cloud Function.'));
    } finally {
      setRunningOutageCron(false);
    }
  };

  const handleSaveOutageConfig = async () => {
    const clamped: ISPFYOutageDetectionConfig = {
      minClientesOfflineRua: Math.min(100, Math.max(2, Number(outageCfgDraft.minClientesOfflineRua) || 4)),
      minPercentualRua: Math.min(100, Math.max(10, Number(outageCfgDraft.minPercentualRua) || 50)),
      minClientesOfflineBairro: Math.min(500, Math.max(2, Number(outageCfgDraft.minClientesOfflineBairro) || 6)),
      minPercentualBairro: Math.min(100, Math.max(10, Number(outageCfgDraft.minPercentualBairro) || 35)),
      ignorarOfflineAntigoHoras: Math.min(720, Math.max(0, Number(outageCfgDraft.ignorarOfflineAntigoHoras) || 0)),
      confirmarAoVivoAntesEnviar: outageCfgDraft.confirmarAoVivoAntesEnviar !== false,
      minChecagensConsecutivas: Math.min(20, Math.max(1, Number(outageCfgDraft.minChecagensConsecutivas) || 4)),
    };
    setOutageCfgDraft(clamped);
    await updateAutomationSettings('outageConfig', { outageConfig: clamped });
  };

  const handleGenerateMikrotikScript = async () => {
    if (!mikrotikKey.trim()) {
      toast.warning('Informe a chave (key) do servidor MikroTik cadastrado no ISPFY.');
      return;
    }
    setLoadingScript(true);
    try {
      const fn = httpsCallable<Record<string, unknown>, MikrotikScriptResult>(
        functions,
        'ispfyToolActions'
      );
      const res = await fn({
        action: 'get_mikrotik_script',
        scriptType: mikrotikType,
        key: mikrotikKey.trim(),
        time: mikrotikTime.trim() || undefined,
        iface: mikrotikIface.trim() || undefined,
      });
      setMikrotikScript(String(res.data?.script || ''));
      toast.success('Script MikroTik gerado diretamente do ISPFY!');
    } catch (err: unknown) {
      console.error('Erro ao gerar script MikroTik:', err);
      toast.error(getErrorMessage(err, 'Erro ao obter script de resgate MikroTik.'));
    } finally {
      setLoadingScript(false);
    }
  };

  const activeOutageCount = outages.filter((o) => o.ativa !== false && o.ativo !== false).length;
  const effectiveBotActive = botGlobalActive && settings.botEnabled !== false;

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              Central de Automações ISPFY & Bot WhatsApp
            </h1>
            <p className="text-sm text-muted-foreground">
              Controle em tempo real do Bot WhatsApp, Josué IA, Régua de Cobrança PIX, Carência D-1, Sync Incremental, Rompimentos e Scripts MikroTik.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              className={
                effectiveBotActive
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30'
              }
              variant="outline"
            >
              {effectiveBotActive ? 'Bot WhatsApp Ativo' : 'Bot WhatsApp Pausado'}
            </Badge>
            <Badge variant="outline">
              Josué IA: {settings.josueAutoReply ? 'Auto-Resposta ON' : 'Sob Demanda'}
            </Badge>
            {activeOutageCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                {activeOutageCount} Rompimento(s) Ativo(s)
              </Badge>
            )}
          </div>
        </div>

        {/* KPIs em tempo real */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Bot & Josué IA</p>
                <p className="text-lg font-bold mt-0.5">
                  {effectiveBotActive ? 'Online' : 'Pausado'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  IA Autônoma: {settings.josueAutoReply ? 'Ativa' : 'Inativa'}
                </p>
              </div>
              <Bot className="w-8 h-8 text-primary/70" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avisos Carência D-1</p>
                <p className="text-lg font-bold mt-0.5">{d1SentCount}</p>
                <p className="text-[11px] text-muted-foreground">
                  Status: {settings.carenciaD1Enabled !== false ? 'Ligado' : 'Desligado'}
                </p>
              </div>
              <Clock className="w-8 h-8 text-amber-500/70" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Régua de Cobrança</p>
                <p className="text-lg font-bold mt-0.5">
                  {settings.billingRuler?.enabled ? 'Diária 09h' : 'Manual / Off'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Últimos registros: {billingLogs.length}
                </p>
              </div>
              <Receipt className="w-8 h-8 text-emerald-500/70" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Turbos Aplicados</p>
                <p className="text-lg font-bold mt-0.5">{turboLogs.length}</p>
                <p className="text-[11px] text-muted-foreground">Roleta Pré-Mix & Painel</p>
              </div>
              <Flame className="w-8 h-8 text-cyan-500/70" />
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="bot" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="bot" className="gap-1.5">
              <Bot className="w-3.5 h-3.5" /> Bot & Josué IA
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-1.5">
              <Receipt className="w-3.5 h-3.5" /> Régua de Cobrança
            </TabsTrigger>
            <TabsTrigger value="welcome" className="gap-1.5">
              <UserCheck className="w-3.5 h-3.5" /> Boas-vindas & Sync
            </TabsTrigger>
            <TabsTrigger value="outages" className="gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" /> Rompimentos ({activeOutageCount})
            </TabsTrigger>
            <TabsTrigger value="mikrotik" className="gap-1.5">
              <Terminal className="w-3.5 h-3.5" /> MikroTik & Turbo
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: BOT & JOSUÉ IA */}
          <TabsContent value="bot" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-500" />
                      Bot WhatsApp Global
                    </span>
                    <Switch
                      disabled={savingKey === 'botEnabled'}
                      checked={effectiveBotActive}
                      onCheckedChange={(checked) =>
                        updateAutomationSettings('botEnabled', { botEnabled: checked }, checked)
                      }
                    />
                  </CardTitle>
                  <CardDescription>
                    Controla o webhook WhatsApp (`bot_config/global` + `botEnabled`) para menus, 2ª via PIX e desbloqueio.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-1">
                  <p>• Menus já utilizam `/api/tool/assinante/boleto` com PIX Copia e Cola direto.</p>
                  <p>• Proteção automática contra rompimentos regionais ativos.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-500" />
                      Josué IA (Gemini + ISPFY)
                    </span>
                    <Switch
                      disabled={savingKey === 'josueAutoReply'}
                      checked={settings.josueAutoReply === true}
                      onCheckedChange={(checked) =>
                        updateAutomationSettings('josueAutoReply', { josueAutoReply: checked })
                      }
                    />
                  </CardTitle>
                  <CardDescription>
                    Responde mensagens abertas no WhatsApp consultando cliente, status de ponto PPPoE, consumo, faturas PIX e abertura de O.S.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-1">
                  <p>• Ferramentas ISPFY nativas sem depender de servidor local.</p>
                  <p>• Pode ser ativado/desativado por conversa via `#josue:on` / `#josue:off`.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      Lembrete Carência D-1
                    </span>
                    <Switch
                      disabled={savingKey === 'carenciaD1Enabled'}
                      checked={settings.carenciaD1Enabled !== false}
                      onCheckedChange={(checked) =>
                        updateAutomationSettings('carenciaD1Enabled', { carenciaD1Enabled: checked })
                      }
                    />
                  </CardTitle>
                  <CardDescription>
                    Envia alerta amigável 1 dia antes do fim do Desbloqueio em Confiança já incluindo o PIX Copia e Cola da fatura em aberto.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-1">
                  <p>• Evita novo bloqueio automático por esquecimento.</p>
                  <p>• Idempotente: envia apenas 1 aviso por contrato/data final.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: RÉGUA DE COBRANÇA */}
          <TabsContent value="billing" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Régua de Cobrança Automática ISPFY</CardTitle>
                    <CardDescription>
                      Envia lembretes WhatsApp com PIX Copia e Cola e link do boleto nos estágios D-2, D0, D+5 e D+15 às 09:00 (America/Sao_Paulo).
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2.5 bg-muted/50 px-3 py-2 rounded-lg border">
                    <Label htmlFor="ruler-enabled" className="text-xs font-semibold cursor-pointer">
                      Cron Automático (09h)
                    </Label>
                    <Switch
                      id="ruler-enabled"
                      disabled={savingKey === 'billingRuler.enabled'}
                      checked={settings.billingRuler?.enabled === true}
                      onCheckedChange={(checked) =>
                        updateAutomationSettings('billingRuler.enabled', {
                          billingRuler: {
                            ...settings.billingRuler,
                            enabled: checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    {
                      key: 'sendD2Reminder' as const,
                      label: 'D-2 (Preventivo)',
                      desc: '2 dias antes do vencimento',
                    },
                    {
                      key: 'sendD0DueToday' as const,
                      label: 'D0 (Vence Hoje)',
                      desc: 'No dia do vencimento com PIX',
                    },
                    {
                      key: 'sendD5Overdue' as const,
                      label: 'D+5 (Lembrete)',
                      desc: '5 dias após vencimento',
                    },
                    {
                      key: 'sendD15Warning' as const,
                      label: 'D+15 (Pré-Bloqueio)',
                      desc: '15 dias em aberto',
                    },
                  ].map((st) => {
                    const isChecked = settings.billingRuler?.[st.key] !== false;
                    return (
                      <div
                        key={st.key}
                        className="p-3 rounded-lg border bg-background flex items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-xs font-semibold">{st.label}</p>
                          <p className="text-[11px] text-muted-foreground">{st.desc}</p>
                        </div>
                        <Switch
                          checked={isChecked}
                          disabled={savingKey === st.key}
                          onCheckedChange={(checked) =>
                            updateAutomationSettings(st.key, {
                              billingRuler: {
                                ...settings.billingRuler,
                                [st.key]: checked,
                              },
                            })
                          }
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t">
                  <div className="w-full sm:w-56">
                    <Select
                      value={billingStageFilter}
                      onValueChange={(v) => setBillingStageFilter(v as 'ALL' | BillingStage)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Filtrar estágio" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos os estágios (D-2, D0, D+5, D+15)</SelectItem>
                        <SelectItem value="D-2">Somente D-2</SelectItem>
                        <SelectItem value="D0">Somente D0 (Hoje)</SelectItem>
                        <SelectItem value="D+5">Somente D+5</SelectItem>
                        <SelectItem value="D+15">Somente D+15</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant="outline"
                    disabled={runningBilling}
                    onClick={() => handleRunBillingRuler(true)}
                    className="gap-1.5 text-xs"
                  >
                    {runningBilling ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Activity className="w-3.5 h-3.5" />
                    )}
                    Simular Elegíveis (Dry Run)
                  </Button>

                  <Button
                    disabled={runningBilling}
                    onClick={() => handleRunBillingRuler(false)}
                    className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {runningBilling ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    Executar Régua Agora (WhatsApp)
                  </Button>
                </div>

                {billingSummary && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-800 dark:text-blue-200 font-medium">
                    {billingSummary}
                  </div>
                )}

                {billingPreview && billingPreview.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold">Prévia / Resultado da Execução:</p>
                    <div className="max-h-72 overflow-y-auto border rounded-lg divide-y">
                      {billingPreview.map((item, idx) => (
                        <div key={`${item.invoiceId}-${idx}`} className="p-2.5 text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-semibold">
                              {item.clientName} <span className="text-muted-foreground">(Fatura #{item.invoiceId})</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline">{item.stage}</Badge>
                              {item.hasPix && (
                                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" variant="outline">
                                  PIX OK
                                </Badge>
                              )}
                              <Badge variant={item.status === 'error' ? 'destructive' : 'secondary'}>
                                {item.status}
                              </Badge>
                            </div>
                          </div>
                          {item.previewMessage && (
                            <p className="text-[11px] text-muted-foreground whitespace-pre-line bg-muted/40 p-2 rounded">
                              {item.previewMessage}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de Envios da Régua (Tempo Real)</CardTitle>
              </CardHeader>
              <CardContent>
                {billingLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">
                    Nenhum envio registrado na coleção `billing_ruler_logs` ainda.
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y border rounded-lg">
                    {billingLogs.map((log) => (
                      <div key={log.id} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <p className="font-semibold">
                            {log.clientName || `Cliente #${log.clientId}`}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Fatura #{log.invoiceId} • Venc: {log.dueIso || '—'} • {log.phone || 'sem telefone'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline">{log.stage}</Badge>
                          <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>
                            {log.status === 'sent' ? 'Enviado' : log.status || 'Erro'}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {formatTimestamp(log.sentAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: BOAS-VINDAS & SYNC */}
          <TabsContent value="welcome" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sync Incremental de Novos Clientes & Boas-vindas</CardTitle>
                <CardDescription>
                  Consulta `/tool/custom-party/appprovedor/clientes/ativos?data_insercao_apos=...` a cada 30 minutos para atualizar cache local e enviar boas-vindas do App Pré-Mix + PIX.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-lg border flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold">Cron Incremental (a cada 30 min)</p>
                      <p className="text-[11px] text-muted-foreground">
                        Último sync gravado: {settings.welcomeSync?.lastSyncAt || 'Padrão (últimos 2 dias)'}
                      </p>
                    </div>
                    <Switch
                      disabled={savingKey === 'welcomeSync.enabled'}
                      checked={settings.welcomeSync?.enabled !== false}
                      onCheckedChange={(checked) =>
                        updateAutomationSettings('welcomeSync.enabled', {
                          welcomeSync: {
                            ...settings.welcomeSync,
                            enabled: checked,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="p-3.5 rounded-lg border flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold">Disparo Automático de Boas-vindas WhatsApp</p>
                      <p className="text-[11px] text-muted-foreground">
                        Quando desligado, o sync apenas alimenta o cache Firestore sem enviar WhatsApp.
                      </p>
                    </div>
                    <Switch
                      disabled={savingKey === 'welcomeSync.autoSendWhatsapp'}
                      checked={settings.welcomeSync?.autoSendWhatsapp === true}
                      onCheckedChange={(checked) =>
                        updateAutomationSettings('welcomeSync.autoSendWhatsapp', {
                          welcomeSync: {
                            ...settings.welcomeSync,
                            autoSendWhatsapp: checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 pt-2 border-t">
                  <div className="space-y-1 sm:w-52">
                    <Label className="text-xs">Data inicial (opcional YYYY-MM-DD)</Label>
                    <Input
                      type="date"
                      value={syncSinceDate}
                      onChange={(e) => setSyncSinceDate(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <Button
                    variant="outline"
                    disabled={runningWelcomeSync}
                    onClick={() => handleRunWelcomeSync(true)}
                    className="gap-1.5 text-xs"
                  >
                    {runningWelcomeSync ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Simular Novos Clientes
                  </Button>
                  <Button
                    disabled={runningWelcomeSync}
                    onClick={() => handleRunWelcomeSync(false)}
                    className="gap-1.5 text-xs"
                  >
                    {runningWelcomeSync ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    Sincronizar Agora
                  </Button>
                </div>

                {welcomePreview && (
                  <div className="space-y-2 pt-2">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">Desde: {welcomePreview.sinceIso}</Badge>
                      <Badge variant="secondary">Encontrados: {welcomePreview.found}</Badge>
                      <Badge variant="secondary">Atualizados cache: {welcomePreview.cachedCount}</Badge>
                      <Badge className="bg-emerald-600 text-white">
                        Boas-vindas enviadas: {welcomePreview.welcomeSentCount}
                      </Badge>
                    </div>
                    {welcomePreview.clients?.length > 0 && (
                      <div className="max-h-56 overflow-y-auto divide-y border rounded-lg">
                        {welcomePreview.clients.map((cli) => (
                          <div
                            key={cli.clientId}
                            className="p-2 text-xs flex items-center justify-between gap-2"
                          >
                            <span>
                              <strong>{cli.nome}</strong> (#{cli.clientId}) — {cli.phone || 'sem fone'}
                            </span>
                            <Badge variant="outline">{cli.welcomeStatus}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: ROMPIMENTOS REGIONAIS */}
          <TabsContent value="outages" className="space-y-4">
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="w-4 h-4 text-amber-500" />
                      Sentinela 24h em Cloud Functions — Grupo EQUIPE AVL (&gt; 5 min)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Roda 24h nos servidores Firebase (`monitorIspfyMassOutagesCron`, a cada 1 min). Só envia WhatsApp para <strong>EQUIPE AVL</strong> com mín. de <strong>{outageCfgDraft.minClientesOfflineRua} clientes únicos</strong> e &ge; {outageCfgDraft.minPercentualRua}% na rua (ou mín. {outageCfgDraft.minClientesOfflineBairro} e &ge; {outageCfgDraft.minPercentualBairro}% no bairro), por &gt; 5 min em {outageCfgDraft.minChecagensConsecutivas} checagens seguidas, ignorando pontos offline &gt; {outageCfgDraft.ignorarOfflineAntigoHoras}h e com dupla checagem ao vivo.
                    </CardDescription>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {settings.outageMonitorHeartbeat?.lastRunAtMs ? (
                        <Badge
                          variant={
                            settings.outageMonitorHeartbeat.status === 'error'
                              ? 'destructive'
                              : settings.outageMonitorHeartbeat.status === 'anomaly_guard'
                              ? 'outline'
                              : 'secondary'
                          }
                          className="text-[10px] gap-1"
                        >
                          <Clock className="w-3 h-3" />
                          Última execução 24h:{' '}
                          {formatTimestamp(new Date(settings.outageMonitorHeartbeat.lastRunAtMs))}
                          {typeof settings.outageMonitorHeartbeat.durationMs === 'number'
                            ? ` (${(settings.outageMonitorHeartbeat.durationMs / 1000).toFixed(1)}s)`
                            : ''}
                          {' • '}
                          {settings.outageMonitorHeartbeat.status === 'error'
                            ? `Erro: ${settings.outageMonitorHeartbeat.lastError || 'falha'}`
                            : settings.outageMonitorHeartbeat.status === 'anomaly_guard'
                            ? `Disjuntor global (${settings.outageMonitorHeartbeat.globalOnlinePoints ?? 0}/${settings.outageMonitorHeartbeat.globalActivePoints ?? 0} online)`
                            : `${settings.outageMonitorHeartbeat.activeCount ?? 0} ativo(s)`}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Clock className="w-3 h-3" />
                          Cron 24h agendado a cada 1 min (`cloud_cron_1min`)
                        </Badge>
                      )}
                      {typeof settings.outageMonitorHeartbeat?.globalOnlinePoints === 'number' &&
                        typeof settings.outageMonitorHeartbeat?.globalActivePoints === 'number' && (
                          <Badge variant="outline" className="text-[10px]">
                            Base ativa: {settings.outageMonitorHeartbeat.globalOnlinePoints}/
                            {settings.outageMonitorHeartbeat.globalActivePoints} online
                          </Badge>
                        )}
                      {(settings.outageMonitorHeartbeat?.skippedChronicOfflineCount ?? 0) > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {settings.outageMonitorHeartbeat?.skippedChronicOfflineCount} offline antigo(s) ignorado(s)
                        </Badge>
                      )}
                      {(settings.outageMonitorHeartbeat?.blockedDispatchCount ?? 0) > 0 && (
                        <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300">
                          {settings.outageMonitorHeartbeat?.blockedDispatchCount} envio(s) bloqueado(s) ao vivo
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 text-xs gap-1.5"
                      disabled={runningOutageCron}
                      onClick={handleRunOutageCronNow}
                    >
                      {runningOutageCron ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      Executar Cloud 24h Agora
                    </Button>
                    <div className="flex items-center gap-2.5 bg-background px-3 py-2 rounded-lg border">
                      <Label htmlFor="outage-whatsapp-switch" className="text-xs font-semibold cursor-pointer">
                        Envio Auto EQUIPE AVL
                      </Label>
                      <Switch
                        id="outage-whatsapp-switch"
                        disabled={savingKey === 'massOutageWhatsappEnabled'}
                        checked={settings.massOutageWhatsappEnabled !== false}
                        onCheckedChange={(checked) =>
                          updateAutomationSettings('massOutageWhatsappEnabled', {
                            massOutageWhatsappEnabled: checked,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {settings.massOutageWhatsappEnabled === false && (
                  <div className="p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      <strong>Envio Auto EQUIPE AVL</strong> está desligado no momento — o monitoramento 24h continua avaliando e registrando abaixo, sem enviar mensagens até você reativar a chave acima.
                    </span>
                  </div>
                )}

                <div className="p-3 rounded-lg border bg-background/70 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                      Travas Anti-Falso-Positivo (Aplicadas no Navegador e na Cloud 24h)
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Deduplica múltiplos pontos do mesmo cliente e aciona disjuntor se &lt; 10% online
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Mín. clientes (Rua)</Label>
                      <Input
                        type="number"
                        min={2}
                        max={100}
                        className="h-8 text-xs"
                        value={outageCfgDraft.minClientesOfflineRua}
                        onChange={(e) =>
                          setOutageCfgDraft((p) => ({
                            ...p,
                            minClientesOfflineRua: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">% offline (Rua)</Label>
                      <Input
                        type="number"
                        min={10}
                        max={100}
                        className="h-8 text-xs"
                        value={outageCfgDraft.minPercentualRua}
                        onChange={(e) =>
                          setOutageCfgDraft((p) => ({
                            ...p,
                            minPercentualRua: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Mín. clientes (Bairro)</Label>
                      <Input
                        type="number"
                        min={2}
                        max={500}
                        className="h-8 text-xs"
                        value={outageCfgDraft.minClientesOfflineBairro}
                        onChange={(e) =>
                          setOutageCfgDraft((p) => ({
                            ...p,
                            minClientesOfflineBairro: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">% offline (Bairro)</Label>
                      <Input
                        type="number"
                        min={10}
                        max={100}
                        className="h-8 text-xs"
                        value={outageCfgDraft.minPercentualBairro}
                        onChange={(e) =>
                          setOutageCfgDraft((p) => ({
                            ...p,
                            minPercentualBairro: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Ignorar off &gt; (h)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={720}
                        className="h-8 text-xs"
                        value={outageCfgDraft.ignorarOfflineAntigoHoras}
                        onChange={(e) =>
                          setOutageCfgDraft((p) => ({
                            ...p,
                            ignorarOfflineAntigoHoras: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Checagens seguidas</Label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        className="h-8 text-xs"
                        value={outageCfgDraft.minChecagensConsecutivas}
                        onChange={(e) =>
                          setOutageCfgDraft((p) => ({
                            ...p,
                            minChecagensConsecutivas: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="live-verify-switch"
                        checked={outageCfgDraft.confirmarAoVivoAntesEnviar}
                        onCheckedChange={(checked) =>
                          setOutageCfgDraft((p) => ({
                            ...p,
                            confirmarAoVivoAntesEnviar: checked,
                          }))
                        }
                      />
                      <Label htmlFor="live-verify-switch" className="text-xs cursor-pointer">
                        Confirmar ao vivo no ISPFY (`/ponto/status`) antes de enviar ao grupo
                      </Label>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={savingKey === 'outageConfig'}
                      onClick={handleSaveOutageConfig}
                    >
                      {savingKey === 'outageConfig' && (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      )}
                      Salvar Filtros Anti-Falso-Positivo
                    </Button>
                  </div>
                </div>

                {outageWatches.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Nenhum episódio de rua/bairro em observação ou histórico recente em `outage_watch`.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {outageWatches.map((w) => (
                      <div
                        key={w.incidentKey}
                        className={`p-2.5 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          w.active ? 'border-amber-500/50 bg-background' : 'bg-muted/30 opacity-80'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={w.active ? 'destructive' : 'secondary'} className="text-[10px]">
                              {w.active ? 'Ativo' : 'Normalizado'}
                            </Badge>
                            {typeof w.consecutiveHits === 'number' && (
                              <Badge variant="outline" className="text-[10px]">
                                {w.consecutiveHits} checagem(ns)
                              </Badge>
                            )}
                            <span className="font-bold truncate">
                              {w.ruaLabel ? `${w.ruaLabel} — ${w.bairroLabel}` : w.bairroLabel}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {w.ruaLabel ? `Rua: ${w.offlineRua}/${w.totalRua} clientes off (${w.percentualRua}%) • ` : ''}
                            Bairro: {w.offlineBairro}/{w.totalBairro} clientes off ({w.percentualBairro}%)
                            {(w.offlineAntigosIgnorados ?? 0) > 0
                              ? ` • ${w.offlineAntigosIgnorados} antigo(s) ignorado(s)`
                              : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          {w.whatsappSentAtMs ? (
                            <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Enviado EQUIPE AVL ({formatTimestamp(new Date(w.whatsappSentAtMs))})
                              {typeof w.verifiedLiveOfflineCount === 'number'
                                ? ` • Ao vivo: ${w.verifiedLiveOfflineCount}`
                                : ''}
                            </Badge>
                          ) : w.whatsappBlockedReason ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-amber-500/50 text-amber-700 dark:text-amber-300"
                            >
                              Bloqueado: {w.whatsappBlockedReason}
                            </Badge>
                          ) : w.whatsappError ? (
                            <Badge variant="destructive" className="text-[10px]">
                              Erro: {w.whatsappError}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Clock className="w-3 h-3" />
                              Início: {formatTimestamp(new Date(w.firstDetectedAtMs))}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Registrar Aviso de Rompimento (Bot + Josué IA)</CardTitle>
                  <CardDescription>
                    Enquanto ativo, qualquer assinante dos bairros abaixo que chamar no WhatsApp é informado da manutenção antes de abrir múltiplas O.S.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveRegionOutage} className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Bairros afetados (separados por vírgula) *</Label>
                      <Input
                        placeholder="Ex: Centro, Vila Nova, Jardim América"
                        value={outageBairros}
                        onChange={(e) => setOutageBairros(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Cidade (opcional)</Label>
                        <Input
                          placeholder="Ex: Curitiba"
                          value={outageCidade}
                          onChange={(e) => setOutageCidade(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Previsão de retorno (opcional)</Label>
                        <Input
                          placeholder="Ex: Hoje às 18h30"
                          value={outagePrevisao}
                          onChange={(e) => setOutagePrevisao(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Título / Motivo *</Label>
                      <Input
                        placeholder="Ex: Rompimento de fibra tronco por descarga elétrica"
                        value={outageTitulo}
                        onChange={(e) => setOutageTitulo(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Mensagem para os assinantes *</Label>
                      <Textarea
                        placeholder="Nossa equipe de fusão óptica já está no local restabelecendo o sinal..."
                        value={outageMensagem}
                        onChange={(e) => setOutageMensagem(e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                    <Button type="submit" disabled={savingOutage} className="w-full gap-1.5">
                      {savingOutage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Radio className="w-4 h-4" />
                      )}
                      Ativar Aviso Regional no Bot & IA
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Avisos Regionais Registrados</CardTitle>
                  <CardDescription>
                    Você também pode ativar avisos em 1 clique direto pela tela Saúde por Região ou Alerta Global.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5 max-h-[420px] overflow-y-auto">
                  {outages.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-6">
                      Nenhum rompimento registrado em `active_region_outages`.
                    </p>
                  ) : (
                    outages.map((o) => {
                      const isActive = o.ativa !== false && o.ativo !== false;
                      const bairrosLabel = Array.isArray(o.bairros)
                        ? o.bairros.join(', ')
                        : o.bairro || 'Região não informada';
                      return (
                        <div
                          key={o.id}
                          className={`p-3 rounded-lg border space-y-1.5 ${
                            isActive ? 'border-red-500/40 bg-red-500/5' : 'bg-muted/30 opacity-75'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold">{o.titulo || o.motivo || 'Manutenção'}</p>
                              <p className="text-[11px] text-muted-foreground">
                                Bairros: <strong>{bairrosLabel}</strong>
                                {o.cidade ? ` (${o.cidade})` : ''}
                              </p>
                            </div>
                            <Badge variant={isActive ? 'destructive' : 'secondary'}>
                              {isActive ? 'Ativo' : 'Normalizado'}
                            </Badge>
                          </div>
                          {o.mensagem && <p className="text-[11px]">{o.mensagem}</p>}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-muted-foreground">
                              {o.previsaoRetorno ? `Previsão: ${o.previsaoRetorno}` : formatTimestamp(o.updatedAt)}
                            </span>
                            {isActive && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] gap-1"
                                onClick={() => handleResolveOutage(o.id)}
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Encerrar Aviso
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 5: MIKROTIK RESCUE SCRIPT & LOGS TURBO */}
          <TabsContent value="mikrotik" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-primary" />
                    Script de Resgate MikroTik (`/tool/mikrotik/script`)
                  </CardTitle>
                  <CardDescription>
                    Baixe scripts RouterOS de backup offline de PPPoE Secrets ou IP-Binding em caso de queda de link entre concentrador e ERP.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo de Script</Label>
                      <Select
                        value={mikrotikType}
                        onValueChange={(v) => setMikrotikType(v as 'secrets' | 'binding')}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="secrets">PPPoE Secrets (`/script/secrets`)</SelectItem>
                          <SelectItem value="binding">Hotspot IP-Binding (`/script/binding`)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Chave (key) do MikroTik *</Label>
                      <Input
                        placeholder="Chave configurada no ISPFY"
                        value={mikrotikKey}
                        onChange={(e) => setMikrotikKey(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Intervalo/Tempo (opcional)</Label>
                      <Input
                        placeholder="Ex: 00:05:00"
                        value={mikrotikTime}
                        onChange={(e) => setMikrotikTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Interface WAN/Bridge (opcional)</Label>
                      <Input
                        placeholder="Ex: ether1-wan"
                        value={mikrotikIface}
                        onChange={(e) => setMikrotikIface(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    disabled={loadingScript}
                    onClick={handleGenerateMikrotikScript}
                    className="w-full gap-1.5"
                  >
                    {loadingScript ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    Gerar Script RouterOS (.rsc)
                  </Button>

                  {mikrotikScript && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">Script Gerado:</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            navigator.clipboard
                              .writeText(mikrotikScript)
                              .then(() => toast.success('Script copiado!'))
                              .catch(() => toast.error('Erro ao copiar script.'));
                          }}
                        >
                          <Copy className="w-3 h-3" /> Copiar
                        </Button>
                      </div>
                      <pre className="p-3 rounded-lg bg-slate-950 text-emerald-300 text-[11px] font-mono max-h-60 overflow-auto border">
                        {mikrotikScript}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Flame className="w-4 h-4 text-cyan-500" />
                    Histórico de Turbos de Velocidade Aplicados
                  </CardTitle>
                  <CardDescription>
                    Ativações feitas via Roleta Pré-Mix ou diretamente na ficha do assinante (`/tool/assinante/plano/teste`).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {turboLogs.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-6">
                      Nenhum Turbo registrado em `ispfy_turbo_logs` ainda.
                    </p>
                  ) : (
                    <div className="max-h-80 overflow-y-auto divide-y border rounded-lg">
                      {turboLogs.map((t) => (
                        <div key={t.id} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                          <div>
                            <p className="font-semibold">
                              {t.clientName || `Ponto #${t.idPonto}`}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {t.planName || `Plano #${t.idPlano || '—'}`} • Até: {t.dataFinal || '—'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline">
                              {t.source === 'pre_mix_roulette' ? 'Roleta Pré-Mix' : t.source || 'Painel'}
                            </Badge>
                            {t.whatsappSent && (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" variant="outline">
                                Zap OK
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
