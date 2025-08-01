import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bug, Volume2, Bell, Eye, EyeOff } from "lucide-react";

interface DebugPanelProps {
  isEnabled: boolean;
  isSupported: boolean;
  permission: NotificationPermission;
  isPageVisible: boolean;
  selectedClient: any;
  clientMessages: any;
  onTestSound: () => void;
  onTestNotification: () => void;
}

export default function DebugPanel({
  isEnabled,
  isSupported,
  permission,
  isPageVisible,
  selectedClient,
  clientMessages,
  onTestSound,
  onTestNotification,
}: DebugPanelProps) {
  const [showDebug, setShowDebug] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 9)]);
  };

  useEffect(() => {
    addLog(`Página ${isPageVisible ? "visível" : "em segundo plano"}`);
  }, [isPageVisible]);

  useEffect(() => {
    if (selectedClient) {
      addLog(`Cliente selecionado: ${selectedClient.name}`);
    }
  }, [selectedClient]);

  const getStatusColor = (status: boolean) => {
    return status ? "bg-green-500" : "bg-red-500";
  };

  const getPermissionColor = (perm: NotificationPermission) => {
    switch (perm) {
      case "granted":
        return "bg-green-500";
      case "denied":
        return "bg-red-500";
      default:
        return "bg-yellow-500";
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="w-5 h-5" />
          Painel de Debug
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Geral */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Notificações:</span>
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${getStatusColor(isEnabled)}`}
              />
              <span className="text-xs">
                {isEnabled ? "Ativadas" : "Desativadas"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Suporte do Navegador:</span>
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${getStatusColor(
                  isSupported
                )}`}
              />
              <span className="text-xs">
                {isSupported ? "Suportado" : "Não suportado"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Permissão:</span>
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${getPermissionColor(
                  permission
                )}`}
              />
              <span className="text-xs">{permission}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Visibilidade da Página:</span>
            <div className="flex items-center gap-2">
              {isPageVisible ? (
                <Eye className="w-4 h-4 text-green-600" />
              ) : (
                <EyeOff className="w-4 h-4 text-orange-600" />
              )}
              <span className="text-xs">
                {isPageVisible ? "Visível" : "Em segundo plano"}
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Cliente Selecionado */}
        {selectedClient && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Cliente Atual:</h4>
            <div className="text-xs space-y-1">
              <p>
                <strong>Nome:</strong> {selectedClient.name}
              </p>
              <p>
                <strong>ID:</strong> {selectedClient.id}
              </p>
              <p>
                <strong>Mensagens:</strong>{" "}
                {(clientMessages[selectedClient.id] || []).length}
              </p>
              <p>
                <strong>Online:</strong>{" "}
                {selectedClient.isOnline ? "Sim" : "Não"}
              </p>
            </div>
          </div>
        )}

        <Separator />

        {/* Ações de Teste */}
        <div className="space-y-2">
          <Button
            onClick={() => {
              addLog("Testando som...");
              onTestSound();
            }}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <Volume2 className="w-4 h-4 mr-2" />
            Testar Som
          </Button>

          <Button
            onClick={() => {
              addLog("Testando notificação...");
              onTestNotification();
            }}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <Bell className="w-4 h-4 mr-2" />
            Testar Notificação
          </Button>
        </div>

        {/* Logs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Logs Recentes:</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLogs([])}
              className="text-xs"
            >
              Limpar
            </Button>
          </div>

          <div className="max-h-32 overflow-y-auto bg-gray-50 p-2 rounded text-xs">
            {logs.length === 0 ? (
              <p className="text-gray-500">Nenhum log disponível</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Informações do Sistema */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Clique em "Testar Som" para verificar o áudio</p>
          <p>• Clique em "Testar Notificação" para verificar as notificações</p>
          <p>• Os logs mostram as últimas ações do sistema</p>
        </div>
      </CardContent>
    </Card>
  );
}
