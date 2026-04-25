
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, 
  MapPin, 
  CreditCard, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  Loader2,
  Tag as TagIcon,
  Search,
  X,
  Bot,
  Sparkles,
  Zap
} from "lucide-react";
import { ixcService } from "@/services/ixc/ixcService";
import { IXCClienteData, IXCContratoData, IXCFaturaData } from "@/types/ixc";
import { db } from "@/config/firebase";
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";

interface ClientInfoCardProps {
  clientId: string; // ID do cliente no sistema (geralmente telefone no WhatsApp)
  clientPhone?: string;
  clientName?: string;
  onSendMessage?: (message: string) => void;
}

const AVAILABLE_TAGS = [
  { id: 'suporte', label: 'Suporte', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'financeiro', label: 'Financeiro', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'vendas', label: 'Vendas', color: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'urgente', label: 'Urgente', color: 'bg-red-100 text-red-700 border-red-200' },
  { id: 'resolvido', label: 'Resolvido', color: 'bg-gray-100 text-gray-700 border-gray-200' },
];

export default function ClientInfoCard({ clientId, clientPhone, clientName, onSendMessage }: ClientInfoCardProps) {
  const [loading, setLoading] = useState(true);
  const [ixcData, setIxcData] = useState<IXCClienteData | null>(null);
  const [contracts, setContracts] = useState<IXCContratoData[]>([]);
  const [invoices, setInvoices] = useState<IXCFaturaData[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);

  // Carregar tags do Firestore em tempo real
  useEffect(() => {
    if (!clientId) return;
    const unsub = onSnapshot(doc(db, "chat", clientId), (snap) => {
      if (snap.exists()) {
        setActiveTags(snap.data().tags || []);
      }
    });
    return () => unsub();
  }, [clientId]);

  const [faturasCount, setFaturasCount] = useState(0);
  const [aiEnabled, setAiEnabled] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    
    // Escutar mudanças no documento do cliente para pegar o status da IA e tags
    const unsub = onSnapshot(doc(db, "chat", clientId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setAiEnabled(data.aiEnabled || false);
      }
    });

    return () => unsub();
  }, [clientId]);

  const toggleAI = async () => {
    if (!clientId) return;
    try {
      const newStatus = !aiEnabled;
      await updateDoc(doc(db, "chat", clientId), {
        aiEnabled: newStatus
      });
      toast.success(newStatus ? "🤖 IA Ativada para este cliente" : "👤 IA Desativada - Atendimento Humano");
    } catch (error) {
      toast.error("Erro ao alterar status da IA");
    }
  };

  // Carregar dados do IXC
  useEffect(() => {
    const fetchIxcData = async () => {
      setLoading(true);
      try {
        let client = null;
        
        // Tentar buscar por telefone primeiro se disponível
        const phoneToSearch = clientPhone || clientId;
        if (phoneToSearch) {
          client = await ixcService.getClienteByPhone(phoneToSearch);
        }
        
        // Se não achou por telefone, tenta por nome
        if (!client && clientName) {
          const results = await ixcService.getClienteByNome(clientName);
          if (results.length > 0) client = results[0];
        }

        if (client) {
          setIxcData(client);
          // Buscar contratos e faturas
          const [clientContracts, clientInvoices] = await Promise.all([
            ixcService.getContratosByCliente(client.id),
            ixcService.getFaturasByCliente(client.id)
          ]);
          setContracts(clientContracts);
          // Filtrar apenas faturas abertas (status 'A') e sem data de pagamento
          const openInvoices = clientInvoices.filter(f => f.status === 'A' && !f.pagamento_data);
          setInvoices(openInvoices.slice(0, 3)); 
        }
      } catch (error) {
        console.error("Erro ao carregar dados do IXC:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchIxcData();
  }, [clientPhone, clientName]);

  const toggleTag = async (tagId: string) => {
    try {
      const chatRef = doc(db, "chat", clientId);
      if (activeTags.includes(tagId)) {
        await updateDoc(chatRef, { tags: arrayRemove(tagId) });
      } else {
        await updateDoc(chatRef, { tags: arrayUnion(tagId) });
      }
    } catch (error) {
      toast.error("Erro ao atualizar tags");
    }
  };

  const handleSendPix = async (faturaId: string, valor: string, vencimento: string) => {
    if (!onSendMessage) return;
    
    try {
      toast.loading("Gerando PIX...", { id: 'pix-task' });
      const pixData = await ixcService.getPixQrCode(faturaId);
      
      if (pixData && pixData.qrcode_text) {
        const message = `✅ *Código PIX Gerado*\n\n💰 *Valor:* R$ ${valor}\n📅 *Vencimento:* ${vencimento}\n\n👇 *Copia e Cola:*\n\n${pixData.qrcode_text}\n\n_Para pagar, abra o app do seu banco e escolha a opção "PIX Copia e Cola"._`;
        onSendMessage(message);
        toast.success("PIX enviado com sucesso!", { id: 'pix-task' });
      } else {
        toast.error("Não foi possível gerar o PIX para esta fatura.", { id: 'pix-task' });
      }
    } catch (error) {
      toast.error("Erro ao gerar PIX.", { id: 'pix-task' });
    }
  };

  if (loading) {
    return (
      <Card className="bg-white shadow-sm border-gray-200 overflow-hidden">
        <CardContent className="p-8 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
          <p className="text-xs text-gray-500 font-medium">Buscando dados no IXC...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Seção de Controle de IA */}
      <Card className={`bg-white shadow-sm border overflow-hidden transition-all duration-300 ${aiEnabled ? 'border-indigo-200 ring-1 ring-indigo-50' : 'border-gray-200'}`}>
        <div className={`h-1 w-full ${aiEnabled ? 'bg-indigo-600 animate-pulse' : 'bg-transparent'}`} />
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl transition-all ${aiEnabled ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-100 text-gray-400'}`}>
                <Bot className={aiEnabled ? "w-4 h-4" : "w-4 h-4"} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-800 uppercase tracking-tight flex items-center gap-1">
                  Assistente IA
                  {aiEnabled && <Sparkles className="w-2.5 h-2.5 text-indigo-500 animate-bounce" />}
                </p>
                <p className="text-[10px] text-gray-500 truncate">
                  {aiEnabled ? 'Gerenciando atendimento' : 'Modo manual ativo'}
                </p>
              </div>
            </div>
            <Button 
              size="sm"
              variant={aiEnabled ? "default" : "outline"}
              className={`h-8 px-3 rounded-lg text-[10px] font-bold transition-all ${
                aiEnabled 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-none' 
                  : 'text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
              onClick={toggleAI}
            >
              {aiEnabled ? 'DESATIVAR' : 'ATIVAR IA'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Seção de Tags */}
      <Card className="bg-white shadow-sm border-gray-200 overflow-hidden">
        <CardHeader className="p-3 border-b bg-gray-50/50">
          <CardTitle className="text-xs font-bold flex items-center gap-2 text-gray-700 uppercase tracking-wider">
            <TagIcon className="w-3.5 h-3.5" />
            Classificação da Conversa
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_TAGS.map((tag) => {
              const isActive = activeTags.includes(tag.id);
              return (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className={`cursor-pointer transition-all border px-2 py-0.5 text-[10px] rounded-full ${
                    isActive ? tag.color : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-300'
                  }`}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.label}
                  {isActive && <CheckCircle2 className="w-2.5 h-2.5 ml-1" />}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Seção de Dados do Cliente */}
      <Card className="bg-white shadow-sm border-gray-200 overflow-hidden">
        <CardHeader className="p-3 border-b bg-gray-50/50">
          <CardTitle className="text-xs font-bold flex items-center gap-2 text-gray-700 uppercase tracking-wider">
            <User className="w-3.5 h-3.5" />
            Dados do Assinante (IXC)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          {ixcData ? (
            <>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{ixcData.razao || ixcData.nome}</p>
                    <p className="text-[10px] text-gray-500 font-mono">ID: {ixcData.id} • {ixcData.cnpj_cpf}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    {ixcData.endereco}, {ixcData.numero}<br />
                    {ixcData.bairro} • {ixcData.cidade}-{ixcData.uf}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight flex items-center gap-1.5">
                  <FileText className="w-3 h-3" />
                  Contratos Ativos
                </p>
                {contracts.length > 0 ? (
                  contracts.map(c => (
                    <div key={c.id} className="p-2 bg-blue-50/50 rounded-lg border border-blue-100/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-blue-900 truncate flex-1">{c.contrato || 'Plano de Internet'}</span>
                        <Badge className={`text-[9px] h-4 ${c.status === 'A' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {c.status === 'A' ? 'Ativo' : 'Bloqueado'}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-blue-600 font-medium mb-2">Logon: {c.login || 'N/A'}</p>
                      
                      {c.status !== 'A' && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="w-full h-6 text-[9px] border-orange-200 text-orange-600 hover:bg-orange-50 font-bold gap-1.5"
                          onClick={async () => {
                            toast.loading("Realizando desbloqueio...", { id: 'unlock-task' });
                            const res = await ixcService.unlockContract(c.id!);
                            if (res.success) {
                              toast.success(res.message, { id: 'unlock-task' });
                              // Opcional: enviar mensagem avisando o cliente
                              if (onSendMessage) onSendMessage(`✅ *Aviso:* Sua conexão foi liberada em confiança! Por favor, reinicie seu equipamento em alguns minutos.`);
                            } else {
                              toast.error(res.message, { id: 'unlock-task' });
                            }
                          }}
                        >
                          <Clock className="w-3 h-3" />
                          DESBLOQUEIO EM CONFIANÇA
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-gray-400 italic">Nenhum contrato encontrado.</p>
                )}
              </div>

              <div className="pt-2 border-t space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight flex items-center gap-1.5">
                  <CreditCard className="w-3 h-3" />
                  Financeiro (Pendentes)
                </p>
                {invoices.length > 0 ? (
                  invoices.map(f => (
                      <div key={f.id} className="p-2 bg-red-50/30 rounded-lg border border-red-100/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-red-400" />
                            <span className="text-[10px] font-medium text-red-700">Venc: {f.data_vencimento}</span>
                          </div>
                          <span className="text-[10px] font-bold text-red-700">R$ {f.valor}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 text-[9px] bg-red-100 hover:bg-red-200 text-red-700 font-bold gap-1"
                            onClick={() => handleSendPix(f.id!, f.valor as string, f.data_vencimento as string)}
                          >
                            <CreditCard className="w-3 h-3" />
                            PIX
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 text-[9px] bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold gap-1"
                            onClick={() => {
                              const paymentLink = f.gateway_link || f.link_getwere || f.url_boleto;
                              if (onSendMessage && paymentLink) {
                                const message = `🔗 *Link de Pagamento*\n\n💰 *Valor:* R$ ${f.valor}\n📅 *Vencimento:* ${f.data_vencimento}\n\nPara pagar, acesse o link abaixo:\n${paymentLink}`;
                                onSendMessage(message);
                                
                                // Copiar para área de transferência também
                                navigator.clipboard.writeText(paymentLink);
                                toast.success("Link enviado e copiado!");
                              } else {
                                toast.error("Link de pagamento não disponível nesta fatura.");
                                console.log("Dados da fatura sem link:", f);
                              }
                            }}
                          >
                            <ExternalLink className="w-3 h-3" />
                            LINK
                          </Button>
                        </div>
                      </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-green-50/50 rounded-lg text-green-700 border border-green-100">
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="text-[10px] font-bold">Financeiro em dia</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-4 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-orange-200 mx-auto" />
              <p className="text-xs text-gray-500 px-4">Não foi possível localizar este cliente automaticamente no IXC.</p>
              <div className="px-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full text-[10px] h-7 border-orange-200 text-orange-600 hover:bg-orange-50"
                  onClick={() => {
                    const term = prompt("Digite o CPF, CNPJ ou Nome do cliente para buscar no IXC:");
                    if (term) {
                      setLoading(true);
                      const searchManual = async () => {
                        try {
                          let client = null;
                          if (term.match(/^\d+$/)) {
                            client = await ixcService.getClienteByCnpjCpf(term);
                          }
                          if (!client) {
                            const results = await ixcService.getClienteByNome(term);
                            if (results.length > 0) client = results[0];
                          }
                          
                          if (client) {
                            setIxcData(client);
                            const [clientContracts, clientInvoices] = await Promise.all([
                              ixcService.getContratosByCliente(client.id),
                              ixcService.getFaturasByCliente(client.id)
                            ]);
                            setContracts(clientContracts);
                            setInvoices(clientInvoices.filter(f => !f.pagamento_data).slice(0, 3));
                            toast.success("Cliente localizado!");
                          } else {
                            toast.error("Nenhum cliente encontrado com esse termo.");
                          }
                        } catch (e) {
                          toast.error("Erro na busca.");
                        } finally {
                          setLoading(false);
                        }
                      };
                      searchManual();
                    }
                  }}
                >
                  <Search className="w-3 h-3 mr-1.5" />
                  Buscar Manualmente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
