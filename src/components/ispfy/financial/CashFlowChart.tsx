import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface CashFlowChartProps {
  data: { date: string; inflow: number; outflow: number }[];
  loading: boolean;
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({ data, loading }) => {
  if (loading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  return (
    <Card className="bg-card border-border shadow-sm text-card-foreground">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-foreground">Fluxo de Caixa (Entradas vs Saídas)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                tickFormatter={(value) => `R$ ${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
                contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))' }}
              />
              <Legend verticalAlign="top" align="right" height={36}/>
              <Area 
                type="monotone" 
                dataKey="inflow" 
                name="Entradas"
                stroke="#10B981" 
                fillOpacity={1} 
                fill="url(#colorInflow)" 
                strokeWidth={3}
              />
              <Area 
                type="monotone" 
                dataKey="outflow" 
                name="Saídas"
                stroke="#EF4444" 
                fillOpacity={1} 
                fill="url(#colorOutflow)" 
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
