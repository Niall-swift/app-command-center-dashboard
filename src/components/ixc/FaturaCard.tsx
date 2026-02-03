import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Download, Calendar, DollarSign } from 'lucide-react';
import { IXCFaturaData } from '@/types/ixc';
import { formatDate } from '@/utils/date';

interface FaturaCardProps {
  fatura: IXCFaturaData;
  onCopyLinhaDigitavel?: (linha: string) => void;
}

export const FaturaCard: React.FC<FaturaCardProps> = ({ fatura, onCopyLinhaDigitavel }) => {
  // Determinar status da fatura
  const getStatus = () => {
    if (fatura.data_pagamento) {
      return { label: 'Pago', color: 'bg-green-100 text-green-800' };
    }
    
    if (fatura.data_vencimento) {
      // Comparação simples de string YYYY-MM-DD
      const hoje = new Date().toISOString().split('T')[0];
      if (fatura.data_vencimento < hoje) {
        return { label: 'Vencido', color: 'bg-red-100 text-red-800' };
      }
    }
    
    return { label: 'Aberto', color: 'bg-yellow-100 text-yellow-800' };
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
    return formatDate(data);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900">
                {fatura.descricao || `Fatura #${fatura.id}`}
              </h3>
              <Badge className={status.color}>{status.label}</Badge>
            </div>
            {fatura.referencia && (
              <p className="text-sm text-gray-600">Ref: {fatura.referencia}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900">
              {formatarValor(fatura.valor)}
            </p>
            {fatura.valor_pago && (
              <p className="text-sm text-green-600">
                Pago: {formatarValor(fatura.valor_pago)}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-gray-600">Vencimento</p>
              <p className="font-medium text-gray-900">
                {formatarData(fatura.data_vencimento)}
              </p>
            </div>
          </div>

          {fatura.data_pagamento && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-gray-600">Pagamento</p>
                <p className="font-medium text-gray-900">
                  {formatarData(fatura.data_pagamento)}
                </p>
              </div>
            </div>
          )}
        </div>

        {fatura.linha_digitavel && !fatura.data_pagamento && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCopyLinhaDigitavel?.(fatura.linha_digitavel || '')}
                className="flex-1"
              >
                <Copy className="w-3 h-3 mr-2" />
                Copiar Linha Digitável
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-3 h-3 mr-2" />
                Boleto
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FaturaCard;
