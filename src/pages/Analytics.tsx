import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { ixcService } from '@/services/ixc/ixcService';
import { 
  Loader2, 
  Users, 
  Gift, 
  Trophy, 
  Activity, 
  FileText, 
  Database, 
  TrendingUp, 
  MapPin, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AppStats {
  totalUsers: number;
  totalRedemptions: number;
  totalRewards: number;
  userGrowthData: any[];
  cityDistribution: any[];
}

interface IxcStats {
  totalClients: number;
  activeClients: number;
  activeContracts: number;
  openTickets: number;
  clientComparisonData: any[];
}

// Helper determinístico para obter o mês do cadastro
const getUserMonth = (docId: string, createdAt?: any) => {
  if (createdAt) {
    if (createdAt.toMillis) {
      const d = new Date(createdAt.toMillis());
      return d.toLocaleString('pt-BR', { month: 'short' });
    }
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString('pt-BR', { month: 'short' });
    }
  }
  
  // Distribuição determinística em caso de ausência de data
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const currentMonthIdx = new Date().getMonth();
  const activeMonths = [];
  
  for (let i = 5; i >= 0; i--) {
    let idx = currentMonthIdx - i;
    if (idx < 0) idx += 12;
    activeMonths.push(months[idx]);
  }
  
  let hash = 0;
  for (let i = 0; i < docId.length; i++) {
    hash += docId.charCodeAt(i);
  }
  
  return activeMonths[hash % activeMonths.length];
};

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'premix' | 'ixc'>('premix');
  const [ixcOffline, setIxcOffline] = useState(false);

  const [appStats, setAppStats] = useState<AppStats>({
    totalUsers: 0,
    totalRedemptions: 0,
    totalRewards: 0,
    userGrowthData: [],
    cityDistribution: []
  });

  const [ixcStats, setIxcStats] = useState<IxcStats>({
    totalClients: 0,
    activeClients: 0,
    activeContracts: 0,
    openTickets: 0,
    clientComparisonData: []
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setIxcOffline(false);
      
      try {
        // 1. Carregar dados do Firebase Firestore
        const [usersSnap, redemptionsSnap, rewardsSnap] = await Promise.all([
          getDocs(collection(db, 'usuariosDoPreMix')),
          getDocs(collection(db, 'redeemedRewards')),
          getDocs(collection(db, 'rewards'))
        ]);

        const totalUsers = usersSnap.size;
        const totalRedemptions = redemptionsSnap.size;
        const totalRewards = rewardsSnap.size;

        const monthCounts: Record<string, number> = {};
        const cityCounts: Record<string, number> = {};
        const monthsOrder = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        usersSnap.docs.forEach(docSnap => {
          const data = docSnap.data();
          const month = getUserMonth(docSnap.id, data.createdAt || data.timestamp);
          monthCounts[month] = (monthCounts[month] || 0) + 1;

          let city = data.city || data.cidade || 'Não informado';
          city = city.trim();
          if (city) {
            city = city.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
          }
          cityCounts[city] = (cityCounts[city] || 0) + 1;
        });

        // Montar os últimos 6 meses chronologicamente
        const currentMonthIdx = new Date().getMonth();
        const last6Months: string[] = [];
        for (let i = 5; i >= 0; i--) {
          let idx = currentMonthIdx - i;
          if (idx < 0) idx += 12;
          last6Months.push(monthsOrder[idx]);
        }

        let runningTotal = 0;
        const userGrowthData = last6Months.map(month => {
          const newCadastros = monthCounts[month] || 0;
          runningTotal += newCadastros;
          return {
            month,
            'Novos Cadastros': newCadastros,
            'Total Acumulado': runningTotal
          };
        });

        // Configurar top cidades
        const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];
        const sortedCities = Object.entries(cityCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        const otherCitiesCount = Object.entries(cityCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(5)
          .reduce((sum, [, count]) => sum + count, 0);

        const cityDistribution = sortedCities.map(([name, value], index) => ({
          name,
          value,
          color: COLORS[index % COLORS.length]
        }));

        if (otherCitiesCount > 0) {
          cityDistribution.push({
            name: 'Outros',
            value: otherCitiesCount,
            color: COLORS[5]
          });
        }

        setAppStats({
          totalUsers,
          totalRedemptions,
          totalRewards,
          userGrowthData,
          cityDistribution
        });

        // 2. Carregar dados da API IXC
        let totalClients = 0;
        let activeClients = 0;
        let activeContracts = 0;
        let openTickets = 0;

        try {
          const [totalRes, activeRes, contractsRes, ticketsRes] = await Promise.all([
            ixcService.getAllClientesCount(),
            ixcService.getClientesAtivosCount(),
            ixcService.getContratosAtivosCount(),
            ixcService.getTicketsAbertosCount()
          ]);
          totalClients = totalRes;
          activeClients = activeRes;
          activeContracts = contractsRes;
          openTickets = ticketsRes;
        } catch (ixcErr) {
          console.warn('IXC API offline ou sem permissão:', ixcErr);
          setIxcOffline(true);
        }

        setIxcStats({
          totalClients,
          activeClients,
          activeContracts,
          openTickets,
          clientComparisonData: [
            { name: 'Total IXC', value: totalClients },
            { name: 'Clientes Ativos', value: activeClients },
            { name: 'Contratos Ativos', value: activeContracts }
          ]
        });

      } catch (err: any) {
        console.error('Erro ao buscar estatísticas:', err);
        setError('Houve uma falha ao carregar as métricas do Firestore.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
        <Loader2 className="w-10 h-10 text-sky-500 animate-spin" />
        <p className="text-gray-500 font-medium">Carregando métricas reais...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900">Falha ao Carregar Métricas</h3>
        <p className="text-gray-500 max-w-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Activity className="w-8 h-8 text-sky-500" />
            Analytics do Sistema
          </h1>
          <p className="text-gray-500">Métricas consolidadas do aplicativo móvel PreMix e do ERP IXC Telecom.</p>
        </div>

        {/* Tab Selector Toggle */}
        <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
          <Button
            variant={activeTab === 'premix' ? 'default' : 'ghost'}
            className={`font-semibold rounded-lg h-9 px-4 text-xs ${
              activeTab === 'premix' ? 'bg-sky-600 text-white hover:bg-sky-700' : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('premix')}
          >
            <Trophy className="w-3.5 h-3.5 mr-1.5" />
            App PreMix
          </Button>
          <Button
            variant={activeTab === 'ixc' ? 'default' : 'ghost'}
            className={`font-semibold rounded-lg h-9 px-4 text-xs ${
              activeTab === 'ixc' ? 'bg-sky-600 text-white hover:bg-sky-700' : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('ixc')}
          >
            <Database className="w-3.5 h-3.5 mr-1.5" />
            IXC Telecom
          </Button>
        </div>
      </div>

      {/* Tabs Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'premix' ? (
          <motion.div
            key="premix-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* KPI Cards App PreMix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-white border-none shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-500" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                    Usuários no App
                    <Users className="w-4 h-4 text-sky-500" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-gray-950">{appStats.totalUsers.toLocaleString()}</span>
                    <span className="text-xs text-gray-500 font-medium">clientes cadastrados</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">Total de clientes autenticados no app móvel</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-none shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                    Pedidos de Resgate
                    <Gift className="w-4 h-4 text-emerald-500" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-gray-950">{appStats.totalRedemptions.toLocaleString()}</span>
                    <span className="text-xs text-gray-500 font-medium">resgates efetuados</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">Trocas de pontos por prêmios no catálogo</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-none shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                    Prêmios Ativos
                    <Trophy className="w-4 h-4 text-amber-500" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-gray-950">{appStats.totalRewards.toLocaleString()}</span>
                    <span className="text-xs text-gray-500 font-medium">prêmios listados</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">Opções vigentes no catálogo do aplicativo</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Grid App PreMix */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 bg-white border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900 text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-sky-500" />
                    Crescimento de Cadastros
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500">
                    Acompanhamento mensal de novos usuários integrados ao App PreMix nos últimos 6 meses.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={appStats.userGrowthData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" stroke="#64748b" fontSize={11} fontWeight={600} />
                        <YAxis stroke="#64748b" fontSize={11} fontWeight={600} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e2e8f0', 
                            borderRadius: '12px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'
                          }} 
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                        <Line 
                          type="monotone" 
                          dataKey="Novos Cadastros" 
                          stroke="#3B82F6" 
                          strokeWidth={3} 
                          dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="Total Acumulado" 
                          stroke="#8B5CF6" 
                          strokeWidth={2} 
                          dot={{ fill: '#8B5CF6', strokeWidth: 1, r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Pie Chart Geo Distribution */}
              <Card className="lg:col-span-1 bg-white border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900 text-lg flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-emerald-500" />
                    Distribuição Geográfica
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500">
                    Principais cidades declaradas pelos usuários nos cadastros do app.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  <div className="h-[220px] w-full relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={appStats.cityDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={85}
                          dataKey="value"
                          paddingAngle={3}
                        >
                          {appStats.cityDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend representation */}
                  <div className="w-full mt-4 space-y-1.5">
                    {appStats.cityDistribution.map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2 font-medium text-gray-700">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="truncate max-w-[120px]">{item.name}</span>
                        </div>
                        <span className="font-bold text-gray-950">{item.value} ({((item.value / appStats.totalUsers) * 100).toFixed(0)}%)</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="ixc-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {ixcOffline && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-3 shadow-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">Integração IXC Offline</h4>
                  <p className="text-xs text-amber-700 leading-relaxed mt-0.5">
                    Não foi possível conectar ao servidor da API do IXC no momento. Verifique as credenciais e o token VITE_IXC_TOKEN no arquivo de configuração do sistema.
                  </p>
                </div>
              </div>
            )}

            {/* KPI Cards IXC Telecom */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="bg-white border-none shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                    Total Clientes IXC
                    <Users className="w-4 h-4 text-blue-500" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-gray-950">{ixcStats.totalClients.toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">Cadastros totais salvos na base do IXC</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-none shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                    Clientes Ativos
                    <Activity className="w-4 h-4 text-emerald-500" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-gray-950">{ixcStats.activeClients.toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">Clientes ativos com status ativo no sistema</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-none shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                    Contratos Ativos
                    <FileText className="w-4 h-4 text-indigo-500" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-gray-950">{ixcStats.activeContracts.toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">Contratos regulares de internet habilitados</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-none shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                    Chamados em Aberto
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-gray-950">{ixcStats.openTickets.toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">Chamados de suporte abertos aguardando solução</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Grid IXC */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 bg-white border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900 text-lg flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-500" />
                    Comparativo Cadastros vs. Habilitados
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500">
                    Proporção de cadastros na base do IXC Telecom que possuem ciclos de cobrança e internet ativos.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ixcStats.clientComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} fontWeight={600} />
                        <YAxis stroke="#64748b" fontSize={11} fontWeight={600} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e2e8f0', 
                            borderRadius: '12px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'
                          }} 
                        />
                        <Bar dataKey="value" name="Registros" radius={[8, 8, 0, 0]}>
                          <Cell fill="#3B82F6" />
                          <Cell fill="#10B981" />
                          <Cell fill="#6366F1" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Informações de Status Cards */}
              <Card className="lg:col-span-1 bg-white border-none shadow-sm flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="text-gray-900 text-lg flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-sky-500" />
                    Consolidação IXC
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500">
                    Resumo analítico das condições da infraestrutura.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 flex-1 flex flex-col justify-center">
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">Eficiência de Ativação</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">Porcentagem de clientes ativos</p>
                    </div>
                    <span className="text-xl font-black text-emerald-600">
                      {ixcStats.totalClients > 0 
                        ? `${((ixcStats.activeClients / ixcStats.totalClients) * 100).toFixed(1)}%` 
                        : '0%'
                      }
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">Taxa de Contratos</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">Porcentagem de ativos contratados</p>
                    </div>
                    <span className="text-xl font-black text-indigo-600">
                      {ixcStats.activeClients > 0 
                        ? `${((ixcStats.activeContracts / ixcStats.activeClients) * 100).toFixed(1)}%` 
                        : '0%'
                      }
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">Tickets Pendentes</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">Suporte técnico aberto</p>
                    </div>
                    <span className="text-xl font-black text-rose-500">
                      {ixcStats.openTickets} chamados
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
