import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, Wifi, ArrowUpDown } from 'lucide-react';
import { IXCContratoData } from '@/types/ixc';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContratoCardProps {
  contrato: IXCContratoData;
  onClick?: () => void;
}

export const ContratoCard: React.FC<ContratoCardProps> = ({ contrato, onClick }) => {
  // Determinar status do contrato
  const getStatus = () => {
    switch (contrato.status) {
      case 'A':
        return { label: 'Ativo', color: 'bg-green-100 text-green-800' };
      case 'I':
        return { label: 'Inativo', color: 'bg-gray-100 text-gray-800' };
      case 'C':
        return { label: 'Cancelado', color: 'bg-red-100 text-red-800' };
      default:
        return { label: 'Desconhecido', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const status = getStatus();

  // Formatar valor
  const formatarValor = (valor?: string) => {
    if (!valor) return 'R$ 0,00';
    const numValor = parseFloat(valor);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(numValor);
  };

  // Formatar data
  const formatarData = (data?: string) => {
    if (!data) return 'Não informado';
    try {
      return format(new Date(data), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return data;
    }
  };

  // Formatar velocidade
  const formatarVelocidade = (velocidade?: string) => {
    if (!velocidade) return null;
    return `${velocidade} Mbps`;
  };

  return (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900">
                {contrato.plano || contrato.descricao || `Contrato #${contrato.id}`}
              </h3>
              <Badge className={status.color}>{status.label}</Badge>
            </div>
            {contrato.descricao && contrato.plano && (
              <p className="text-sm text-gray-600">{contrato.descricao}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900">
              {formatarValor(contrato.valor)}
            </p>
            <p className="text-xs text-gray-500">por mês</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(contrato.velocidade_download || contrato.velocidade_upload) && (
            <div className="flex items-center gap-2 text-sm">
              <Wifi className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-gray-600">Velocidade</p>
                <div className="flex items-center gap-1">
                  {contrato.velocidade_download && (
                    <p className="font-medium text-gray-900">
                      ↓ {formatarVelocidade(contrato.velocidade_download)}
                    </p>
                  )}
                  {contrato.velocidade_upload && (
                    <p className="font-medium text-gray-900">
                      ↑ {formatarVelocidade(contrato.velocidade_upload)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-gray-600">Início</p>
              <p className="font-medium text-gray-900">
                {formatarData(contrato.data_inicio)}
              </p>
            </div>
          </div>
        </div>

        {contrato.data_fim && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-orange-600" />
              <div>
                <p className="text-gray-600">Término</p>
                <p className="font-medium text-gray-900">
                  {formatarData(contrato.data_fim)}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ContratoCard;
