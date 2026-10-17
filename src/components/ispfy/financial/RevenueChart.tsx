import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface RevenueChartProps {
  data: { date: string; value: number }[];
  loading: boolean;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ data, loading }) => {
  if (loading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  return (
    <Card className="bg-card border-border shadow-sm text-card-foreground">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">Histórico de Receita (30 dias)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                tickFormatter={(value) => `R$ ${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Receita']}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))' }}
              />
              <Bar 
                dataKey="value" 
                fill="#3B82F6" 
                radius={[4, 4, 0, 0]} 
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
