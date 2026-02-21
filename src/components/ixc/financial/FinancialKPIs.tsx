import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, AlertCircle, TrendingUp, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface FinancialKPIsProps {
  data: {
    todayRevenue: number;
    monthRevenue: number;
    totalOpen: number;
    totalOverdue: number;
    countOverdue: number;
  } | null;
  loading: boolean;
}

export const FinancialKPIs: React.FC<FinancialKPIsProps> = ({ data, loading }) => {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Receita Hoje */}
      <Card className="bg-white shadow-sm border-l-4 border-l-green-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex justify-between">
            Receita Hoje
            <DollarSign className="w-4 h-4 text-green-500" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(data.todayRevenue)}</div>
          <p className="text-xs text-gray-500 mt-1">
             Pagamentos recebidos hoje
          </p>
        </CardContent>
      </Card>

      {/* Receita Mês */}
      <Card className="bg-white shadow-sm border-l-4 border-l-blue-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex justify-between">
            Receita Mensal
            <Calendar className="w-4 h-4 text-blue-500" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(data.monthRevenue)}</div>
          <p className="text-xs text-gray-500 mt-1">
             Acumulado este mês
          </p>
        </CardContent>
      </Card>

      {/* A Receber (Aberto) */}
      <Card className="bg-white shadow-sm border-l-4 border-l-yellow-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex justify-between">
            A Receber (Total)
            <TrendingUp className="w-4 h-4 text-yellow-500" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(data.totalOpen)}</div>
          <p className="text-xs text-gray-500 mt-1">
             Total em aberto
          </p>
        </CardContent>
      </Card>

      {/* Inadimplência */}
      <Card className="bg-white shadow-sm border-l-4 border-l-red-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex justify-between">
            Inadimplência
            <AlertCircle className="w-4 h-4 text-red-500" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(data.totalOverdue)}</div>
           <div className="flex items-center gap-2 mt-1">
            <Badge variant="destructive" className="text-[10px] h-5 px-1">
              {data.countOverdue} faturas
            </Badge>
            <span className="text-xs text-red-400">Vencidas</span>
           </div>
        </CardContent>
      </Card>
    </div>
  );
};
