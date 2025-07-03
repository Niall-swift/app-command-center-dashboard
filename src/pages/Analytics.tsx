
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import type { ClientData } from '@/types/dashboard';

export default function Analytics() {
  const clientData: ClientData[] = [
    { month: 'Jan', clients: 10, active: 10 },
    { month: 'Fev', clients: 70, active: 68 },
    { month: 'Mar', clients: 230, active: 165 },
    { month: 'Abr', clients: 250, active: 215 },
    { month: 'Mai', clients: 390, active: 369 },
    { month: 'Jun', clients: 457, active: 430 }
  ];

  const deviceData = [
    { name: 'Android', value: 487, color: '#3B82F6' },
    { name: 'iOS', value: 50, color: '#10B981' },
    { name: 'Web', value: 100, color: '#F59E0B' }
  ];

  const engagementData = [
    { day: 'Seg', sessions: 420 },
    { day: 'Ter', sessions: 380 },
    { day: 'Qua', sessions: 520 },
    { day: 'Qui', sessions: 470 },
    { day: 'Sex', sessions: 590 },
    { day: 'Sab', sessions: 340 },
    { day: 'Dom', sessions: 280 }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Analytics do Aplicativo</h2>
        <p className="text-gray-600">Visualize o crescimento e engajamento dos seus clientes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Crescimento de Clientes</CardTitle>
            <CardDescription>Total de clientes registrados ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={clientData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="clients" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    name="Total de Clientes"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="active" 
                    stroke="#10B981" 
                    strokeWidth={2}
                    dot={{ fill: '#10B981', strokeWidth: 2, r: 3 }}
                    name="Clientes Ativos"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Distribuição por Dispositivo</CardTitle>
            <CardDescription>Clientes por plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deviceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {deviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Engajamento Semanal</CardTitle>
          <CardDescription>Sessões de usuários por dia da semana</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="day" 
                  stroke="#6b7280"
                  fontSize={12}
                />
                <YAxis 
                  stroke="#6b7280"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="sessions" 
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                  name="Sessões"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Taxa de Retenção</p>
                <p className="text-3xl font-bold">84.2%</p>
              </div>
              <div className="text-blue-200">+2.4%</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100">Sessão Média</p>
                <p className="text-3xl font-bold">12min</p>
              </div>
              <div className="text-green-200">+1.8min</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100">DAU</p>
                <p className="text-3xl font-bold">1,647</p>
              </div>
              <div className="text-purple-200">+5.2%</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
