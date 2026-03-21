import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Users, AlertCircle, CheckCircle, Clock, Database, Search, Flame, PlayCircle } from 'lucide-react';
import { generateAIBillingMessage, generateAIBlockedMessage } from '@/services/gemini/geminiService';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ixcService } from '@/services/ixc/ixcService';
import type { IXCClienteData } from '@/types/ixc';
import { whapiService } from '@/services/whapi/whapiService';
import { calculateDaysOverdue, fillTemplate, getTemplateForGroup, formatCurrency, formatDate } from '@/services/whapi/messageTemplates';
import { spin } from '@/utils/spintax';
import type { IXCFaturaData, IXCContratoData } from '@/types/ixc';
import type { WhapiBulkRecipient, GroupedClients, VencimentoGroup, WhapiSendProgress, WhapiSendLog } from '@/types/whapi';
import PageTransition from '@/components/PageTransition';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function WhatsAppBulkSender() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ clientes: IXCClienteData[], faturas: IXCFaturaData[], blockedContracts: IXCContratoData[] }>({ clientes: [], faturas: [], blockedContracts: [] });
  const [groupedClients, setGroupedClients] = useState<GroupedClients[]>([]);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<WhapiSendProgress | null>(null);
  const [logs, setLogs] = useState<WhapiSendLog[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<VencimentoGroup>>(new Set());
  const [warmupMode, setWarmupMode] = useState(false);
  const [isSendingBlockedBulk, setIsSendingBlockedBulk] = useState(false);
  
  // Preview
  const [previewGroup, setPreviewGroup] = useState<GroupedClients | null>(null);
  const [filteredClients, setFilteredClients] = useState<WhapiBulkRecipient[]>([]);
  const [previewMessage, setPreviewMessage] = useState<string>('');
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  
  // Search for individual client
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<WhapiBulkRecipient[]>([]);
  const [selectedClient, setSelectedClient] = useState<WhapiBulkRecipient | null>(null);
  const [sendingToClient, setSendingToClient] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [isTestingAI, setIsTestingAI] = useState(false);

  // Carregar dados ao montar
  useEffect(() => {
    loadData();
  }, []);

  // Reagrudar quando mudar filtros ou dados
  useEffect(() => {
    if (data.clientes.length > 0) {
      const grouped = groupClientsByDueDate(data.clientes, data.faturas);
      setGroupedClients(grouped);
    }
  }, [data]);

  // Estado de carregamento com mensagem
  const [loadingMessage, setLoadingMessage] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    setLoadingMessage('Iniciando carregamento...');
    try {
      // 1. Buscar TODOS os clientes (recursivo)
      setLoadingMessage('Buscando clientes ativos... (0)');
      const clientes = await ixcService.fetchAllClientesAtivos((total) => {
        setLoadingMessage(`Buscando clientes ativos... (${total})`);
      });
      
      // 2. Buscar TODAS as faturas em aberto (recursivo)
      setLoadingMessage('Buscando faturas em aberto... (0)');
      const faturas = await ixcService.fetchAllFaturasAbertas((total) => {
        setLoadingMessage(`Buscando faturas em aberto... (${total})`);
      });
      
      // 3. Buscar contratos BLOQUEADOS (status_internet = 'BA')
      setLoadingMessage('Buscando clientes bloqueados... (BA)');
      const blockedContracts = await ixcService.fetchAllContratosBloqueados((total) => {
        setLoadingMessage(`Buscando bloqueados... (${total})`);
      });
      
      setData({ clientes, faturas, blockedContracts });
      
      toast({
        title: 'Dados carregados com sucesso',
        description: `${clientes.length} clientes, ${faturas.length} faturas, ${blockedContracts.length} bloqueados`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Erro ao carregar dados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const groupClientsByDueDate = (
    clientes: IXCClienteData[],
    faturas: IXCFaturaData[]
  ): GroupedClients[] => {
    
    // Objeto para agrupar por data de vencimento (YYYY-MM-DD -> Clientes)
    const groups: Record<string, WhapiBulkRecipient[]> = {};

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Mapear faturas por cliente e agrupar por data
    faturas.forEach((fatura) => {
      // Filtro de valor mínimo removido conforme solicitado
      const valor = parseFloat(fatura.valor || '0');
      
      // DEBUG: Verificar dados da fatura
      console.log(`🧾 Fatura ID: ${fatura.id} | Gateway Link: ${fatura.gateway_link} | Link GetWere: ${fatura.link_getwere} | URL Boleto: ${fatura.url_boleto}`, fatura);

      
      const cliente = clientes.find((c) => String(c.id) === String(fatura.id_cliente || fatura.cliente_id));
      
      // 1. Filtro de Cliente (apenas ativos e com telefone)
      if (!cliente || !cliente.telefone_celular || cliente.ativo !== 'S') return;

      // 2. Filtro de Mês Atual (apenas faturas deste mês)
      const dataVencimento = fatura.data_vencimento as string;
      if (!dataVencimento) return;
      
      // Comparar mês e ano (usando UTC para segurança com datas YYYY-MM-DD)
      const [ano, mes] = dataVencimento.split('-').map(Number);
      if (mes - 1 !== currentMonth || ano !== currentYear) return;

      const recipient: WhapiBulkRecipient = {
        clienteId: cliente.id || '',
        nome: cliente.razao || cliente.nome || 'Cliente',
        telefone: cliente.telefone_celular,
        fatura: {
          id: fatura.id || '',
          valor: valor,
          dataVencimento: dataVencimento,
          diasAtraso: calculateDaysOverdue(dataVencimento),
          linkBoleto: (fatura.gateway_link || fatura.link_getwere || fatura.url_boleto || fatura.b_link_getwere || '') as string,
        },
      };

      // Agrupar pela data de vencimento
      if (!groups[dataVencimento]) {
        groups[dataVencimento] = [];
      }
      groups[dataVencimento].push(recipient);
    });

    // Converter para array de GroupedClients e ordenar por data
    const sortedGroups = Object.entries(groups)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB)) // Ordenar datas (mais antigas primeiro)
      .map(([date, clients]) => {
        const diasAtraso = calculateDaysOverdue(date);
        
        let label = `Vencimento: ${formatDate(date)}`;
        let color = 'bg-blue-500';
        let icon = '🔵';

        // Definir cor e ícone baseados no atraso
        if (diasAtraso > 0) {
          color = 'bg-red-500';
          icon = '🔴';
          label += ` (${diasAtraso} dias de atraso)`;
        } else if (diasAtraso === 0) {
          color = 'bg-yellow-500';
          icon = '🟡';
          label += ` (Vence Hoje)`;
        } else {
          color = 'bg-green-500';
          icon = '🟢';
          label += ` (Em dia)`;
        }

        return {
          group: date, // A chave do grupo agora é a própria data (YYYY-MM-DD)
          label,
          count: clients.length,
          clients,
          color,
          icon,
        };
      });

    return sortedGroups;
  };

  // Search for clients by name or phone
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    // Build a comprehensive list from ALL open invoices (not just current month)
    const allClientsMap = new Map<string, { phones: string[], fatura: any, cliente: any }>();
    
    data.faturas.forEach((fatura) => {
      const valor = parseFloat(fatura.valor || '0');
      const cliente = data.clientes.find((c) => String(c.id) === String(fatura.id_cliente || fatura.cliente_id));
      
      // Filter: only active clients
      if (!cliente || cliente.ativo !== 'S') return;
      
      const dataVencimento = fatura.data_vencimento as string;
      if (!dataVencimento) return;
      
      const clienteId = cliente.id || '';
      
      // Get ALL phone numbers for this client
      const phones = ixcService.getClientPhones(cliente);
      
      // Skip if no valid phones
      if (phones.length === 0) return;
      
      // If client already exists, keep the oldest (most overdue) invoice
      if (allClientsMap.has(clienteId)) {
        const existing = allClientsMap.get(clienteId)!;
        const existingDate = new Date(existing.fatura.dataVencimento);
        const currentDate = new Date(dataVencimento);
        
        // Only update if this invoice is older
        if (currentDate >= existingDate) return;
      }
      
      // Store client with all phones and invoice data
      allClientsMap.set(clienteId, {
        phones,
        cliente,
        fatura: {
          id: fatura.id || '',
          valor: valor,
          dataVencimento: dataVencimento,
          diasAtraso: calculateDaysOverdue(dataVencimento),
          linkBoleto: (fatura.gateway_link || fatura.link_getwere || fatura.url_boleto || fatura.b_link_getwere || '') as string,
        }
      });
    });

    // Convert to WhapiBulkRecipient array (one entry per client, with primary phone)
    const allClients: WhapiBulkRecipient[] = [];
    allClientsMap.forEach((data, clienteId) => {
      allClients.push({
        clienteId,
        nome: data.cliente.razao || data.cliente.nome || 'Cliente',
        telefone: data.phones[0], // Primary phone for display
        fatura: data.fatura,
        // Store all phones in a custom property (will use in send function)
        allPhones: data.phones as any
      });
    });

    // Filter by name or phone
    const results = allClients.filter(client => 
      client.nome.toLowerCase().includes(query.toLowerCase()) ||
      client.telefone.includes(query) ||
      (client as any).allPhones?.some((p: string) => p.includes(query))
    );

    setSearchResults(results);
  };

  // Send message to a single client (ALL their phone numbers)
  const handleSendToSingleClient = async (client: WhapiBulkRecipient) => {
    setSelectedClient(client);
    setSendingToClient(true);

    // Get all phones for this client
    const allPhones = (client as any).allPhones || [client.telefone];
    const totalPhones = allPhones.length;

    try {
      // Send email first if not in warmup mode
      if (!warmupMode && client.fatura?.id) {
        toast({
          title: 'Enviando E-mail',
          description: `Enviando e-mail de cobrança para ${client.nome}...`,
        });
        
        await ixcService.sendEmailFatura(client.fatura.id);
        await new Promise(r => setTimeout(r, 2000));
      }

      const diasAtraso = client.fatura.diasAtraso;

      // ⚠️ Verificar link de pagamento (muito importante!)
      let linkBoleto = client.fatura.linkBoleto || '';
      if (!linkBoleto && !warmupMode) {
        toast({
          title: '⚠️ Link de pagamento não encontrado',
          description: `Enviando e-mail para gerar o link da fatura de ${client.nome}...`,
          variant: 'destructive',
        });
        if (client.fatura?.id) {
          try {
            await ixcService.sendEmailFatura(client.fatura.id);
            await new Promise(r => setTimeout(r, 3000));
          } catch (e) {
            console.warn('Não foi possível gerar link via e-mail:', e);
          }
        }
        linkBoleto = 'Solicite a 2ª via pelo nosso atendimento';
        toast({
          title: 'ℹ️ Enviando sem link de boleto',
          description: 'A mensagem será enviada sem o link de pagamento. Oriente o cliente a solicitar a 2ª via.',
        });
      }

      // Send to ALL phones
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < allPhones.length; i++) {
        const phone = allPhones[i];

        // Gerar mensagem via IA (Gemini) ou fallback para template
        let messageBody: string | null = null;

        if (!warmupMode) {
          toast({
            title: `🤖 Gerando mensagem ${i + 1}/${totalPhones}`,
            description: `Personalizando mensagem para ${client.nome}...`,
          });
          messageBody = await generateAIBillingMessage({
            nomeCliente: client.nome,
            valor: `R$ ${formatCurrency(client.fatura.valor)}`,
            dataVencimento: formatDate(client.fatura.dataVencimento),
            diasAtraso,
            linkBoleto,
          });
        }

        // Fallback se Gemini falhar ou for warmup
        if (!messageBody) {
          const templateGroup = warmupMode ? 'warmup' : (diasAtraso > 0 ? 'vencidas_' + diasAtraso : diasAtraso === 0 ? 'vencendo_hoje' : 'vencendo_breve');
          const templateData = {
            nome: client.nome,
            valor: formatCurrency(client.fatura.valor),
            data_vencimento: formatDate(client.fatura.dataVencimento),
            dias_atraso: diasAtraso.toString(),
            dias_restantes: diasAtraso < 0 ? Math.abs(diasAtraso).toString() : '0',
            link_boleto: linkBoleto,
          };
          messageBody = spin(fillTemplate(getTemplateForGroup(templateGroup), templateData));
        }

        toast({
          title: `💬 Enviando ${i + 1}/${totalPhones}`,
          description: `Enviando mensagem para ${client.nome} (${phone})...`,
        });

        const result = await whapiService.sendMessage({
          to: phone,
          body: messageBody,
          typing_time: Math.min(Math.floor(messageBody.length / 5) * 1000, 10000),
        });

        // Log
        const log: WhapiSendLog = {
          timestamp: new Date().toISOString(),
          clienteId: client.clienteId,
          clienteNome: `${client.nome} (${i + 1}/${totalPhones})`,
          telefone: phone,
          status: result.sent ? 'success' : 'failed',
          error: result.error,
          messageId: result.id,
        };
        setLogs(prev => [log, ...prev]);

        if (result.sent) {
          successCount++;
        } else {
          failCount++;
        }

        // Pausa entre envios (anti-ban)
        if (i < allPhones.length - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      // Final summary toast
      if (successCount > 0) {
        toast({
          title: 'Envio Concluído',
          description: `${successCount} de ${totalPhones} mensagens enviadas com sucesso para ${client.nome}`,
        });
      }

      if (failCount > 0) {
        toast({
          title: 'Algumas Falhas',
          description: `${failCount} de ${totalPhones} mensagens falharam`,
          variant: 'destructive'
        });
      }

    } catch (error) {
      toast({
        title: 'Erro ao Enviar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSendingToClient(false);
      setSelectedClient(null);
    }
  };

  const handleSendAITest = async (type: 'billing' | 'blocked') => {
    if (!testPhoneNumber) {
      toast({
        title: 'Número necessário',
        description: 'Por favor, informe seu número de WhatsApp para o teste.',
        variant: 'destructive',
      });
      return;
    }

    setIsTestingAI(true);
    try {
      let messageBody: string | null = null;
      
      if (type === 'billing') {
        toast({
          title: '🤖 Gerando Teste (Fatura)',
          description: 'Aguarde um momento...',
        });
        messageBody = await generateAIBillingMessage({
          nomeCliente: 'Cliente de Teste',
          valor: 'R$ 149,90',
          dataVencimento: formatDate(new Date().toISOString()),
          diasAtraso: 5,
          linkBoleto: 'https://preview.avl-telecom.com/teste-boleto',
        });
      } else {
        toast({
          title: '🤖 Gerando Teste (Bloqueio)',
          description: 'Aguarde um momento...',
        });
        messageBody = await generateAIBlockedMessage({
          nomeCliente: 'Cliente de Teste',
          dataVencimento: formatDate(new Date().toISOString()),
          totalFaturas: 2,
          valorTotal: 'R$ 299,80',
          linkBoleto: 'https://preview.avl-telecom.com/teste-bloqueio',
        });
      }

      if (!messageBody) throw new Error('Falha ao gerar mensagem com IA.');

      toast({
        title: '📱 Enviando Teste...',
        description: `Enviando para ${testPhoneNumber}`,
      });

      const result = await whapiService.sendMessage({
        to: testPhoneNumber,
        body: messageBody,
        typing_time: 3000,
      });

      if (result.sent) {
        toast({
          title: '✅ Teste Enviado!',
          description: 'Verifique seu WhatsApp para ver a mensagem gerada.',
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: '❌ Falha no Teste',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsTestingAI(false);
    }
  };

  const handlePreview = async (group: GroupedClients) => {
    if (group.clients.length === 0) return;
    
    // Verificar progresso salvo
    let clientsToSend = [...group.clients];
    let msg = null;

    try {
      const lastClientId = await whapiService.getLastProgress(group.group);
      if (lastClientId) {
          const index = group.clients.findIndex(c => String(c.clienteId) === String(lastClientId));
          
          if (index !== -1) {
             // Se encontrou, começar do PRÓXIMO
             if (index < group.clients.length - 1) {
                clientsToSend = group.clients.slice(index + 1);
                msg = `Retomando envio a partir de onde parou. ${index + 1} clientes já foram processados anteriormente.`;
             } else {
                clientsToSend = [];
                msg = `Todos os clientes deste grupo já foram processados!`;
                
                toast({
                    title: 'Grupo já concluído',
                    description: 'Todos os clientes deste grupo já receberam mensagem.',
                    variant: 'default',
                    className: 'bg-green-100 border-green-200'
                });
             }
          }
      }
    } catch (e) {
        console.error('Erro ao verificar progresso:', e);
    }
    
    setResumeMessage(msg);
    setFilteredClients(clientsToSend);
    setPreviewGroup(group);

    if (clientsToSend.length > 0) {
        // Gerar preview com o primeiro cliente da lista FILTRADA
        const recipient = clientsToSend[0];
        const templateData = {
          nome: recipient.nome,
          valor: formatCurrency(recipient.fatura.valor),
          data_vencimento: formatDate(recipient.fatura.dataVencimento),
          dias_atraso: recipient.fatura.diasAtraso.toString(),
          link_boleto: recipient.fatura.linkBoleto || 'https://seu-provedor.com/fatura/...'
        };
        
        const template = getTemplateForGroup(warmupMode ? 'warmup' : group.group);
        const messageBody = fillTemplate(template, templateData);
        setPreviewMessage(messageBody);
    } else {
        setPreviewMessage("Todos os clientes já foram processados.");
    }
  };

  const confirmSend = async () => {
    if (!previewGroup || filteredClients.length === 0) return;
    
    const group = previewGroup;
    const clients = filteredClients; // Usar a lista filtrada

    setPreviewGroup(null);
    setSending(true);
    // Ajustar o total para mostrar apenas o que será enviado nesta sessão
    setProgress({ total: clients.length, sent: 0, failed: 0 });
    setLogs([]);

    try {
      const groupLogs = await whapiService.sendBulkMessages(
        clients, // Enviar apenas os clientes filtrados
        warmupMode ? 'warmup' : group.group,
        (prog) => setProgress(prog),
        (log) => setLogs((prev) => [...prev, log]),
        async (recipient) => {
          // No modo aquecimento, NÃO enviamos e-mail de cobrança
          if (!warmupMode && recipient.fatura?.id) {
             // Atualizar UI para mostrar que está enviando e-mail
             setProgress(prev => prev ? { ...prev, current: `📧 Enviando E-mail para ${recipient.nome}...` } : prev);
             
             // Disparar e-mail pelo IXC
             await ixcService.sendEmailFatura(recipient.fatura.id);
             // Aguardar 2 segundos para garantir processamento/geração do link
             await new Promise(r => setTimeout(r, 2000)); 
          }
          
          // Atualizar UI para mostrar que está enviando WhatsApp
          setProgress(prev => prev ? { ...prev, current: `📱 Enviando WhatsApp para ${recipient.nome}...` } : prev);
        }
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

  const handleSendAllBlocked = async () => {
    // Pegar apenas os que não foram enviados nas últimas 24h
    const pendingContracts = data.blockedContracts.filter(c => !isBlocked24h(c.id));
    
    if (pendingContracts.length === 0) {
      toast({
        title: 'Tudo certo!',
        description: 'Todos os clientes bloqueados já foram notificados nas últimas 24h.',
      });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const recipients: WhapiBulkRecipient[] = [];

    // Mapear contratos para o formato WhapiBulkRecipient
    for (const contract of pendingContracts) {
      const cliente = data.clientes.find(c => String(c.id) === String(contract.id_cliente));
      if (!cliente || !cliente.telefone_celular || cliente.ativo !== 'S') continue;

      const faturasAtrasadas = data.faturas.filter(f =>
        String(f.id_cliente) === String(cliente.id) && 
        !f.data_pagamento &&
        f.data_vencimento < today
      );
      
      if (faturasAtrasadas.length === 0) continue;

      // Ordenar por data (mais antiga primeiro)
      faturasAtrasadas.sort((a, b) => 
        new Date(a.data_vencimento as string).getTime() - new Date(b.data_vencimento as string).getTime()
      );

      const faturaVencida = faturasAtrasadas[0];
      const linkBoleto = ((faturaVencida.gateway_link || faturaVencida.link_getwere || faturaVencida.url_boleto || faturaVencida.b_link_getwere || '') as string);
      const totalValor = faturasAtrasadas.reduce((acc, f) => acc + parseFloat(f.valor || '0'), 0);
      const diasAtraso = calculateDaysOverdue(faturaVencida.data_vencimento as string);

      recipients.push({
        clienteId: cliente.id || '',
        nome: cliente.razao || cliente.nome || 'Cliente',
        telefone: cliente.telefone_celular,
        fatura: {
          id: faturaVencida.id || '',
          valor: totalValor,
          dataVencimento: faturaVencida.data_vencimento as string,
          diasAtraso,
          linkBoleto,
          // Guardar a quantidade real para usar na geração de texto (usando um campo extra)
          totalFaturasAtrasadas: faturasAtrasadas.length
        } as any // Forçando any para aceitar a propriedade extra (totalFaturasAtrasadas) sem quebrar tipagem global
      });
    }

    if (recipients.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Não foram encontrados clientes válidos com faturas em atraso.',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingBlockedBulk(true);
    setProgress({ total: recipients.length, sent: 0, failed: 0 });
    setLogs([]);

    try {
      // Usar a mesma engine de envio em massa (sendBulkMessages)
      // Passar o grupo 'blocked_clients' (o whapiService tratará com a mesma proteção anti-ban)
      const groupLogs = await whapiService.sendBulkMessages(
        recipients,
        'blocked_clients',
        (prog) => setProgress(prog),
        (log) => setLogs((prev) => [...prev, log]),
        async (recipient) => {
          // Atualizar interface
          setProgress(prev => prev ? { ...prev, current: `Gerando cobrança para ${recipient.nome}...` } : prev);
        },
        async (recipient) => {
          // Override da mensagem: Usar a IA de bloqueio ao invés da cobrança padrão
          const totalFaturasAtrasadas = (recipient.fatura as any).totalFaturasAtrasadas || 1;
          const valorTotalFormat = `R$ ${formatCurrency(recipient.fatura.valor)}`;
          const linkBoleto = recipient.fatura.linkBoleto || undefined;
          
          let overrideMsg = await generateAIBlockedMessage({
            nomeCliente: recipient.nome,
            dataVencimento: formatDate(recipient.fatura.dataVencimento),
            totalFaturas: totalFaturasAtrasadas,
            valorTotal: valorTotalFormat,
            linkBoleto,
          });

          // Fallback caso a IA do Google falhe
          if (!overrideMsg) {
             const faturasTexto = totalFaturasAtrasadas > 1
                ? `*${totalFaturasAtrasadas} faturas* em atraso totalizando *${valorTotalFormat}* (a mais antiga com vencimento em *${formatDate(recipient.fatura.dataVencimento)}*)`
                : `1 fatura no valor de *${valorTotalFormat}* com vencimento em *${formatDate(recipient.fatura.dataVencimento)}*`;
             overrideMsg = `Olá ${recipient.nome}, sua internet foi bloqueada por inadimplência. Identificamos ${faturasTexto}.\n\n${linkBoleto ? `👉 Link para pagamento: ${linkBoleto}\n\n` : ''}Para regularizar e reativar seu acesso, responda esta mensagem.\n\n_Att, Equipe AVL Telecom_`;
          }

          return overrideMsg;
        }
      );

      // Salvar os timestamps
      groupLogs.forEach(log => {
        if (log.status === 'success') {
           // Em recipients, temos clienteId. Precisamos encontrar o contratoId associado.
           const contract = pendingContracts.find(c => String(c.id_cliente) === String(log.clienteId));
           if (contract && contract.id) saveSentTimestamp(contract.id);
        }
      });

      toast({
        title: 'Envio concluído',
        description: `${groupLogs.filter((l) => l.status === 'success').length} notificações enviadas com sucesso`,
      });
    } catch (error) {
      toast({
        title: 'Erro no envio automático',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsSendingBlockedBulk(false);
      setProgress(null);
    }
  };

  // Estado para controlar envio individual e bloqueio 24h
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [sentMap, setSentMap] = useState<Record<string, number>>({});

  // Carregar histórico de envios do localStorage ao iniciar
  useEffect(() => {
    const saved = localStorage.getItem('ixc_blocked_sent_map');
    if (saved) {
      try {
        setSentMap(JSON.parse(saved));
      } catch (e) {
        console.error('Erro ao carregar histórico de envios', e);
      }
    }
  }, []);

  const saveSentTimestamp = (contractId: string | undefined) => {
    if (!contractId) return;
    try {
        const id = String(contractId);
        const newMap = { ...sentMap, [id]: Date.now() };
        setSentMap(newMap);
        localStorage.setItem('ixc_blocked_sent_map', JSON.stringify(newMap));
    } catch (error) {
        console.error('Erro ao salvar timestamp', error);
    }
  };

  const isBlocked24h = (contractId: string | undefined) => {
    if (!contractId) return false;
    try {
        const id = String(contractId);
        const lastSent = sentMap[id];
        if (!lastSent) return false;
        const hours24 = 24 * 60 * 60 * 1000;
        return (Date.now() - lastSent) < hours24;
    } catch (error) {
        console.error('Erro ao verificar bloqueio 24h', error);
        return false;
    }
  };

  const handleResolveBlocked = async (contract: IXCContratoData) => {
    if (isBlocked24h(contract.id)) return;

    const cliente = data.clientes.find(c => String(c.id) === String(contract.id_cliente));
    
    if (!cliente || !cliente.telefone_celular) {
      toast({
        title: 'Erro ao notificar',
        description: 'Cliente não encontrado ou sem telefone cadastrado.',
        variant: 'destructive',
      });
      return;
    }

    // Buscar TODAS as faturas vencidas deste cliente (abertas e data menor que hoje)
    const today = new Date().toISOString().split('T')[0];
    const faturasCliente = data.faturas.filter(f =>
      String(f.id_cliente) === String(cliente.id) &&
      !f.data_pagamento &&
      f.data_vencimento < today
    );
    // Ordenar por data de vencimento (mais antiga primeiro)
    faturasCliente.sort((a, b) =>
      new Date(a.data_vencimento as string).getTime() - new Date(b.data_vencimento as string).getTime()
    );

    // Calcular totais financeiros
    const totalFaturas = faturasCliente.length;
    const totalValor = faturasCliente.reduce((acc, f) => acc + parseFloat(f.valor || '0'), 0);
    const valorTotal = `R$ ${formatCurrency(totalValor)}`;

    // Fatura mais antiga = principal responsável pelo bloqueio
    const faturaVencida = faturasCliente[0];
    const dataVencimento = faturaVencida
      ? formatDate(faturaVencida.data_vencimento as string)
      : 'data não identificada';
    const linkBoleto = faturaVencida
      ? ((faturaVencida.gateway_link || faturaVencida.link_getwere || faturaVencida.url_boleto || faturaVencida.b_link_getwere || '') as string)
      : '';

    const nomeCliente = cliente.razao || cliente.nome || 'Cliente';

    setResolvingId(contract.id || null);

    try {
      // Gerar mensagem via IA (Gemini) com dados financeiros completos do IXC
      let messageBody = await generateAIBlockedMessage({
        nomeCliente,
        dataVencimento,
        totalFaturas: totalFaturas || 1,
        valorTotal,
        linkBoleto: linkBoleto || undefined,
      });

      // Fallback enriquecido: usado se Gemini falhar
      if (!messageBody) {
        const faturasTexto = totalFaturas > 1
          ? `*${totalFaturas} faturas* em aberto totalizando *${valorTotal}* (a mais antiga com vencimento em *${dataVencimento}*)`
          : `1 fatura no valor de *${valorTotal}* com vencimento em *${dataVencimento}*`;
        messageBody = `Olá ${nomeCliente}, sua internet foi bloqueada por inadimplência. Identificamos ${faturasTexto}.\n\n${linkBoleto ? `👉 Link para pagamento: ${linkBoleto}\n\n` : ''}Para regularizar e reativar seu acesso, responda esta mensagem.\n\n_Att, Equipe AVL Telecom_`;
      }

      const result = await whapiService.sendMessage({
        to: cliente.telefone_celular,
        body: messageBody,
        typing_time: Math.min(Math.floor(messageBody.length / 5) * 1000, 8000),
      });

      if (result.sent) {
        toast({
          title: 'Notificação Enviada',
          description: `Mensagem de desbloqueio enviada para ${cliente.nome}`,
        });
        if (contract.id) saveSentTimestamp(contract.id);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
       toast({
        title: 'Falha no Envio',
        description: error instanceof Error ? error.message : 'Erro ao enviar mensagem',
        variant: 'destructive'
       });
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <PageTransition>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Envio em Massa WhatsApp</h1>
            <p className="text-muted-foreground italic">Powered by Gemini AI 🤖</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2 bg-muted p-2 rounded-lg border">
              <Label htmlFor="warmup" className="cursor-pointer">Modo Aquecimento (Sem Link)</Label>
              <Switch id="warmup" checked={warmupMode} onCheckedChange={setWarmupMode} />
            </div>
            <Button onClick={loadData} disabled={loading} variant="outline" className="min-w-[160px]">
              <Database className="mr-2 h-4 w-4" />
              {loading ? (loadingMessage || 'Carregando...') : 'Atualizar Dados'}
            </Button>
          </div>
        </div>

        {/* AI Testing Tools */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Teste de Mensagens IA
            </CardTitle>
            <CardDescription>
              Teste a variabilidade e o humor das novas mensagens geradas pela inteligência artificial.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="test-phone">Seu WhatsApp (com DDD)</Label>
                <Input 
                  id="test-phone" 
                  placeholder="Ex: 5511999999999" 
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                />
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <Button 
                  onClick={() => handleSendAITest('billing')} 
                  disabled={isTestingAI} 
                  variant="secondary"
                  className="bg-white"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Testar Cobrança (Fatura)
                </Button>
                <Button 
                  onClick={() => handleSendAITest('blocked')} 
                  disabled={isTestingAI} 
                  variant="secondary"
                  className="bg-white"
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Testar Alerta (Bloqueio)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search for Individual Client */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-600" />
              Enviar para Cliente Individual
            </CardTitle>
            <CardDescription>
              Pesquise um cliente específico por nome ou telefone e envie uma mensagem individual
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Digite o nome ou telefone do cliente..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="flex-1"
              />
              {searchQuery && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                >
                  ✕
                </Button>
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                <p className="text-sm text-muted-foreground">
                  {searchResults.length} cliente{searchResults.length !== 1 ? 's' : ''} encontrado{searchResults.length !== 1 ? 's' : ''}
                </p>
                {searchResults.map((client) => (
                  <div
                    key={client.clienteId}
                    className="flex items-center justify-between p-4 bg-white rounded-lg border hover:border-blue-300 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{client.nome}</p>
                        {((client as any).allPhones?.length || 1) > 1 && (
                          <Badge variant="secondary" className="text-xs">
                            {(client as any).allPhones?.length || 1} contatos
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{client.telefone}</p>
                      <div className="flex gap-4 mt-2 text-sm">
                        <span className="text-gray-700">
                          Valor: <strong>R$ {client.fatura.valor.toFixed(2)}</strong>
                        </span>
                        <span className={client.fatura.diasAtraso > 0 ? 'text-red-600' : 'text-green-600'}>
                          Vencimento: <strong>{formatDate(client.fatura.dataVencimento)}</strong>
                          {client.fatura.diasAtraso > 0 && ` (${client.fatura.diasAtraso} dias de atraso)`}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        onClick={() => handleSendToSingleClient(client)}
                        disabled={sendingToClient && selectedClient?.clienteId === client.clienteId}
                      >
                        {sendingToClient && selectedClient?.clienteId === client.clienteId ? (
                          <>
                            <Clock className="mr-2 h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Enviar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum cliente encontrado com "{searchQuery}"</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grupos de Vencimento */}
        {groupedClients.length === 0 && !loading && (
          <div className="text-center py-12 bg-muted/20 rounded-lg">
            <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhum cliente encontrado</h3>
            <p className="text-muted-foreground">Tente ajustar os filtros ou clique em Atualizar Dados</p>
          </div>
        )}
        {/* Seção de Clientes Bloqueados Automaticamente (Agrupada no Topo) */}
        {data.blockedContracts.length > 0 && (
          <div className="w-full mb-6">
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-6 h-6" />
                    Clientes Bloqueados / Cancelamento Automático ({data.blockedContracts.length})
                  </CardTitle>
                  <CardDescription>
                    Contratos com status de internet <strong>CA</strong> (Cancelamento Automático). Estes clientes não aparecem na lista normal de cobrança.
                  </CardDescription>
                </div>
                <Button 
                  onClick={handleSendAllBlocked}
                  disabled={isSendingBlockedBulk || (data.blockedContracts.filter(c => !isBlocked24h(c.id)).length === 0)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isSendingBlockedBulk ? (
                    <><Clock className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
                  ) : (
                    <><PlayCircle className="mr-2 h-4 w-4" /> Notificar Todos</>
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2">
                  {data.blockedContracts.map(contract => {
                     const cliente = data.clientes.find(c => String(c.id) === String(contract.id_cliente));
                     const today = new Date().toISOString().split('T')[0];
                     const faturasAtrasadas = data.faturas.filter(f =>
                       String(f.id_cliente) === String(contract.id_cliente) && 
                       !f.data_pagamento &&
                       f.data_vencimento < today
                     );
                     const totalAtraso = faturasAtrasadas.reduce((acc, f) => acc + parseFloat(f.valor || '0'), 0);
                     return (
                       <div key={contract.id} className="flex items-center justify-between p-3 bg-white rounded shadow-sm border border-red-100">
                          <div>
                            <p className="font-semibold text-gray-800">{cliente?.nome || cliente?.razao || 'Cliente Desconhecido'}</p>
                            <p className="text-sm text-gray-500">Contrato: {contract.id} | Status: {contract.status_internet}</p>
                            {cliente?.telefone_celular && <p className="text-xs text-gray-400">{cliente.telefone_celular}</p>}
                            {faturasAtrasadas.length > 0 && (
                              <p className="text-xs font-semibold text-red-600 mt-1">
                                🧾 {faturasAtrasadas.length} fatura{faturasAtrasadas.length > 1 ? 's' : ''} em atraso — R$ {formatCurrency(totalAtraso)}
                              </p>
                            )}
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className={`${
                                isBlocked24h(contract.id) 
                                    ? 'text-gray-400 border-gray-200 bg-gray-50' 
                                    : 'text-red-600 border-red-200 hover:bg-red-50'
                            }`}
                            disabled={resolvingId === contract.id || isBlocked24h(contract.id)}
                            onClick={() => handleResolveBlocked(contract)}
                          >
                            {resolvingId === contract.id ? (
                                <Clock className="w-4 h-4 animate-spin mr-2" />
                            ) : isBlocked24h(contract.id) ? (
                                <CheckCircle className="w-4 h-4 mr-2" />
                            ) : (
                                <Send className="w-4 h-4 mr-2" />
                            )}
                            <span>{isBlocked24h(contract.id) ? 'Enviado' : 'Resolver'}</span>
                          </Button>
                       </div>
                     );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Seção de Clientes Bloqueados Automaticamente (Agrupada no Topo) */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groupedClients.map((group) => (
            <motion.div
              key={group.group}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card 
                className="hover:shadow-lg transition-shadow h-full flex flex-col cursor-pointer active:scale-95 transition-transform"
                onClick={() => handlePreview(group)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-base">
                      <span>{group.icon}</span>
                      <span>{group.label}</span>
                    </span>
                    <Badge variant="secondary">{group.count}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {group.count} cliente{group.count !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button
                    onClick={() => handlePreview(group)}
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
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 animate-spin text-primary" />
                Enviando mensagens...
              </CardTitle>
              <CardDescription>
                <strong>IMPORTANTE:</strong> Não feche esta aba enquanto o envio estiver em andamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2 font-medium">
                  <span>Progresso da Sessão</span>
                  <span>
                    {progress.sent} / {progress.total}
                  </span>
                </div>
                <Progress value={(progress.sent / progress.total) * 100} className="h-2" />
              </div>
              {progress.current && (
                <p className="text-sm text-foreground/80">
                  Atividade atual: <span className="font-semibold">{progress.current}</span>
                </p>
              )}
              <div className="flex gap-4 text-sm font-medium">
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
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {logs.slice(-20).reverse().map((log, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-md border ${
                      log.status === 'success' ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {log.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{log.clienteNome}</span>
                        <span className="text-xs text-muted-foreground">{log.telefone}</span>
                      </div>
                    </div>
                    {log.error && (
                      <span className="text-xs text-red-600 font-medium">{log.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog de Preview */}
      <Dialog open={!!previewGroup} onOpenChange={(open) => !open && setPreviewGroup(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Confirmar Envio ({filteredClients.length} clientes)</DialogTitle>
            <DialogDescription>
              Grupo: <span className="font-semibold text-foreground">{previewGroup?.label}</span>
            </DialogDescription>
          </DialogHeader>

          {resumeMessage && (
             <Alert className="bg-blue-50 border-blue-200">
               <div className="flex items-start gap-2">
                 <PlayCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                 <div>
                    <AlertTitle className="text-blue-800 font-semibold mb-1">Recuperação de Sessão</AlertTitle>
                    <AlertDescription className="text-blue-700">
                      {resumeMessage}
                    </AlertDescription>
                 </div>
               </div>
             </Alert>
          )}
          
          <div className="flex-1 overflow-y-auto min-h-[150px] border rounded-md p-2 space-y-2">
            <h4 className="text-sm font-medium sticky top-0 bg-background pb-2 border-b">
                Lista de Destinatários ({filteredClients.length}):
            </h4>
            {filteredClients.map((client, idx) => (
              <div key={`${client.clienteId}-${idx}`} className="flex items-center justify-between text-sm p-2 hover:bg-muted rounded">
                <div className="flex flex-col">
                  <span className="font-medium">{client.nome}</span>
                  <span className="text-xs text-muted-foreground">{client.telefone}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-medium">R$ {client.fatura.valor.toFixed(2)}</span>
                  <span className={`text-xs ${client.fatura.diasAtraso > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    Vence: {formatDate(client.fatura.dataVencimento)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-muted p-4 rounded-md mt-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Modelo da Mensagem (Exemplo):</h4>
            <pre className="whitespace-pre-wrap text-sm font-sans text-foreground/90 leading-relaxed max-h-32 overflow-y-auto">
              {previewMessage}
            </pre>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-2">
            <Button variant="outline" onClick={() => setPreviewGroup(null)}>Cancelar</Button>
            <Button onClick={confirmSend} className="gap-2" disabled={filteredClients.length === 0}>
              <Send className="h-4 w-4" />
              {filteredClients.length === 0 ? 'Nada a enviar' : 'Confirmar e Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
