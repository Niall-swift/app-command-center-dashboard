import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquare,
  Radar,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Signal,
  Sparkles,
  Star,
  UserPlus,
  Wifi,
} from 'lucide-react';
import { toast } from 'sonner';
import PageTransition from '@/components/PageTransition';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db, functions } from '@/config/firebase';
import { useNetworkMonitor } from '@/contexts/NetworkMonitorContext';
import { ispfyService } from '@/services/ispfy/ispfyService';
import { smartOltService } from '@/services/smartolt/smartOltService';
import { whapiService, DEFAULT_AVL_WHATSAPP_GROUPS } from '@/services/whapi/whapiService';
import type {
  ISPFYBandwidthSummary30d,
  ISPFYCaixaData,
  ISPFYClientRegionRecord,
  ISPFYGeoFiberSplitter,
} from '@/types/ispfy';
import type { SmartOltOnu } from '@/types/smartOlt';

interface CtoMatchItem {
  cto: ISPFYCaixaData;
  distanceMeters: number;
  capacity: number;
  occupied: number;
  freePorts: number;
  lat: number;
  lng: number;
}

interface OpticalRadarItem {
  onu: SmartOltOnu;
  rxDbm: number | null;
  matchedClient?: ISPFYClientRegionRecord;
}

interface UpgradeCandidateItem {
  record: ISPFYClientRegionRecord;
  usage: ISPFYBandwidthSummary30d;
  totalGb: number;
}

