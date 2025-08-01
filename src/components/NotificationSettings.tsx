import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Bell, BellOff, Volume2, VolumeX, Settings } from "lucide-react";
import { motion } from "framer-motion";

interface NotificationSettingsProps {
  isEnabled: boolean;
  isSupported: boolean;
  permission: NotificationPermission;
  isPageVisible: boolean;
  onToggleNotifications: () => void;
  onRequestPermission: () => Promise<boolean>;
  onTestNotification: () => void;
}

export default function NotificationSettings({
  isEnabled,
  isSupported,
  permission,
  isPageVisible,
  onToggleNotifications,
  onRequestPermission,
  onTestNotification,
}: NotificationSettingsProps) {
  const [showSettings, setShowSettings] = useState(false);

  const getPermissionStatus = () => {
    switch (permission) {
      case "granted":
        return { text: "Permitido", color: "text-green-600" };
      case "denied":
        return { text: "Negado", color: "text-red-600" };
      default:
        return { text: "Não definido", color: "text-yellow-600" };
    }
  };

  const permissionStatus = getPermissionStatus();

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Configurações de Notificação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status das Notificações */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isEnabled ? (
              <Bell className="w-5 h-5 text-green-600" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-400" />
            )}
            <Label htmlFor="notifications-toggle">Notificações</Label>
          </div>
          <Switch
            id="notifications-toggle"
            checked={isEnabled}
            onCheckedChange={onToggleNotifications}
            disabled={!isSupported}
          />
        </div>

        {/* Status do Navegador */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Suporte do Navegador:</span>
            <span className={isSupported ? "text-green-600" : "text-red-600"}>
              {isSupported ? "Suportado" : "Não suportado"}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span>Permissão:</span>
            <span className={permissionStatus.color}>
              {permissionStatus.text}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span>Status da Página:</span>
            <span
              className={isPageVisible ? "text-green-600" : "text-orange-600"}
            >
              {isPageVisible ? "Visível" : "Em segundo plano"}
            </span>
          </div>
        </div>

        <Separator />

        {/* Ações */}
        <div className="space-y-2">
          {permission === "default" && (
            <Button
              onClick={onRequestPermission}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Solicitar Permissão
            </Button>
          )}

          <Button
            onClick={onTestNotification}
            variant="outline"
            size="sm"
            className="w-full"
            disabled={!isEnabled || !isSupported}
          >
            Testar Notificação
          </Button>
        </div>

        {/* Informações */}
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{
            opacity: showSettings ? 1 : 0,
            height: showSettings ? "auto" : 0,
          }}
          className="overflow-hidden"
        >
          <div className="text-xs text-gray-500 space-y-1">
            <p>
              • Notificações funcionam mesmo quando a página está em segundo
              plano
            </p>
            <p>• O som será reproduzido quando novas mensagens chegarem</p>
            <p>
              • Notificações do navegador aparecem quando a aba não está ativa
            </p>
          </div>
        </motion.div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
          className="w-full"
        >
          {showSettings ? "Ocultar" : "Mostrar"} Informações
        </Button>
      </CardContent>
    </Card>
  );
}
