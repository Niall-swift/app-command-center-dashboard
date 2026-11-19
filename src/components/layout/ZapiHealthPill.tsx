import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  CheckCircle2,
  Copy,
  Loader2,
  MessageSquare,
  QrCode,
  RefreshCw,
  RotateCcw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/config/firebase';
import { whapiService } from '@/services/whapi/whapiService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ZapiHealthDoc {
  connected?: boolean;
  smartphoneConnected?: boolean;
  error?: string | null;
  checkedAtMs?: number;
  source?: string;
}

const ZAPI_STATUS_WEBHOOK_URL =
  'https://us-central1-avl-telecom.cloudfunctions.net/zapiStatusWebhook';

export function ZapiHealthPill() {
  const [health, setHealth] = useState<ZapiHealthDoc | null>(null);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'zapi_health'),
      (snap) => {
        if (snap.exists()) {
          setHealth(snap.data() as ZapiHealthDoc);
        }
      },
      () => undefined
    );
    return () => unsub();
  }, []);

  const handleRefreshStatus = async (silent = false) => {
    setChecking(true);
    try {
      const res = await whapiService.getInstanceStatus();
      setHealth({
        connected: res.connected,
        smartphoneConnected: res.smartphoneConnected,
        error: res.error || null,
        checkedAtMs: Date.now(),
      });
      if (!silent) {
        if (res.connected) {
          toast.success('WhatsApp Z-API conectado e operando normalmente!');
        } else {
          toast.warning('Instância WhatsApp desconectada. Gere o QR Code para reconectar.');
        }
      }
    } catch (err) {
      if (!silent) {
        toast.error(err instanceof Error ? err.message : 'Erro ao verificar Z-API');
      }
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    // Valida silenciosamente se ainda não há leitura recente (> 10 min)
    if (!health?.checkedAtMs || Date.now() - health.checkedAtMs > 10 * 60 * 1000) {
      handleRefreshStatus(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFetchQr = async () => {
    setLoadingQr(true);
    setQrCode(null);
    try {
      const res = await whapiService.getQrCode();
      if (res.connected) {
        toast.success('WhatsApp já está conectado!');
        await handleRefreshStatus(true);
        return;
      }
      if (res.qrCodeBase64) {
        const src = res.qrCodeBase64.startsWith('data:')
          ? res.qrCodeBase64
          : `data:image/png;base64,${res.qrCodeBase64}`;
        setQrCode(src);
      } else {
        toast.warning('A Z-API não retornou imagem do QR Code. Tente reiniciar a instância.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar QR Code.');
    } finally {
      setLoadingQr(false);
    }
  };

  const handleRestart = async () => {
    setRestarting(true);
    try {
      const ok = await whapiService.restartInstance();
      if (ok) {
        toast.success('Comando de reinício enviado para a Z-API! Aguarde ~10s.');
        setTimeout(() => handleRefreshStatus(true), 8000);
      } else {
        toast.error('Falha ao reiniciar instância Z-API.');
      }
    } finally {
      setRestarting(false);
    }
  };

  const isConnected = health?.connected === true;
  const isUnknown = health === null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={`h-9 px-2.5 sm:px-3 rounded-xl gap-2 text-xs font-semibold transition-all shadow-sm ${
          isUnknown
            ? 'border-border/80 bg-background text-muted-foreground'
            : isConnected
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
            : 'border-rose-500/60 bg-rose-500/15 text-rose-700 dark:text-rose-300 animate-pulse hover:bg-rose-500/25'
        }`}
        title="Saúde da instância WhatsApp (Z-API) e Reconexão QR Code"
      >
        <span
          className={`w-2 h-2 rounded-full ${
            isUnknown
              ? 'bg-slate-400'
              : isConnected
              ? 'bg-emerald-500'
              : 'bg-rose-500'
          }`}
        />
        <MessageSquare className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">
          {isUnknown ? 'Z-API' : isConnected ? 'WhatsApp OK' : 'WhatsApp OFF'}
        </span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              Saúde do WhatsApp (Z-API)
            </DialogTitle>
            <DialogDescription>
              Monitore a conexão do chip, reconecte via QR Code sem sair do painel e ative os ticks azuis de leitura.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                isConnected
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-rose-500/30 bg-rose-500/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {isConnected ? (
                  <Wifi className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <WifiOff className="w-5 h-5 text-rose-500 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {isConnected ? 'Instância Conectada' : 'Instância Desconectada'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {health?.checkedAtMs
                      ? `Verificado às ${new Date(health.checkedAtMs).toLocaleTimeString('pt-BR')}`
                      : 'Sem leitura recente'}
                    {health?.error ? ` • ${health.error}` : ''}
                  </p>
                </div>
              </div>
              <Badge variant={isConnected ? 'default' : 'destructive'} className="text-[10px]">
                {isConnected ? 'ONLINE' : 'OFFLINE'}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                disabled={checking}
                onClick={() => handleRefreshStatus(false)}
              >
                {checking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Status
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                disabled={loadingQr}
                onClick={handleFetchQr}
              >
                {loadingQr ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <QrCode className="w-3.5 h-3.5" />
                )}
                QR Code
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                disabled={restarting}
                onClick={handleRestart}
              >
                {restarting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                Reiniciar
              </Button>
            </div>

            {qrCode && (
              <div className="p-4 rounded-xl border bg-white flex flex-col items-center gap-2">
                <img
                  src={qrCode}
                  alt="QR Code WhatsApp Z-API"
                  className="w-52 h-52 object-contain"
                />
                <p className="text-[11px] text-slate-600 text-center">
                  Abra o WhatsApp no celular → Aparelhos Conectados → Conectar aparelho. O QR expira em ~20s.
                </p>
              </div>
            )}

            <div className="p-3 rounded-xl border bg-muted/40 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" />
                  Webhook de Ticks Azuis &amp; Status
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px] gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(ZAPI_STATUS_WEBHOOK_URL);
                    toast.success('URL do webhook copiada!');
                  }}
                >
                  <Copy className="w-3 h-3" />
                  Copiar URL
                </Button>
              </div>
              <code className="block text-[10px] font-mono bg-background p-2 rounded border break-all text-muted-foreground">
                {ZAPI_STATUS_WEBHOOK_URL}
              </code>
              <p className="text-[11px] text-muted-foreground">
                Cole no painel da Z-API em <strong>Status da mensagem</strong>, <strong>Ao conectar</strong> e <strong>Ao desconectar</strong> para receber ✓✓ azul no Chat e na Régua de Cobrança.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
