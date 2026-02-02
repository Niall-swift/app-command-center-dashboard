import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Search,
  Loader2,
  FileText,
  Database,
} from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { ixcService } from '@/services/ixc/ixcService';
import { IXCFaturaData } from '@/types/ixc';
import FaturaCard from '@/components/ixc/FaturaCard';
import { toast } from 'sonner';

const IXCFinanceiro: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [faturas, setFaturas] = useState<IXCFaturaData[]>([]);
  const [faturasAbertas, setFaturasAbertas] = useState<IXCFaturaData[]>([]);
  const [faturasVencidas, setFaturasVencidas] = useState<IXCFaturaData[]>([]);
  const [searchClienteId, setSearchClienteId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('abertas');

  // Carregar faturas abertas ao montar o componente
  useEffect(() => {
    loadFaturasAbertas();
    loadFaturasVencidas();
  }, []);

  const loadFaturasAbertas = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ixcService.getFaturasAbertas();
      setFaturasAbertas(result);
    } catch (err) {
      setError('Erro ao carregar faturas abertas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadFaturasVencidas = async () => {
    try {
      const result = await ixcService.getFaturasVencidas();
      setFaturasVencidas(result);
    } catch (err) {
      console.error('Erro ao carregar faturas vencidas:', err);
    }
  };

  const searchFaturasByCliente = async () => {
    if (!searchClienteId.trim()) {
      setError('Por favor, insira o ID do cliente');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await ixcService.getFaturasByCliente(searchClienteId);
      setFaturas(result);
      setActiveTab('todas');
    } catch (err) {
      setError('Erro ao buscar faturas do cliente');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLinhaDigitavel = (linha: string) => {
    navigator.clipboard.writeText(linha).then(() => {
      toast.success('Linha digitável copiada!');
    });
  };

  // Calcular métricas
  const calcularMetricas = () => {
    const totalAbertas = faturasAbertas.reduce((sum, f) => {
      return sum + (parseFloat(f.valor || '0'));
    }, 0);

    const totalVencidas = faturasVencidas.reduce((sum, f) => {
      return sum + (parseFloat(f.valor || '0'));
    }, 0);

    return {
      totalAbertas,
      totalVencidas,
      quantidadeAbertas: faturasAbertas.length,
      quantidadeVencidas: faturasVencidas.length,
    };
  };

  const metricas = calcularMetricas();

  const formatarValor = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  return (
    <PageTransition>
      <div className="flex flex-col gap-6 p-6 bg-gray-50 min-h-screen">
        {/* Header com Breadcrumb */}
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
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                Financeiro IXC
              </h1>
              <p className="text-gray-600 mt-2">
                Gerencie faturas, boletos e contas a receber
              </p>
            </div>
          </div>
        </motion.div>

        {/* Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Faturas Abertas</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {metricas.quantidadeAbertas}
                  </p>
                </div>
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Valor em Aberto</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatarValor(metricas.totalAbertas)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Faturas Vencidas</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {metricas.quantidadeVencidas}
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Valor Vencido</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatarValor(metricas.totalVencidas)}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Busca por Cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Buscar Faturas por Cliente</CardTitle>
            <CardDescription>
              Insira o ID do cliente para visualizar suas faturas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="cliente-id">ID do Cliente</Label>
                <Input
                  id="cliente-id"
                  value={searchClienteId}
                  onChange={(e) => setSearchClienteId(e.target.value)}
                  placeholder="Digite o ID do cliente..."
                  onKeyPress={(e) => e.key === 'Enter' && searchFaturasByCliente()}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={searchFaturasByCliente} disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  <span>Buscar</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alertas de Erro */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Lista de Faturas */}
        <Card>
          <CardHeader>
            <CardTitle>Faturas</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="abertas">
                  Abertas ({faturasAbertas.length})
                </TabsTrigger>
                <TabsTrigger value="vencidas">
                  Vencidas ({faturasVencidas.length})
                </TabsTrigger>
                <TabsTrigger value="todas">
                  Todas ({faturas.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="abertas" className="mt-4">
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-32 w-full" />
                    ))}
                  </div>
                ) : faturasAbertas.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {faturasAbertas.map((fatura, index) => (
                      <motion.div
                        key={fatura.id || index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <FaturaCard
                          fatura={fatura}
                          onCopyLinhaDigitavel={handleCopyLinhaDigitavel}
                        />
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma fatura em aberto</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="vencidas" className="mt-4">
                {faturasVencidas.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {faturasVencidas.map((fatura, index) => (
                      <motion.div
                        key={fatura.id || index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <FaturaCard
                          fatura={fatura}
                          onCopyLinhaDigitavel={handleCopyLinhaDigitavel}
                        />
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma fatura vencida</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="todas" className="mt-4">
                {faturas.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {faturas.map((fatura, index) => (
                      <motion.div
                        key={fatura.id || index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <FaturaCard
                          fatura={fatura}
                          onCopyLinhaDigitavel={handleCopyLinhaDigitavel}
                        />
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Busque por um cliente para ver suas faturas</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
};

export default IXCFinanceiro;