interface CsatResponseItem {
  id: string;
  kind?: string;
  ticketId?: string | null;
  chatId?: string;
  clientName?: string;
  clientPhone?: string;
  score?: number;
  label?: string;
  createdAtMs?: number;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function parseCoord(v?: string | number | null): number {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

export default function ISPFYInteligencia() {
  const navigate = useNavigate();
  const { dadosRegiao } = useNetworkMonitor();

  // Tab 1: Viabilidade por CTO + Novo Cliente
  const [ctos, setCtos] = useState<ISPFYCaixaData[]>([]);
  const [splitters, setSplitters] = useState<ISPFYGeoFiberSplitter[]>([]);
  const [loadingCtos, setLoadingCtos] = useState(false);
  const [cepQuery, setCepQuery] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [checkingViability, setCheckingViability] = useState(false);
  const [viabilityMatches, setViabilityMatches] = useState<CtoMatchItem[]>([]);

  // Form Novo Assinante ISPFY
  const [leadNome, setLeadNome] = useState('');
  const [leadCpf, setLeadCpf] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadRua, setLeadRua] = useState('');
  const [leadNumero, setLeadNumero] = useState('');
  const [leadBairro, setLeadBairro] = useState('');
  const [leadCidade, setLeadCidade] = useState('');
  const [openInstallOs, setOpenInstallOs] = useState(true);
  const [sendWelcomeWa, setSendWelcomeWa] = useState(true);
  const [creatingLead, setCreatingLead] = useState(false);

  // Tab 2: Radar Preventivo Óptico (SmartOLT x ISPFY)
  const [loadingOptical, setLoadingOptical] = useState(false);
  const [opticalItems, setOpticalItems] = useState<OpticalRadarItem[]>([]);
  const [opticalThreshold, setOpticalThreshold] = useState(-26);

  // Tab 3: Radar de Upgrade & Consumo 30d + Turbo
  const [upgradeFilterPlan, setUpgradeFilterPlan] = useState('');
  const [upgradeSampleSize, setUpgradeSampleSize] = useState(20);
  const [scanningUpgrades, setScanningUpgrades] = useState(false);
  const [upgradeCandidates, setUpgradeCandidates] = useState<UpgradeCandidateItem[]>([]);
  const [activatingTurboId, setActivatingTurboId] = useState<string | null>(null);

  // Tab 4: Pesquisa CSAT Pós-Atendimento (Firestore tempo real)
  const [csatResponses, setCsatResponses] = useState<CsatResponseItem[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'os_csat_responses'),
      orderBy('createdAtMs', 'desc'),
      limit(100)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCsatResponses(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CsatResponseItem, 'id'>) }))
        );
      },
      () => undefined
    );
    return () => unsub();
  }, []);

  const loadGeoFiberData = async () => {
    setLoadingCtos(true);
    try {
      const [ctoList, splitterList] = await Promise.all([
        ispfyService.fetchAllCaixasComCoordenadas().catch(() => ispfyService.getCaixasFTTH()),
        ispfyService.getGeoFiberSplitters().catch(() => []),
      ]);
      setCtos(ctoList || []);
      setSplitters(splitterList || []);
      toast.success(`${(ctoList || []).length} CTOs carregadas do ISPFY GeoFiber!`);
    } catch {
      toast.error('Erro ao carregar CTOs do ISPFY.');
    } finally {
      setLoadingCtos(false);
    }
  };

  useEffect(() => {
    loadGeoFiberData();
  }, []);

  const handleLookupCep = async () => {
    const cleanCep = cepQuery.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      toast.warning('Informe um CEP válido com 8 dígitos.');
      return;
    }
    setCheckingViability(true);
    try {
      const viaResp = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const viaData = await viaResp.json();
      if (viaData?.erro) {
        toast.error('CEP não encontrado.');
        return;
      }
      const fullAddr = `${viaData.logradouro || ''}, ${viaData.bairro || ''}, ${viaData.localidade || ''} - ${viaData.uf || ''}`;
      setAddressQuery(fullAddr);
      setLeadRua(viaData.logradouro || '');
      setLeadBairro(viaData.bairro || '');
      setLeadCidade(viaData.localidade || '');

      // Tenta geocodificar endereço via Nominatim OpenStreetMap
      const geoResp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
          `${viaData.logradouro || ''} ${viaData.bairro || ''} ${viaData.localidade || ''} Brasil`
        )}`
      );
      const geoData = await geoResp.json();
      if (Array.isArray(geoData) && geoData[0]?.lat && geoData[0]?.lon) {
        setLatInput(String(geoData[0].lat));
        setLngInput(String(geoData[0].lon));
        computeViability(Number(geoData[0].lat), Number(geoData[0].lon));
      } else {
        toast.info('Endereço preenchido! Informe Latitude/Longitude para calcular distância exata das CTOs.');
      }
    } catch {
      toast.error('Falha ao consultar CEP/coordenadas.');
    } finally {
      setCheckingViability(false);
    }
  };

  const computeViability = (targetLat?: number, targetLng?: number) => {
    const lat = targetLat ?? parseCoord(latInput);
    const lng = targetLng ?? parseCoord(lngInput);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.warning('Informe latitude e longitude válidas ou busque pelo CEP.');
      return;
    }

    const splitterCapByCto = new Map<string, number>();
    for (const sp of splitters) {
      const ctoId = String(sp.id_cto || sp.id_caixa || '');
      const vias = Number(sp.portas || sp.vias || sp.capacidade || 0);
      if (ctoId && vias > 0) {
        splitterCapByCto.set(ctoId, (splitterCapByCto.get(ctoId) || 0) + vias);
      }
    }

    const ranked: CtoMatchItem[] = [];
    for (const cto of ctos) {
      const cLat = parseCoord(cto.latitude);
      const cLng = parseCoord(cto.longitude);
      if (!Number.isFinite(cLat) || !Number.isFinite(cLng) || (cLat === 0 && cLng === 0)) {
        continue;
      }
      const dist = haversineMeters(lat, lng, cLat, cLng);
      const cap =
        Number(cto.capacidade || 0) ||
        splitterCapByCto.get(String(cto.id || '')) ||
        16;
      const occ = Number(cto.ocupacao || 0);
      ranked.push({
        cto,
        distanceMeters: dist,
        capacity: cap,
        occupied: occ,
        freePorts: Math.max(0, cap - occ),
        lat: cLat,
        lng: cLng,
      });
    }

    ranked.sort((a, b) => a.distanceMeters - b.distanceMeters);
    setViabilityMatches(ranked.slice(0, 6));
    if (ranked.length === 0) {
      toast.warning('Nenhuma CTO com coordenadas GPS encontrada no ISPFY.');
    }
  };

  const handleConvertLeadToIspfy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadNome.trim() || !leadCpf.trim()) {
      toast.warning('Nome completo e CPF/CNPJ são obrigatórios.');
      return;
    }
    setCreatingLead(true);
    try {
      const fn = httpsCallable<
        Record<string, unknown>,
        { success?: boolean; created?: { id?: string; message?: string } }
      >(functions, 'ispfyToolActions');
      const res = await fn({
        action: 'create_lead_client',
        openInstallTicket: openInstallOs,
        ticketAssunto: 'Instalação de Novo Assinante (Viabilidade CTO)',
        ticketDescricao: `Instalação gerada pela Central de Inteligência AVL. Endereço: ${leadRua}, ${leadNumero} - ${leadBairro} (${leadCidade}).`,
        payload: {
          nome_razao: leadNome.trim(),
          cpf_cnpj: leadCpf.replace(/\D/g, ''),
          telefone_celular: leadPhone.replace(/\D/g, ''),
          cep: cepQuery.replace(/\D/g, ''),
          endereco: leadRua.trim(),
          numero: leadNumero.trim() || 'S/N',
          bairro: leadBairro.trim(),
          cidade: leadCidade.trim(),
        },
      });

      if (!res.data?.success) {
        toast.error(res.data?.created?.message || 'Não foi possível criar o assinante no ISPFY.');
        return;
      }

      const newId = res.data.created?.id;
      toast.success(
        `Novo assinante criado no ISPFY${newId ? ` (#${newId})` : ''}!${
          openInstallOs ? ' O.S. de instalação aberta.' : ''
        }`
      );

      if (sendWelcomeWa && leadPhone.replace(/\D/g, '').length >= 10) {
        const firstName = leadNome.trim().split(' ')[0];
        await whapiService.sendMessage({
          to: leadPhone,
          body:
            `🎉 *Bem-vindo(a) à AVL Telecom, ${firstName}!*\n\n` +
            `Seu cadastro foi aprovado com sucesso e já estamos programando a instalação da sua fibra óptica em *${leadBairro || 'seu endereço'}*.\n\n` +
            `Qualquer dúvida, basta responder por aqui! 🚀📶`,
        });
      }

      setLeadNome('');
      setLeadCpf('');
      setLeadPhone('');
      setLeadNumero('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar novo cliente.');
    } finally {
      setCreatingLead(false);
    }
  };

  const handleScanOpticalSignal = async () => {
    setLoadingOptical(true);
    try {
      const onus = await smartOltService.getOnus({ limit: 400 });
      if (!onus || onus.length === 0) {
        toast.info('Nenhuma ONU retornada pelo SmartOLT. Verifique VITE_SMARTOLT_API_KEY.');
        setOpticalItems([]);
        return;
      }

      // Prioriza ONUs em LOS/Offline + amostra de ONUs online para medir RX
      const criticalStatus = onus.filter((o) => o.status === 'los' || o.status === 'offline');
      const onlineSample = onus.filter((o) => o.status === 'online').slice(0, 25);

      const recordsByName = new Map<string, ISPFYClientRegionRecord>();
      for (const r of dadosRegiao?.records || []) {
        recordsByName.set(r.nome.toLowerCase(), r);
        if (r.usuarioPppoe) recordsByName.set(r.usuarioPppoe.toLowerCase(), r);
      }

      const matchClient = (onu: SmartOltOnu) => {
        const key = (onu.name || '').toLowerCase();
        if (recordsByName.has(key)) return recordsByName.get(key);
        return (dadosRegiao?.records || []).find(
          (r) =>
            key.includes(r.nome.toLowerCase().slice(0, 12)) ||
            (r.usuarioPppoe && key.includes(r.usuarioPppoe.toLowerCase()))
        );
      };

      const found: OpticalRadarItem[] = criticalStatus.map((onu) => ({
        onu,
        rxDbm: null,
        matchedClient: matchClient(onu),
      }));

      // Consulta sinal em lotes de 5
      for (let i = 0; i < onlineSample.length; i += 5) {
        const batch = onlineSample.slice(i, i + 5);
        const settled = await Promise.allSettled(
          batch.map((o) => smartOltService.getOnuSignal(o.id || o.onuid))
        );
        settled.forEach((res, idx) => {
          if (res.status === 'fulfilled' && res.value) {
            const rx = Number(res.value.rx_power_numeric);
            if (Number.isFinite(rx) && rx <= opticalThreshold) {
              found.push({
                onu: batch[idx],
                rxDbm: rx,
                matchedClient: matchClient(batch[idx]),
              });
            }
          }
        });
      }

      found.sort((a, b) => (a.rxDbm ?? -99) - (b.rxDbm ?? -99));
      setOpticalItems(found);
      toast.success(`Varredura óptica concluída: ${found.length} ONU(s) críticas/sinal baixo.`);
    } catch {
      toast.error('Erro ao consultar SmartOLT.');
    } finally {
      setLoadingOptical(false);
    }
  };

  const handleScanUpgradeCandidates = async () => {
    const onlineRecords = (dadosRegiao?.records || []).filter(
      (r) =>
        r.connectionHealth === 'ok' &&
        (!upgradeFilterPlan.trim() ||
          r.plano.toLowerCase().includes(upgradeFilterPlan.trim().toLowerCase()))
    );
    if (onlineRecords.length === 0) {
      toast.warning('Aguarde o carregamento da base de clientes online ou ajuste o filtro de plano.');
      return;
    }

    setScanningUpgrades(true);
    setUpgradeCandidates([]);
    try {
      const sample = onlineRecords.slice(0, Math.min(40, Math.max(5, upgradeSampleSize)));
      const collected: UpgradeCandidateItem[] = [];

      for (let i = 0; i < sample.length; i += 5) {
        const batch = sample.slice(i, i + 5);
        const settled = await Promise.allSettled(
          batch.map((r) => ispfyService.getBandwidthSummary30Days(r.pontoId))
        );
        settled.forEach((res, idx) => {
          if (res.status === 'fulfilled' && res.value) {
            const totalGb = res.value.downloadGb + res.value.uploadGb;
            if (totalGb > 0) {
              collected.push({
                record: batch[idx],
                usage: res.value,
                totalGb,
              });
            }
          }
        });
      }

      collected.sort((a, b) => b.totalGb - a.totalGb);
      setUpgradeCandidates(collected);
      toast.success(`${collected.length} cliente(s) ranqueados por consumo real dos últimos 30 dias!`);
    } finally {
      setScanningUpgrades(false);
    }
  };

  const handleOfferTurboUpgrade = async (item: UpgradeCandidateItem) => {
    setActivatingTurboId(item.record.pontoId);
    try {
      const plans = await ispfyService.getTestablePlans(item.record.pontoId, false, false);
      if (!plans || plans.length === 0) {
        toast.warning('Nenhum plano superior testável disponível para este ponto no ISPFY.');
        return;
      }
      const topPlan = [...plans].sort(
        (a, b) => Number(b.velocidade_download || 0) - Number(a.velocidade_download || 0)
      )[0];
      const finalDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await ispfyService.activatePlanTest(
        item.record.pontoId,
        String(topPlan.id),
        finalDate
      );

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(`Turbo 7 dias ativado para ${item.record.nome}!`);
      if (item.record.telefone) {
        const firstName = item.record.nome.split(' ')[0];
        await whapiService.sendMessage({
          to: item.record.telefone,
          body:
            `🚀 *Presente Especial da AVL Telecom, ${firstName}!*\n\n` +
            `Notamos que você usa bastante internet por aí (${item.totalGb.toFixed(0)} GB no último mês) e liberamos gratuitamente um *Turbo de Velocidade* no seu plano até *${finalDate
              .split('-')
              .reverse()
              .join('/')}*! ⚡\n\n` +
            `Aproveite para testar — se quiser manter essa velocidade fixa, basta responder *QUERO UPGRADE*! 💙`,
        });
        toast.success('Convite de Upgrade + aviso do Turbo enviados no WhatsApp!');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao ativar Turbo.');
    } finally {
      setActivatingTurboId(null);
    }
  };

  const csatStats = useMemo(() => {
    const total = csatResponses.length;
    const positive = csatResponses.filter((r) => (r.score ?? 0) >= 4).length;
    const problems = csatResponses.filter((r) => (r.score ?? 0) <= 2).length;
    const pct = total > 0 ? Math.round((positive / total) * 100) : 0;
    return { total, positive, problems, pct };
  }, [csatResponses]);

  const bestCto = viabilityMatches[0] || null;
  const isViable = Boolean(bestCto && bestCto.distanceMeters <= 350 && bestCto.freePorts > 0);

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="rounded-2xl p-5 bg-gradient-to-r from-indigo-600/15 via-violet-600/10 to-emerald-500/10 border border-indigo-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Radar className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-foreground">
                Central de Inteligência ISPFY &amp; Z-API
              </h2>
              <Badge className="bg-violet-600 text-white text-[10px]">PROATIVO</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Viabilidade técnica por CTO GeoFiber, conversão direta de leads, radar preventivo de sinal óptico, ranking de consumo para Upgrade/Turbo e painel CSAT pós-atendimento.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadGeoFiberData} disabled={loadingCtos} className="gap-1.5 shrink-0">
            {loadingCtos ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Atualizar CTOs ({ctos.length})
          </Button>
        </div>

        <Tabs defaultValue="viability" className="space-y-4">
          <TabsList className="grid grid-cols-2 lg:grid-cols-4 h-auto p-1 gap-1">
            <TabsTrigger value="viability" className="gap-1.5 text-xs py-2">
              <MapPin className="w-3.5 h-3.5" />
              Viabilidade CTO &amp; Lead
            </TabsTrigger>
            <TabsTrigger value="optical" className="gap-1.5 text-xs py-2">
              <Signal className="w-3.5 h-3.5" />
              Radar Óptico Preventivo
            </TabsTrigger>
            <TabsTrigger value="upgrades" className="gap-1.5 text-xs py-2">
              <Rocket className="w-3.5 h-3.5" />
              Radar Upgrade &amp; Turbo
            </TabsTrigger>
            <TabsTrigger value="csat" className="gap-1.5 text-xs py-2">
              <Star className="w-3.5 h-3.5" />
              Satisfação CSAT ({csatStats.total})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: VIABILIDADE CTO + NOVO CLIENTE */}
          <TabsContent value="viability" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  Consultar Viabilidade por CTO (GeoFiber ISPFY)
                </CardTitle>
                <CardDescription className="text-xs">
                  Digite o CEP ou Latitude/Longitude do interessado para localizar as CTOs mais próximas e conferir portas livres.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="CEP (ex: 26070-000)"
                    value={cepQuery}
                    onChange={(e) => setCepQuery(e.target.value)}
                    className="h-9 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleLookupCep}
                    disabled={checkingViability}
                    className="gap-1.5 shrink-0"
                  >
                    {checkingViability ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    Buscar CEP
                  </Button>
                </div>

                {addressQuery && (
                  <p className="text-xs text-muted-foreground bg-muted/40 p-2 rounded-lg border">
                    📍 {addressQuery}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Latitude (ex: -22.71)"
                    value={latInput}
                    onChange={(e) => setLatInput(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                  <Input
                    placeholder="Longitude (ex: -43.43)"
                    value={lngInput}
                    onChange={(e) => setLngInput(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={() => computeViability()}>
                    Calcular CTOs
                  </Button>
                </div>

                {bestCto && (
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                      isViable
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-amber-500/40 bg-amber-500/10'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold">
                        {isViable
                          ? '✅ VIABILIDADE CONFIRMADA'
                          : bestCto.freePorts === 0
                          ? '⚠️ CTO MAIS PRÓXIMA LOTADA'
                          : '⚠️ DISTÂNCIA ACIMA DE 350m'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Mais próxima: <strong>{bestCto.cto.nome || bestCto.cto.codigo || `CTO #${bestCto.cto.id}`}</strong> — {bestCto.distanceMeters}m • {bestCto.freePorts} porta(s) livre(s)
                      </p>
                    </div>
                    <a
                      href={`https://maps.google.com/?q=${bestCto.lat},${bestCto.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline shrink-0"
                    >
                      Maps <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {viabilityMatches.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {viabilityMatches.map((item) => (
                      <div
                        key={String(item.cto.id)}
                        className="p-2.5 rounded-lg border bg-muted/20 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold truncate">
                            {item.cto.nome || item.cto.codigo || `CTO #${item.cto.id}`}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Ocupação: {item.occupied}/{item.capacity} • Livres:{' '}
                            <strong>{item.freePorts}</strong>
                          </p>
                        </div>
                        <Badge
                          variant={
                            item.distanceMeters <= 350 && item.freePorts > 0
                              ? 'default'
                              : 'outline'
                          }
                          className="text-[10px] shrink-0"
                        >
                          {item.distanceMeters} m
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-primary" />
                  Converter Lead em Assinante ISPFY
                </CardTitle>
                <CardDescription className="text-xs">
                  Cria o cadastro oficial via <code>POST /api/tool/cliente/novo</code>, abre a O.S. de instalação e envia boas-vindas no WhatsApp.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleConvertLeadToIspfy} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome Completo / Razão Social *</Label>
                    <Input
                      value={leadNome}
                      onChange={(e) => setLeadNome(e.target.value)}
                      placeholder="Ex: Maria da Silva"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">CPF / CNPJ *</Label>
                      <Input
                        value={leadCpf}
                        onChange={(e) => setLeadCpf(e.target.value)}
                        placeholder="000.000.000-00"
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">WhatsApp (com DDD)</Label>
                      <Input
                        value={leadPhone}
                        onChange={(e) => setLeadPhone(e.target.value)}
                        placeholder="(21) 99999-9999"
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Rua / Logradouro</Label>
                      <Input
                        value={leadRua}
                        onChange={(e) => setLeadRua(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Número</Label>
                      <Input
                        value={leadNumero}
                        onChange={(e) => setLeadNumero(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Bairro</Label>
                      <Input
                        value={leadBairro}
                        onChange={(e) => setLeadBairro(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cidade</Label>
                      <Input
                        value={leadCidade}
                        onChange={(e) => setLeadCidade(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <Label htmlFor="sw-os" className="cursor-pointer">
                        Abrir O.S. de instalação automaticamente
                      </Label>
                      <Switch id="sw-os" checked={openInstallOs} onCheckedChange={setOpenInstallOs} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <Label htmlFor="sw-wa" className="cursor-pointer">
                        Enviar boas-vindas ao cliente via Z-API
                      </Label>
                      <Switch id="sw-wa" checked={sendWelcomeWa} onCheckedChange={setSendWelcomeWa} />
                    </div>
                  </div>
                  <Button type="submit" disabled={creatingLead} className="w-full gap-2">
                    {creatingLead ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    Cadastrar Assinante no ISPFY
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: RADAR PREVENTIVO DE SINAL ÓPTICO */}
          <TabsContent value="optical" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Signal className="w-4 h-4 text-rose-500" />
                      Radar Preventivo de Sinal Óptico Crítico (SmartOLT × ISPFY)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Identifica ONUs em LOS ou com sinal RX degradado antes que o cliente fique sem internet e abra chamado.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-24 h-9 text-xs"
                      value={opticalThreshold}
                      onChange={(e) => setOpticalThreshold(Number(e.target.value))}
                      title="Limite RX dBm (ex: -26)"
                    />
                    <Button size="sm" onClick={handleScanOpticalSignal} disabled={loadingOptical} className="gap-1.5">
                      {loadingOptical ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Radar className="w-3.5 h-3.5" />
                      )}
                      Escanear ONUs
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {opticalItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Clique em <strong>Escanear ONUs</strong> para cruzar o sinal RX do SmartOLT com sua base ISPFY.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[460px] overflow-y-auto">
                    {opticalItems.map((item) => (
                      <div
                        key={item.onu.id || item.onu.sn}
                        className="p-3 rounded-xl border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant={item.onu.status === 'los' ? 'destructive' : 'outline'}
                              className="text-[10px]"
                            >
                              {item.rxDbm !== null
                                ? `${item.rxDbm.toFixed(1)} dBm`
                                : item.onu.status.toUpperCase()}
                            </Badge>
                            <span className="font-bold truncate">{item.onu.name || item.onu.sn}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              PON {item.onu.board}/{item.onu.pon_port} • SN {item.onu.sn}
                            </span>
                          </div>
                          {item.matchedClient && (
                            <p className="text-[11px] text-muted-foreground">
                              ISPFY: {item.matchedClient.nome} — {item.matchedClient.ruaLabel},{' '}
                              {item.matchedClient.bairroLabel}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.matchedClient && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] gap-1"
                              onClick={() =>
                                navigate(`/ispfy/nova-os?clienteId=${item.matchedClient!.clienteId}`)
                              }
                            >
                              <ClipboardList className="w-3 h-3" />
                              Abrir O.S.
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-[11px] gap-1"
                            onClick={async () => {
                              const grp = DEFAULT_AVL_WHATSAPP_GROUPS[1] || DEFAULT_AVL_WHATSAPP_GROUPS[0];
                              await whapiService.sendGroupMessage(
                                grp.phone,
                                `⚠️ *ALERTA PREVENTIVO ÓPTICO (SMARTOLT)*\n\n` +
                                  `👤 *ONU/Cliente:* ${item.onu.name || item.onu.sn}\n` +
                                  `📡 *Status/Sinal:* ${
                                    item.rxDbm !== null ? `${item.rxDbm} dBm` : item.onu.status.toUpperCase()
                                  }\n` +
                                  `🔌 *PON:* ${item.onu.board}/${item.onu.pon_port}\n` +
                                  (item.matchedClient
                                    ? `📍 *Endereço:* ${item.matchedClient.ruaLabel} — ${item.matchedClient.bairroLabel}`
                                    : '')
                              );
                              toast.success(`Alerta preventivo enviado para ${grp.name}!`);
                            }}
                          >
                            <Send className="w-3 h-3" />
                            Avisar Equipe
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: RADAR DE UPGRADE & TURBO */}
          <TabsContent value="upgrades" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-indigo-500" />
                      Radar Comercial de Upgrade (Consumo 30 dias + Turbo 7d)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Analisa o tráfego real via <code>/api/tool/assinante/ponto/consumo</code> para encontrar clientes com alto uso e oferecer degustação Turbo 7 dias com 1 clique.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      placeholder="Filtrar plano (ex: 100, 200)"
                      value={upgradeFilterPlan}
                      onChange={(e) => setUpgradeFilterPlan(e.target.value)}
                      className="w-44 h-9 text-xs"
                    />
                    <Input
                      type="number"
                      min={5}
                      max={40}
                      value={upgradeSampleSize}
                      onChange={(e) => setUpgradeSampleSize(Number(e.target.value))}
                      className="w-20 h-9 text-xs"
                      title="Quantidade de clientes analisados"
                    />
                    <Button size="sm" onClick={handleScanUpgradeCandidates} disabled={scanningUpgrades} className="gap-1.5">
                      {scanningUpgrades ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      Analisar Consumo
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {upgradeCandidates.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Filtre um plano de entrada (opcional) e clique em <strong>Analisar Consumo</strong> para listar os maiores consumidores dos últimos 30 dias.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[460px] overflow-y-auto">
                    {upgradeCandidates.map((item) => (
                      <div
                        key={item.record.pontoId}
                        className="p-3 rounded-xl border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="font-bold truncate">{item.record.nome}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {item.record.plano || 'Plano Padrão'}
                            </Badge>
                            <Badge className="bg-indigo-600 text-white text-[10px]">
                              {item.totalGb.toFixed(1)} GB / 30d
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            ↓ {item.usage.downloadGb.toFixed(1)} GB • ↑{' '}
                            {item.usage.uploadGb.toFixed(1)} GB • {item.record.bairroLabel}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            onClick={() => navigate(`/ispfy/cliente/${item.record.clienteId}`)}
                          >
                            Ver Ficha
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-[11px] gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                            disabled={activatingTurboId === item.record.pontoId}
                            onClick={() => handleOfferTurboUpgrade(item)}
                          >
                            {activatingTurboId === item.record.pontoId ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Rocket className="w-3 h-3" />
                            )}
                            Turbo 7d + WhatsApp
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: SATISFAÇÃO CSAT */}
          <TabsContent value="csat" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Índice de Aprovação</p>
                  <p className="text-2xl font-bold text-emerald-500 mt-1">{csatStats.pct}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total de Respostas</p>
                  <p className="text-2xl font-bold mt-1">{csatStats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Excelente / Bom</p>
                  <p className="text-2xl font-bold text-sky-500 mt-1">{csatStats.positive}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Ainda com Problema</p>
                  <p className="text-2xl font-bold text-rose-500 mt-1">{csatStats.problems}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  Respostas Recentes dos Botões CSAT (Z-API)
                </CardTitle>
                <CardDescription className="text-xs">
                  Capturadas automaticamente quando o cliente clica nos botões de avaliação após o encerramento de O.S. ou atendimento no Chat.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {csatResponses.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Nenhuma avaliação registrada ainda. Ao encerrar uma O.S. ou clicar em <strong>Avaliar</strong> no Chat, as respostas aparecerão aqui em tempo real.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto">
                    {csatResponses.map((resp) => {
                      const isBad = (resp.score ?? 0) <= 2;
                      return (
                        <div
                          key={resp.id}
                          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                            isBad ? 'border-rose-500/40 bg-rose-500/5' : 'bg-muted/20'
                          }`}
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={isBad ? 'destructive' : 'secondary'} className="text-[10px]">
                                {isBad ? (
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                )}
                                {resp.label || `Nota ${resp.score}`}
                              </Badge>
                              <span className="font-bold truncate">
                                {resp.clientName || resp.clientPhone || 'Cliente'}
                              </span>
                              {resp.ticketId && (
                                <Badge variant="outline" className="text-[10px]">
                                  O.S. #{resp.ticketId}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {resp.clientPhone}{' '}
                              {resp.createdAtMs
                                ? `• ${new Date(resp.createdAtMs).toLocaleString('pt-BR')}`
                                : ''}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] gap-1 shrink-0"
                            onClick={() => navigate('/chat')}
                          >
                            <MessageSquare className="w-3 h-3" />
                            Abrir Chat
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
