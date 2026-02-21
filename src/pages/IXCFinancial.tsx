import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ixcService } from '@/services/ixc/ixcService';
import PageTransition from '@/components/PageTransition';
import { FinancialKPIs } from '@/components/ixc/financial/FinancialKPIs';
import { RevenueChart } from '@/components/ixc/financial/RevenueChart';
import { DebtorsList } from '@/components/ixc/financial/DebtorsList';
import { Database, TrendingUp, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const IXCFinancial: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<any>(null);
    const [revenueData, setRevenueData] = useState<any[]>([]);
    const [topDebtors, setTopDebtors] = useState<any[]>([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Executar em paralelo para ser mais rápido
            const [summaryData, dailyData, debtorsData] = await Promise.all([
                ixcService.getFinancialSummary(),
                ixcService.getDailyRevenue(30),
                ixcService.getTopDebtors(10)
            ]);

            setSummary(summaryData);
            setRevenueData(dailyData);
            setTopDebtors(debtorsData);
        } catch (error) {
            console.error('Falha ao carregar dados financeiros:', error);
            toast.error('Erro ao carregar dashboard financeiro.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <PageTransition>
            <div className="flex flex-col gap-6 p-6 bg-gray-50 min-h-screen">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                >
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Database className="w-4 h-4" />
                        <span>Sistema IXC</span>
                        <span>/</span>
                        <span className="text-gray-900 font-medium">Financeiro</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                                    <TrendingUp className="w-6 h-6 text-white" />
                                </div>
                                Dashboard Financeiro
                            </h1>
                            <p className="text-gray-600 mt-2">
                                Visão geral da saúde financeira do provedor
                            </p>
                        </div>
                        <Button 
                            variant="outline" 
                            onClick={fetchData} 
                            disabled={loading}
                            className="gap-2"
                        >
                            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Atualizar
                        </Button>
                    </div>
                </motion.div>

                {/* KPI Cards */}
                <FinancialKPIs data={summary} loading={loading} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Gráfico de Receita */}
                    <div className="lg:col-span-2">
                        <RevenueChart data={revenueData} loading={loading} />
                    </div>

                    {/* Lista de Inadimplentes */}
                    <div>
                        <DebtorsList debtors={topDebtors} loading={loading} />
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

export default IXCFinancial;
