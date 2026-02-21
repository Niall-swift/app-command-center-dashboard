import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { ixcService } from '@/services/ixc/ixcService';
import { IXCContratoData } from '@/types/ixc';
import { TrustUnlockButton } from './TrustUnlockButton';

interface ClientContractsProps {
  idCliente: string;
}

export const ClientContracts: React.FC<ClientContractsProps> = ({ idCliente }) => {
  const [contracts, setContracts] = useState<IXCContratoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContracts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ixcService.getContratosByCliente(idCliente);
      setContracts(data);
    } catch (err) {
      setError('Erro ao carregar contratos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (idCliente) {
      fetchContracts();
    }
  }, [idCliente]);

  const getStatusBadge = (status: string | undefined, statusInternet: string | undefined) => {
    if (status === 'C') return <Badge variant="destructive">Cancelado</Badge>;
    if (status === 'I') return <Badge variant="secondary">Inativo</Badge>;
    
    // Status Internet
    if (statusInternet === 'A') return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Online</Badge>;
    if (['CM', 'CA', 'FA', 'BA'].includes(statusInternet || '')) {
      return <Badge variant="destructive" className="flex gap-1 items-center"><WifiOff className="w-3 h-3" /> Bloqueado</Badge>;
    }
    return <Badge variant="outline">{statusInternet || 'Ativo'}</Badge>;
  };

  if (loading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (error) {
    return <div className="text-red-500 text-sm">{error}</div>;
  }

  if (contracts.length === 0) {
    return (
      <Card className="bg-gray-50 border-dashed">
        <CardContent className="pt-6 text-center text-gray-500">
          Nenhum contrato encontrado para este cliente.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Contratos
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {contracts.map((contract) => (
          <div 
            key={contract.id} 
            className="flex flex-col md:flex-row justify-between items-start md:items-center p-3 border rounded-lg bg-white gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{String(contract.contrato || contract.descricao || `Contrato #${contract.id}`)}</span>
                {getStatusBadge(contract.status, contract.status_internet)}
              </div>
              <div className="text-sm text-gray-500 flex flex-col sm:flex-row gap-2 sm:gap-4">
                <span>Plano: {contract.plano || 'N/A'}</span>
                <span>Valor: R$ {contract.valor}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <TrustUnlockButton 
                contratoId={contract.id || ''} 
                statusInternet={contract.status_internet || ''}
                onSuccess={fetchContracts}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
