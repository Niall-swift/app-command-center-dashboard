
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, FileText, Bot, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const stats = [
    {
      title: "Total de Clientes",
      value: "2,847",
      change: "+12.5%",
      icon: Users,
      color: "text-blue-600"
    },
    {
      title: "Mensagens Hoje",
      value: "431",
      change: "+8.2%",
      icon: MessageSquare,
      color: "text-green-600"
    },
    {
      title: "Solicitações Pendentes",
      value: "23",
      change: "-4.1%",
      icon: FileText,
      color: "text-orange-600"
    },
    {
      title: "Bots Ativos",
      value: "12",
      change: "+2",
      icon: Bot,
      color: "text-purple-600"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="bg-white shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3" />
                {stat.change} desde o último mês
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
            <CardDescription>Últimas ações no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: "Novo bot criado", user: "Admin", time: "há 2 min" },
                { action: "Solicitação aprovada", user: "João Silva", time: "há 15 min" },
                { action: "Mensagem recebida", user: "Maria Santos", time: "há 32 min" },
                { action: "Cliente cadastrado", user: "Sistema", time: "há 1h" }
              ].map((activity, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                    <p className="text-xs text-gray-500">{activity.user}</p>
                  </div>
                  <span className="text-xs text-gray-400">{activity.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Status do Sistema</CardTitle>
            <CardDescription>Monitoramento em tempo real</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { service: "Firebase", status: "Operacional", color: "bg-green-500" },
                { service: "API Principal", status: "Operacional", color: "bg-green-500" },
                { service: "Chat Service", status: "Operacional", color: "bg-green-500" },
                { service: "Bot Engine", status: "Manutenção", color: "bg-yellow-500" }
              ].map((service, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${service.color}`}></div>
                    <span className="text-sm font-medium text-gray-900">{service.service}</span>
                  </div>
                  <span className="text-xs text-gray-500">{service.status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
