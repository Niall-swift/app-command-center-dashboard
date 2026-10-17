import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ispfyService } from '@/services/ispfy/ispfyService';
import PageTransition from '@/components/PageTransition';
import { FinancialKPIs } from '@/components/ispfy/financial/FinancialKPIs';
import { DebtorsList } from '@/components/ispfy/financial/DebtorsList';
import { CashFlowChart } from '@/components/ispfy/financial/CashFlowChart';
import { CashSummaryReport } from '@/components/ispfy/financial/CashSummaryReport';
import { CaixaManager } from '@/components/ispfy/financial/CaixaManager';
import { Database, TrendingUp, RefreshCcw, Wallet, ArrowUpCircle, ArrowDownCircle, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Send, BrainCircuit, X } from 'lucide-react';
import { generateFinancialAnalysis } from '@/services/gemini/geminiService';
import { whapiService } from '@/services/whapi/whapiService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const ISPFYFinanceiro: React.FC = () => {
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
                ispfyService.getFinancialSummary(selectedCaixaId),
                ispfyService.getFullFinancialSummary(30, selectedCaixaId),
                ispfyService.getCashAccounts(),
                ispfyService.getCashMovements(30, selectedCaixaId),
                ispfyService.getTopDebtors(10)
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
            <div className="space-y-6 text-foreground">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                >
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Database className="w-4 h-4" />
                        <span>Sistema ISPFY</span>
                        <span>/</span>
                        <span className="text-foreground font-medium">Gestão Financeira Elite</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-black text-foreground flex items-center gap-3 tracking-tight">
                                <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                    <TrendingUp className="w-7 h-7 text-white" />
                                </div>
                                Financeiro & Business Intelligence
                            </h1>
                            <p className="text-muted-foreground mt-2 font-medium">
                                Controle total de fluxo de caixa, inadimplência e contas correntes
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button 
                                variant="outline" 
                                className="bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 gap-2 h-11 px-6 rounded-xl font-bold transition-all shadow-sm"
                                onClick={handleGenerateAIAnalysis}
                                disabled={isGeneratingAi || loading}
                            >
                                {isGeneratingAi ? (
                                    <RefreshCcw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Sparkles className="w-4 h-4 text-primary" />
                                )}
                                Insights com IA
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={fetchData} 
                                disabled={loading}
                                className="gap-2 h-11 px-6 rounded-xl border-border hover:bg-secondary transition-all font-semibold"
                            >
                                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                Sincronizar ISPFY
                            </Button>
                        </div>
                    </div>
                </motion.div>

                {/* KPI Cards Extraordinários */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-card border-border shadow-sm h-full text-card-foreground">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
                                    <ArrowUpCircle className="w-6 h-6" />
                                </div>
                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-none font-bold">+12.5%</Badge>
                            </div>
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Entradas (30d)</h3>
                            <p className="text-2xl font-black text-foreground mt-1">
                                R$ {(fullSummary?.inflow || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border shadow-sm h-full text-card-foreground">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-rose-500/10 rounded-xl text-rose-600 dark:text-rose-400">
                                    <ArrowDownCircle className="w-6 h-6" />
                                </div>
                                <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-none font-bold">Saída</Badge>
                            </div>
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Saídas (30d)</h3>
                            <p className="text-2xl font-black text-foreground mt-1">
                                R$ {(fullSummary?.outflow || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-none shadow-lg shadow-indigo-500/20 h-full">
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
                    <Card className="bg-gradient-to-br from-amber-500 to-amber-600 border-none shadow-lg shadow-amber-500/20 h-full text-white">
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
                <DialogContent className="max-w-2xl bg-card border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-2xl font-black text-foreground">
                            <BrainCircuit className="h-7 w-7 text-primary" />
                            Análise Estratégica AVL
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="mt-4 p-6 bg-secondary/30 rounded-2xl font-sans leading-relaxed whitespace-pre-wrap text-foreground border border-border/80 shadow-inner overflow-y-auto max-h-[60vh]">
                        {aiReport}
                    </div>

                    <DialogFooter className="gap-3 mt-4">
                        <Button
                            variant="ghost"
                            onClick={() => setIsAiModalOpen(false)}
                            className="font-bold text-muted-foreground hover:text-foreground"
                        >
                            Fechar
                        </Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-12 px-8 rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
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

export default ISPFYFinanceiro;
