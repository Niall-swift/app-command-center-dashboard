import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Wifi, 
  CreditCard, 
  LifeBuoy, 
  CheckCircle2, 
  AlertCircle, 
  QrCode, 
  Download,
  Lock,
  Unlock,
  RefreshCw,
  PowerOff,
  Activity,
  Zap,
  Signal,
  ArrowUpCircle
} from 'lucide-react';
import { useIXC } from '@/hooks/useIXC';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface IXCClientDashboardProps {
  clientId: string;
}

export const IXCClientDashboard: React.FC<IXCClientDashboardProps> = ({ clientId }) => {
  const { toast } = useToast();
  const { 
    client, 
    contracts, 
    invoices, 
    logins, 
    loading, 
    refresh, 
    updateWifi, 
    getPix, 
    unlock,
    disconnect,
    onu,
    signal,
    loadingSignal,
    bandwidthUsage,
    pendingContracts,
    isEligibleForUnlock,
    refreshSignal,
    rebootOnu
  } = useIXC({ clientId });

  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [pixData, setPixData] = useState<any>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState<string | null>(null);

  const [wifiLoginId, setWifiLoginId] = useState<string | null>(null);
  const [newSsid, setNewSsid] = useState('');
  const [newPass, setNewPass] = useState('');

  const handlePix = async (id: string) => {
    setPixLoading(true);
    const data = await getPix(id);
    if (data) {
      setPixData(data);
      setSelectedInvoice(id);
    }
    setPixLoading(false);
  };

  if (loading && !client) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-lg font-medium text-muted-foreground">Carregando central do cliente...</span>
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/50">
            {client.razao || client.nome}
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground mt-1">
            <Badge variant="outline" className="text-[10px]">{client.cnpj_cpf}</Badge>
            <span className="text-xs">•</span>
            <span className="text-xs">{client.cidade} - {client.bairro}</span>
          </div>
        </div>
        <Button size="icon" variant="outline" className="rounded-full" onClick={refresh}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {pendingContracts.length > 0 && (
        <div className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-yellow-500/20 text-yellow-600">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm">Assinatura Pendente</p>
              <p className="text-xs text-muted-foreground">Você possui {pendingContracts.length} contrato(s) aguardando assinatura digital.</p>
            </div>
          </div>
          <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white border-0">
            Assinar Agora
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {contracts.map((contract) => (
          <Card key={contract.id} className="bg-card/50 backdrop-blur-sm border-primary/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Contrato {contract.id}</CardTitle>
              <Wifi className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contract.plano || 'Internet'}</div>
              <div className="flex items-center mt-1">
                <Badge variant={contract.status === 'A' ? 'default' : 'destructive'} className="mr-2">
                  {contract.status === 'A' ? 'Ativo' : 'Inativo'}
                </Badge>
                <span className="text-xs text-muted-foreground">{contract.status_internet}</span>
              </div>
              
              <div className="flex flex-col gap-2 mt-4">
                {(contract.status_internet === 'FA' || contract.status_internet === 'CA') && isEligibleForUnlock && (
                  <Button 
                    size="sm" 
                    variant="default" 
                    className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                    onClick={() => unlock(contract.id!)}
                  >
                    <Unlock className="w-3 h-3 mr-2" /> Desbloqueio em Confiança
                  </Button>
                )}

                {contract.status === 'A' && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full border-primary/20 hover:bg-primary/5 group"
                    onClick={() => toast({ title: "Upgrade solicitado", description: "Um consultor entrará em contato em breve." })}
                  >
                    <ArrowUpCircle className="w-3 h-3 mr-2 group-hover:text-primary transition-colors" /> Solicitar Upgrade
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="financial" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="financial">Financeiro</TabsTrigger>
          <TabsTrigger value="network">Rede & Wi-Fi</TabsTrigger>
          <TabsTrigger value="tickets">C.O.S</TabsTrigger>
        </TabsList>

        <TabsContent value="financial" className="mt-4">
          <Card className="border-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Faturas e Pagamentos</CardTitle>
                  <CardDescription>Gerencie suas faturas pendentes e histórico.</CardDescription>
                </div>
                <CreditCard className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {invoices.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground italic">Nenhuma fatura encontrada.</div>
                ) : (
                  invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors border border-transparent hover:border-primary/20">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${invoice.data_pagamento ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                          {invoice.data_pagamento ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-semibold">R$ {invoice.valor}</p>
                          <p className="text-xs text-muted-foreground">Vencimento: {invoice.data_vencimento}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!invoice.data_pagamento && (
                          <>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" onClick={() => handlePix(invoice.id!)}>
                                  <QrCode className="w-4 h-4 mr-2 text-primary" /> PIX
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Pagamento via PIX</DialogTitle>
                                  <DialogDescription>Use o QR Code abaixo ou a Chave Copia e Cola.</DialogDescription>
                                </DialogHeader>
                                <div className="flex flex-col items-center justify-center p-6 space-y-4">
                                  {pixLoading ? (
                                    <RefreshCw className="w-12 h-12 animate-spin text-primary" />
                                  ) : pixData ? (
                                    <>
                                      {pixData.qrcode && (
                                        <div className="p-4 bg-white rounded-xl shadow-inner">
                                          <img src={`data:image/png;base64,${pixData.qrcode}`} alt="PIX QR Code" className="w-64 h-64" />
                                        </div>
                                      )}
                                      <div className="w-full space-y-2">
                                        <Label>Copia e Cola</Label>
                                        <div className="flex gap-2">
                                          <Input readOnly value={pixData.qrcode_text} className="font-mono text-xs overflow-hidden" />
                                          <Button size="icon" variant="outline" onClick={() => navigator.clipboard.writeText(pixData.qrcode_text)}>
                                            <Download className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <p className="text-destructive font-medium">Erro ao gerar PIX. Tente novamente.</p>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button size="sm" variant="ghost">
                              <Download className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {invoice.data_pagamento && <Badge variant="outline" className="text-green-500 border-green-500/20 bg-green-500/5">PAGO</Badge>}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {bandwidthUsage.length > 0 && (
                <div className="space-y-4 pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold">Consumo de Banda (Últimos 7 dias)</h3>
                      <p className="text-[10px] text-muted-foreground">Monitoramento de tráfego em GB.</p>
                    </div>
                    <Badge variant="outline" className="h-6">
                      <Activity className="w-3 h-3 mr-1" /> Real-time
                    </Badge>
                  </div>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={bandwidthUsage}>
                        <defs>
                          <linearGradient id="colorDown" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 10}} 
                          minTickGap={20}
                        />
                        <YAxis hide />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(0,0,0,0.8)', 
                            border: 'none', 
                            borderRadius: '8px',
                            fontSize: '12px'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="download" 
                          stroke="#8884d8" 
                          fillOpacity={1} 
                          fill="url(#colorDown)" 
                          strokeWidth={2}
                          name="Download (GB)"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="upload" 
                          stroke="#82ca9d" 
                          fill="transparent" 
                          strokeWidth={2}
                          name="Upload (GB)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="mt-4">
          <Card className="border-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Rede & Wi-Fi</CardTitle>
                  <CardDescription>Configure seu roteador e verifique conexões.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {onu && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={refreshSignal} 
                      disabled={loadingSignal}
                      className="h-8 gap-2"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingSignal ? 'animate-spin' : ''}`} />
                      Sinal
                    </Button>
                  )}
                  <Wifi className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* SmartOLT Diagnostics */}
              {onu && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-2 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Signal className="w-16 h-16" />
                    </div>
                    <div className="flex flex-col h-full justify-between gap-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge variant="outline" className="mb-2 bg-background/50">SmartOLT Real-time</Badge>
                          <h3 className="font-bold text-lg leading-none">{onu.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1">{onu.onu_type} | SN: {onu.sn}</p>
                        </div>
                        <div className="flex flex-col items-end">
                           <div className={`p-1.5 rounded-full mb-1 ${onu.status === 'online' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                           <span className="text-[10px] font-bold uppercase">{onu.status}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground">Sinal ONU (RX)</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black tracking-tight">{signal?.rx_power || '--'}</span>
                            <span className="text-xs font-medium opacity-70">dBm</span>
                          </div>
                          {signal?.rx_power_numeric && (
                            <div className="h-1.5 w-full bg-background/50 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-1000 ${
                                  signal.rx_power_numeric > -25 ? 'bg-green-500' : 
                                  signal.rx_power_numeric > -28 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.max(0, Math.min(100, (signal.rx_power_numeric + 40) * 2.5))}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground">Sinal OLT (TX)</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black tracking-tight">{signal?.olt_rx_power || '--'}</span>
                            <span className="text-xs font-medium opacity-70">dBm</span>
                          </div>
                          <div className="h-1.5 w-full bg-background/50 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border bg-card flex flex-col justify-between items-center text-center gap-3">
                    <div className="p-3 rounded-full bg-secondary">
                      <Activity className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Gerenciar Fibra</p>
                      <p className="text-[10px] text-muted-foreground">Comandos diretos na OLT</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      onClick={() => {
                        if (confirm('Atenção: A ONU será reiniciada e a internet cairá por alguns instantes. Continuar?')) {
                          rebootOnu();
                        }
                      }}
                    >
                      <Zap className="w-3 h-3 mr-2" /> Reboot ONU
                    </Button>
                  </div>
                </div>
              )}

              <Separator className="my-2" />
              
              <div className="grid gap-6 md:grid-cols-2">
                {logins.map((login) => (
                  <div key={login.id} className="p-4 rounded-xl border bg-secondary/20 border-primary/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Wifi className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{login.login}</p>
                          <Badge variant={login.online === 'S' ? 'default' : 'secondary'} className="h-4 text-[10px]">
                            {login.online === 'S' ? 'ONLINE' : 'OFFLINE'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost" onClick={() => {
                              setWifiLoginId(login.id!);
                              setNewSsid(login.login!);
                            }}>Configurar</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Alterar Dados de Wi-Fi</DialogTitle>
                              <DialogDescription>Mude o nome ou a senha da sua rede sem fio.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="ssid" className="text-right">SSID (Nome)</Label>
                                <Input id="ssid" value={newSsid} onChange={(e) => setNewSsid(e.target.value)} className="col-span-3" />
                              </div>
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="pass" className="text-right">Senha</Label>
                                <Input id="pass" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className="col-span-3" />
                              </div>
                            </div>
                            <Button onClick={() => updateWifi(wifiLoginId!, newSsid, newPass)}>Salvar Alterações</Button>
                          </DialogContent>
                        </Dialog>

                        {login.online === 'S' && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={async () => {
                              if (confirm('Deseja realmente derrubar esta conexão?')) {
                                setIsDisconnecting(login.id!);
                                await disconnect(login.id!);
                                setIsDisconnecting(null);
                              }
                            }}
                            disabled={isDisconnecting === login.id}
                          >
                            <PowerOff className={`w-4 h-4 mr-2 ${isDisconnecting === login.id ? 'animate-pulse' : ''}`} />
                            Desconectar
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-2 border-t border-primary/5">
                      <div>IP: {login.ip || 'Dinâmico'}</div>
                      <div>MAC: {login.mac || 'N/D'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          <Card className="border-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Suporte Técnico</CardTitle>
                  <CardDescription>Abra um novo chamado ou acompanhe atendimentos.</CardDescription>
                </div>
                <LifeBuoy className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="h-[200px] flex flex-col items-center justify-center text-center space-y-4">
               <div className="p-4 rounded-full bg-primary/10">
                  <LifeBuoy className="w-8 h-8 text-primary" />
               </div>
               <div>
                  <p className="font-semibold">Precisa de ajuda?</p>
                  <p className="text-sm text-muted-foreground max-w-[300px]">Nossa equipe está pronta para te atender. Abra uma O.S. agora mesmo.</p>
               </div>
               <Button>Abrir Novo Chamado</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
