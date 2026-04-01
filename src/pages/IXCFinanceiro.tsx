import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ixcService } from '@/services/ixc/ixcService';
import PageTransition from '@/components/PageTransition';
import { FinancialKPIs } from '@/components/ixc/financial/FinancialKPIs';
import { DebtorsList } from '@/components/ixc/financial/DebtorsList';
import { CashFlowChart } from '@/components/ixc/financial/CashFlowChart';
import { CashSummaryReport } from '@/components/ixc/financial/CashSummaryReport';
import { CaixaManager } from '@/components/ixc/financial/CaixaManager';
import { Database, TrendingUp, RefreshCcw, Wallet, ArrowUpCircle, ArrowDownCircle, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Send, BrainCircuit, X } from 'lucide-react';
import { generateFinancialAnalysis } from '@/services/gemini/geminiService';
import { whapiService } from '@/services/whapi/whapiService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const IXCFinanceiro: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<any>(null);
    const [fullSummary, setFullSummary] = useState<any>(null);
    const [cashAccounts, setCashAccounts] = useState<any[]>([]);
    const [cashMovements, setCashMovements] = useState<any[]>([]);
    const [topDebtors, setTopDebtors] = useState<any[]>([]);
    const [selectedCaixaId, setSelectedCaixaId] = useState<string>('');
    const [aiReport, setAiReport] = useState<string | null>(null);
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isSendingToWhatsapp, setIsSendingToWhatsapp] = useState(false);

    const handleGenerateAIAnalysis = async () => {
        setIsGeneratingAi(true);
        try {
            const debtorsSnapshot = topDebtors.slice(0, 5).map(d => ({
                nome: d.nome || 'Cliente',
                valor: `R$ ${parseFloat(d.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            }));

            const report = await generateFinancialAnalysis({
                inflow: `R$ ${(fullSummary?.inflow || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                outflow: `R$ ${(fullSummary?.outflow || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                balance: `R$ ${(fullSummary?.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                debtTotal: `R$ ${(summary?.totalOverdue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                period: 'últimos 30 dias',
                topDebtors: debtorsSnapshot
            });

            if (report) {
                setAiReport(report);
                setIsAiModalOpen(true);
            } else {
                toast.error("Não foi possível gerar a análise no momento.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao gerar análise com IA.");
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const handleSendToWhatsapp = async () => {
        if (!aiReport) return;
        setIsSendingToWhatsapp(true);
        try {
            const managerPhone = '5522992842742'; // Número solicitado pelo gestor
            
            const result = await whapiService.sendMessage({
                to: managerPhone,
                body: aiReport
            });

            if (result.sent) {
                toast.success("Relatório enviado para seu WhatsApp!");
            } else {
                toast.error("Erro ao enviar: " + result.error);
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao enviar para WhatsApp.");
        } finally {
            setIsSendingToWhatsapp(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [
                summaryData, 
                fullSumm, 
                accounts, 
                movements, 
                debtorsData
            ] = await Promise.all([
                ixcService.getFinancialSummary(selectedCaixaId),
                ixcService.getFullFinancialSummary(30, selectedCaixaId),
                ixcService.getCashAccounts(),
                ixcService.getCashMovements(30, selectedCaixaId),
                ixcService.getTopDebtors(10)
            ]);

            setSummary(summaryData);
            setFullSummary(fullSumm);
            setCashAccounts(accounts);
            setCashMovements(movements);
            setTopDebtors(debtorsData);
            
            // Selecionar primeiro por padrão se nenhum estiver selecionado
            if (!selectedCaixaId && accounts.length > 0) {
                setSelectedCaixaId(accounts[0].id);
            }
        } catch (error) {
            console.error('Falha ao carregar dados financeiros:', error);
            toast.error('Erro ao carregar dashboard financeiro.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedCaixaId]);

    const kpiData = summary ? {
        ...summary,
        // Adicionar dados de saídas ao summary original para os KPIs serem mais completos
        totalOutflow: fullSummary?.outflow || 0,
        netBalance: fullSummary?.balance || 0
    } : null;

    return (
        <PageTransition>
            <div className="flex flex-col gap-6 p-6 bg-gray-50 min-h-screen">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                >
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Database className="w-4 h-4" />
                        <span>Sistema IXC</span>
                        <span>/</span>
                        <span className="text-gray-900 font-medium">Gestão Financeira Elite</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
                                <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                    <TrendingUp className="w-7 h-7 text-white" />
                                </div>
                                Financeiro & Business Intelligence
                            </h1>
                            <p className="text-gray-500 mt-2 font-medium">
                                Controle total de fluxo de caixa, inadimplência e contas correntes
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button 
                                variant="outline" 
                                className="bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-100 text-indigo-700 hover:from-indigo-100 hover:to-violet-100 gap-2 h-11 px-6 rounded-xl font-bold transition-all shadow-sm"
                                onClick={handleGenerateAIAnalysis}
                                disabled={isGeneratingAi || loading}
                            >
                                {isGeneratingAi ? (
                                    <RefreshCcw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Sparkles className="w-4 h-4 text-indigo-500" />
                                )}
                                Insights com IA
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={fetchData} 
                                disabled={loading}
                                className="gap-2 h-11 px-6 rounded-xl border-gray-200 hover:bg-white hover:border-indigo-600 transition-all font-semibold"
                            >
                                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                Sincronizar IXC
                            </Button>
                        </div>
                    </div>
                </motion.div>

                {/* KPI Cards Extraordinários */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-white border-none shadow-sm h-full">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
                                    <ArrowUpCircle className="w-6 h-6" />
                                </div>
                                <Badge className="bg-emerald-50 text-emerald-700 border-none font-bold">+12.5%</Badge>
                            </div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Entradas (30d)</h3>
                            <p className="text-2xl font-black text-gray-900 mt-1">
                                R$ {(fullSummary?.inflow || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white border-none shadow-sm h-full">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-rose-100 rounded-xl text-rose-600">
                                    <ArrowDownCircle className="w-6 h-6" />
                                </div>
                                <Badge className="bg-rose-50 text-rose-700 border-none font-bold">Saída</Badge>
                            </div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Saídas (30d)</h3>
                            <p className="text-2xl font-black text-gray-900 mt-1">
                                R$ {(fullSummary?.outflow || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-indigo-600 border-none shadow-lg shadow-indigo-100 h-full">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-white/20 rounded-xl text-white">
                                    <Wallet className="w-6 h-6" />
                                </div>
                                <Badge className="bg-white/20 text-white border-none font-bold">Líquido</Badge>
                            </div>
                            <h3 className="text-sm font-bold text-indigo-100 uppercase tracking-wider">Saldo do Período</h3>
                            <p className="text-2xl font-black text-white mt-1">
                                R$ {(fullSummary?.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-amber-500 border-none shadow-lg shadow-amber-100 h-full text-white">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-white/20 rounded-xl">
                                    <PieChart className="w-6 h-6" />
                                </div>
                                <Badge className="bg-white/20 text-white border-none font-bold">Alerta</Badge>
                            </div>
                            <h3 className="text-sm font-bold text-amber-50 uppercase tracking-wider">Inadimplência Total</h3>
                            <p className="text-2xl font-black mt-1">
                                R$ {(summary?.totalOverdue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Charts and Reports */}
                    <div className="lg:col-span-8 space-y-6">
                        <CashFlowChart data={fullSummary?.dailyData || []} loading={loading} />
                        <CashSummaryReport 
                            movements={cashMovements} 
                            loading={loading} 
                            selectedCaixaId={selectedCaixaId}
                            onRefresh={fetchData}
                        />
                    </div>

                    {/* Right Column: Account Management and Debtors */}
                    <div className="lg:col-span-4 space-y-6">
                        <CaixaManager 
                            accounts={cashAccounts} 
                            selectedId={selectedCaixaId} 
                            onSelect={setSelectedCaixaId} 
                            onRefresh={fetchData}
                            loading={loading}
                        />
                        <DebtorsList debtors={topDebtors} loading={loading} />
                    </div>
                </div>
            </div>

            {/* AI Insights Modal */}
            <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
                <DialogContent className="max-w-2xl bg-white border-indigo-100">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-2xl font-black text-indigo-900">
                            <BrainCircuit className="h-7 w-7 text-indigo-600" />
                            Análise Estratégica AVL
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="mt-4 p-6 bg-indigo-50/30 rounded-2xl font-sans leading-relaxed whitespace-pre-wrap text-gray-800 border border-indigo-100 shadow-inner overflow-y-auto max-h-[60vh]">
                        {aiReport}
                    </div>

                    <DialogFooter className="gap-3 mt-4">
                        <Button
                            variant="ghost"
                            onClick={() => setIsAiModalOpen(false)}
                            className="font-bold text-gray-500"
                        >
                            Fechar
                        </Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700 text-white gap-2 h-12 px-8 rounded-xl font-bold shadow-lg shadow-green-100 transition-all active:scale-95"
                            onClick={handleSendToWhatsapp}
                            disabled={isSendingToWhatsapp}
                        >
                            {isSendingToWhatsapp ? (
                                <RefreshCcw className="h-5 w-5 animate-spin" />
                            ) : (
                                <Send className="h-5 w-5" />
                            )}
                            Enviar para meu WhatsApp
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageTransition>
    );
};

export default IXCFinanceiro;
