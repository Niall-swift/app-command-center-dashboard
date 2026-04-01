import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle, ExternalLink, AlertTriangle, Send, Phone, Sparkles, Wand2, RefreshCcw } from 'lucide-react';
import { ixcService } from '@/services/ixc/ixcService';
import { whapiService } from '@/services/whapi/whapiService';
import { generateIndividualDebtMessage } from '@/services/gemini/geminiService';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface DebtorsListProps {
    debtors: { nome: string; valor: number; id_cliente: string }[];
    loading: boolean;
}

export const DebtorsList: React.FC<DebtorsListProps> = ({ debtors, loading }) => {
    const [selectedDebtor, setSelectedDebtor] = useState<{ nome: string; id_cliente: string; valor: number } | null>(null);
    const [phones, setPhones] = useState<string[]>([]);
    const [loadingPhones, setLoadingPhones] = useState(false);
    const [sending, setSending] = useState(false);
    const [messagePreview, setMessagePreview] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

    const handleOpenBilling = async (debtor: { nome: string; valor: number; id_cliente: string }) => {
        setSelectedDebtor(debtor);
        setLoadingPhones(true);
        setPhones([]);
        
        try {
            // 1. Buscar dados completos do cliente para pegar telefones
            const clientData = await ixcService.getClienteById(debtor.id_cliente);
            
            if (clientData) {
                const clientPhones = ixcService.getClientPhones(clientData);
                setPhones(clientPhones);
                
                // 2. Gerar mensagem de cobrança padrão
                const msg = `Olá ${debtor.nome}, notamos uma pendência financeira no valor de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(debtor.valor)}. Poderia nos confirmar a previsão de pagamento? Caso já tenha efetuado, desconsidere.`;
                setMessagePreview(msg);
            } else {
                toast.error('Cliente não encontrado no sistema.');
                setSelectedDebtor(null);
            }
        } catch (error) {
            console.error(error);
            toast.error('Erro ao buscar contatos do cliente.');
            setSelectedDebtor(null);
        } finally {
            setLoadingPhones(false);
        }
    };

    const handleGenerateAIMessage = async () => {
        if (!selectedDebtor) return;
        
        setIsGeneratingAI(true);
        try {
            const msg = await generateIndividualDebtMessage({
                nomeCliente: selectedDebtor.nome,
                valorOriginal: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedDebtor.valor),
                diasAtraso: 30, // Padrão ou buscar do IXC
                dataVencimento: 'Verificar fatura' // Idem
            });
            
            if (msg) {
                setMessagePreview(msg);
                toast.success('Abordagem humanizada gerada com IA!');
            } else {
                toast.error('Não foi possível gerar a mensagem com IA agora.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Erro ao chamar o serviço de IA.');
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const handleSend = async () => {
        if (!selectedDebtor || phones.length === 0) return;
        
        setSending(true);
        let successCount = 0;
        
        try {
            for (const phone of phones) {
                const result = await whapiService.sendMessage({
                    to: phone,
                    body: messagePreview
                });
                
                if (result.sent) successCount++;
            }
            
            if (successCount > 0) {
                toast.success(`Mensagem enviada para ${successCount} número(s) de ${selectedDebtor.nome}`);
                setSelectedDebtor(null); // Fechar dialog
            } else {
                toast.error('Falha ao enviar mensagem. Verifique a conexão do WhatsApp.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Erro ao processar envio.');
        } finally {
            setSending(false);
        }
    };
    
    if (loading) {
        return <Skeleton className="h-[300px] w-full" />;
    }

    return (
        <>
            <Card className="bg-white shadow-sm h-full flex flex-col">
                <CardHeader>
                    <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        Top 10 Inadimplentes (Críticos)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                    <div className="h-full overflow-y-auto">
                        {debtors.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                Nenhuma inadimplência crítica encontrada.
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 bg-gray-50">Cliente</th>
                                        <th className="px-4 py-3 text-right bg-gray-50">Dívida Total</th>
                                        <th className="px-4 py-3 text-center bg-gray-50">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {debtors.map((d, i) => (
                                        <tr key={i} className="border-b hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-[150px]" title={d.nome}>
                                                {d.nome}
                                            </td>
                                            <td className="px-4 py-3 text-right text-red-600 font-bold">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.valor)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    onClick={() => handleOpenBilling(d)}
                                                    title="Cobrar no WhatsApp"
                                                >
                                                    <MessageCircle className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!selectedDebtor} onOpenChange={(open) => !open && setSelectedDebtor(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Enviar Cobrança</DialogTitle>
                        <DialogDescription>
                            Enviar mensagem de cobrança via WhatsApp para <strong>{selectedDebtor?.nome}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    {loadingPhones ? (
                        <div className="py-4 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    ) : (
                        <div className="space-y-4 py-2">
                            <div className="text-sm">
                                <span className="font-semibold text-gray-700">Contatos encontrados:</span>
                                {phones.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {phones.map((phone, idx) => (
                                            <div key={idx} className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-md text-xs border border-green-200">
                                                <Phone className="w-3 h-3" />
                                                {phone}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-red-500 mt-1">Nenhum telefone válido encontrado.</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-gray-700">Mensagem:</label>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 font-bold text-xs"
                                        onClick={handleGenerateAIMessage}
                                        disabled={isGeneratingAI}
                                    >
                                        {isGeneratingAI ? (
                                            <RefreshCcw className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <Wand2 className="w-3 h-3" />
                                        )}
                                        Humanizar com IA
                                    </Button>
                                </div>
                                <textarea 
                                    className="w-full p-3 border rounded-xl text-sm bg-gray-50 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-indigo-500 border-gray-200"
                                    value={messagePreview}
                                    onChange={(e) => setMessagePreview(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedDebtor(null)} disabled={sending}>
                            Cancelar
                        </Button>
                        <Button 
                            onClick={handleSend} 
                            disabled={sending || phones.length === 0 || loadingPhones}
                            className="bg-green-600 hover:bg-green-700 text-white gap-2"
                        >
                            {sending ? 'Enviando...' : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Enviar WhatsApp
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
