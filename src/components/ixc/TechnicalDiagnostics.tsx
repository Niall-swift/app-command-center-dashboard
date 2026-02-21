import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  Power, 
  RefreshCw, 
  AlertTriangle,
  Server,
  Lock,
  Globe,
  Clock
} from 'lucide-react';
import { ixcService } from '@/services/ixc/ixcService';
import { IXCLoginData } from '@/types/ixc';
import { toast } from 'sonner';

interface TechnicalDiagnosticsProps {
  idCliente: string;
}

export const TechnicalDiagnostics: React.FC<TechnicalDiagnosticsProps> = ({ idCliente }) => {
  const [loading, setLoading] = useState(false);
  const [logins, setLogins] = useState<IXCLoginData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchLogins = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ixcService.getLoginsByCliente(idCliente);
      setLogins(data);
    } catch (err) {
      setError('Erro ao carregar logins do cliente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (idCliente) {
      fetchLogins();
    }
  }, [idCliente]);

  const handleDisconnect = async (idLogin: string) => {
    if (!confirm('Tem certeza que deseja tentar desconectar este login?')) return;

    setProcessingId(idLogin);
    try {
      const result = await ixcService.desconectarCliente(idLogin);
      if (result.success) {
        toast.success(result.message);
        // Recarregar status após um breve delay
        setTimeout(fetchLogins, 2000);
      } else {
        toast.warning(result.message);
      }
    } catch (err) {
      toast.error('Erro ao executar comando de desconexão.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading && logins.length === 0) {
    return (
      <Card className="mt-6 border-blue-100 bg-blue-50/30">
        <CardHeader>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 border-blue-200 shadow-sm overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-white pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg text-gray-900">Diagnóstico Técnico</CardTitle>
              <CardDescription>Status das conexões e logins (PPPoE/Hotspot)</CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchLogins} 
            disabled={loading}
            className="border-blue-200 hover:bg-blue-50 text-blue-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {logins.length === 0 && !loading ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
            <WifiOff className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>Nenhum login de internet encontrado para este cliente.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {logins.map((login) => {
              const isOnline = login.online === 'S';
              const isActive = login.ativo === 'S';
              
              return (
                <motion.div 
                  key={login.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`relative p-4 rounded-lg border ${
                    isOnline 
                      ? 'bg-green-50/50 border-green-200' 
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  } transition-all`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Info Principal */}
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 p-2 rounded-full ${isOnline ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {isOnline ? (
                          <Wifi className="w-5 h-5 text-green-600" />
                        ) : (
                          <WifiOff className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{login.login}</h3>
                          {isOnline ? (
                            <Badge variant="default" className="bg-green-500 hover:bg-green-600">Online</Badge>
                          ) : (
                            <Badge variant="secondary">Offline</Badge>
                          )}
                          {!isActive && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Bloqueado
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600">
                          {login.ip && (
                            <div className="flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5" />
                              <span className="font-mono">{login.ip}</span>
                            </div>
                          )}
                          {login.mac && (
                            <div className="flex items-center gap-1.5">
                              <Server className="w-3.5 h-3.5" />
                              <span className="font-mono text-xs">{login.mac}</span>
                            </div>
                          )}
                          {login.grupo_nome && (
                            <div className="col-span-2 text-xs text-gray-500 mt-1">
                              Plano: {login.grupo_nome}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2 self-end md:self-center">
                      <Button
                        variant={isOnline ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => handleDisconnect(login.id!)}
                        disabled={processingId === login.id}
                        className={!isOnline ? "opacity-50" : ""}
                        title="Tentar derrubar conexão remotamente"
                      >
                        {processingId === login.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Power className="w-4 h-4 mr-2" />
                        )}
                        Desconectar
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
