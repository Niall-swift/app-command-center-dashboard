import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Users, AlertCircle, CheckCircle, Clock, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { ixcService, type IXCClienteData } from '@/services/ixc/ixcService';
import { whapiService } from '@/services/whapi/whapiService';
import { calculateDaysOverdue } from '@/services/whapi/messageTemplates';
import type { IXCFaturaData } from '@/types/ixc';
import type { WhapiBulkRecipient, GroupedClients, VencimentoGroup, WhapiSendProgress, WhapiSendLog } from '@/types/whapi';
import PageTransition from '@/components/PageTransition';

export default function WhatsAppBulkSender() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [groupedClients, setGroupedClients] = useState<GroupedClients[]>([]);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<WhapiSendProgress | null>(null);
  const [logs, setLogs] = useState<WhapiSendLog[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<VencimentoGroup>>(new Set());

  // Carregar dados ao montar
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Buscar clientes ativos
      const clientes = await ixcService.getClientesAtivos();
      
      // 2. Buscar faturas em aberto
      const faturas = await ixcService.getFaturasAbertas();
      
      // 3. Agrupar por data de vencimento
      const grouped = groupClientsByDueDate(clientes, faturas);
      setGroupedClients(grouped);
      
      toast({
        title: 'Dados carregados',
        description: `${clientes.length} clientes e ${faturas.length} faturas encontradas`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao carregar dados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const groupClientsByDueDate = (
    clientes: IXCClienteData[],
    faturas: IXCFaturaData[]
  ): GroupedClients[] => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const groups: Record<VencimentoGroup, WhapiBulkRecipient[]> = {
      vencidas_1_7: [],
      vencidas_8_15: [],
      vencidas_16_30: [],
      vencidas_30_plus: [],
      vencendo_hoje: [],
      vencendo_3_dias: [],
      futuras: [],
    };

    // Mapear faturas por cliente
    faturas.forEach((fatura) => {
      const cliente = clientes.find((c) => c.id === (fatura.id_cliente || fatura.cliente_id));
      if (!cliente || !cliente.fone_celular) return;

      const vencimento = new Date(fatura.data_vencimento);
      vencimento.setHours(0, 0, 0, 0);
      const diasAtraso = calculateDaysOverdue(fatura.data_vencimento);

      const recipient: WhapiBulkRecipient = {
        clienteId: cliente.id || '',
        nome: cliente.razao || cliente.nome || 'Cliente',
        telefone: cliente.fone_celular,
        fatura: {
          id: fatura.id || '',
          valor: parseFloat(fatura.valor || '0'),
          dataVencimento: (fatura.data_vencimento as string) || '',
          diasAtraso,
          linkBoleto: (fatura.url_boleto as string | undefined),
        },
      };

      // Classificar em grupos
      if (diasAtraso > 0) {
        if (diasAtraso <= 7) groups.vencidas_1_7.push(recipient);
        else if (diasAtraso <= 15) groups.vencidas_8_15.push(recipient);
        else if (diasAtraso <= 30) groups.vencidas_16_30.push(recipient);
        else groups.vencidas_30_plus.push(recipient);
      } else if (diasAtraso === 0) {
        groups.vencendo_hoje.push(recipient);
      } else if (diasAtraso >= -3) {
        groups.vencendo_3_dias.push(recipient);
      } else {
        groups.futuras.push(recipient);
      }
    });

    // Converter para array de GroupedClients
    return [
      {
        group: 'vencidas_1_7',
        label: '1-7 dias de atraso',
        count: groups.vencidas_1_7.length,
        clients: groups.vencidas_1_7,
        color: 'bg-red-500',
        icon: '🔴',
      },
      {
        group: 'vencidas_8_15',
        label: '8-15 dias de atraso',
        count: groups.vencidas_8_15.length,
        clients: groups.vencidas_8_15,
        color: 'bg-red-600',
        icon: '🔴',
      },
      {
        group: 'vencidas_16_30',
        label: '16-30 dias de atraso',
        count: groups.vencidas_16_30.length,
        clients: groups.vencidas_16_30,
        color: 'bg-red-700',
        icon: '🔴',
      },
      {
        group: 'vencidas_30_plus',
        label: 'Mais de 30 dias',
        count: groups.vencidas_30_plus.length,
        clients: groups.vencidas_30_plus,
        color: 'bg-red-900',
        icon: '🔴',
      },
      {
        group: 'vencendo_hoje',
        label: 'Vencendo Hoje',
        count: groups.vencendo_hoje.length,
        clients: groups.vencendo_hoje,
        color: 'bg-yellow-500',
        icon: '🟡',
      },
      {
        group: 'vencendo_3_dias',
        label: 'Vencendo em 3 dias',
        count: groups.vencendo_3_dias.length,
        clients: groups.vencendo_3_dias,
        color: 'bg-green-500',
        icon: '🟢',
      },
      {
        group: 'futuras',
        label: 'Futuras',
        count: groups.futuras.length,
        clients: groups.futuras,
        color: 'bg-blue-500',
        icon: '🔵',
      },
    ].filter((g) => g.count > 0); // Remover grupos vazios
  };

  const toggleGroup = (group: VencimentoGroup) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(group)) {
      newSelected.delete(group);
    } else {
      newSelected.add(group);
    }
    setSelectedGroups(newSelected);
  };

  const sendToGroup = async (group: GroupedClients) => {
    setSending(true);
    setProgress({ total: group.count, sent: 0, failed: 0 });
    setLogs([]);

    try {
      const groupLogs = await whapiService.sendBulkMessages(
        group.clients,
        group.group,
        (prog) => setProgress(prog),
        (log) => setLogs((prev) => [...prev, log])
      );

      toast({
        title: 'Envio concluído',
        description: `${groupLogs.filter((l) => l.status === 'success').length} mensagens enviadas com sucesso`,
      });
    } catch (error) {
      toast({
        title: 'Erro no envio',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  return (
    <PageTransition>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Envio em Massa - WhatsApp</h1>
            <p className="text-muted-foreground">
              Envie notificações de cobrança para clientes com faturas em aberto
            </p>
          </div>
          <Button onClick={loadData} disabled={loading} variant="outline">
            <Database className="mr-2 h-4 w-4" />
            {loading ? 'Carregando...' : 'Atualizar Dados'}
          </Button>
        </div>

        {/* Grupos de Vencimento */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groupedClients.map((group) => (
            <motion.div
              key={group.group}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span>{group.icon}</span>
                      <span>{group.label}</span>
                    </span>
                    <Badge variant="secondary">{group.count}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {group.count} cliente{group.count !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => sendToGroup(group)}
                    disabled={sending || group.count === 0}
                    className="w-full"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Enviar para este grupo
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Progresso de Envio */}
        {progress && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 animate-spin" />
                Enviando mensagens...
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Progresso</span>
                  <span>
                    {progress.sent} / {progress.total}
                  </span>
                </div>
                <Progress value={(progress.sent / progress.total) * 100} />
              </div>
              {progress.current && (
                <p className="text-sm text-muted-foreground">
                  Enviando para: {progress.current}
                </p>
              )}
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  {progress.sent - progress.failed} enviadas
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {progress.failed} falhas
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Logs de Envio</CardTitle>
              <CardDescription>Últimas {logs.length} mensagens</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logs.slice(-20).reverse().map((log, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-2 rounded ${
                      log.status === 'success' ? 'bg-green-50' : 'bg-red-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {log.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="text-sm font-medium">{log.clienteNome}</span>
                      <span className="text-xs text-muted-foreground">{log.telefone}</span>
                    </div>
                    {log.error && (
                      <span className="text-xs text-red-600">{log.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}
