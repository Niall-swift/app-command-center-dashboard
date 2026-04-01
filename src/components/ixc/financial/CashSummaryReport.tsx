import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpCircle, ArrowDownCircle, Search, Plus, RefreshCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ixcService } from '@/services/ixc/ixcService';
import { toast } from 'sonner';
import { IXCCashMovementData } from '@/types/ixc';
import { Skeleton } from '@/components/ui/skeleton';

interface CashSummaryReportProps {
  movements: IXCCashMovementData[];
  loading: boolean;
  selectedCaixaId: string;
  onRefresh: () => void;
}

export const CashSummaryReport: React.FC<CashSummaryReportProps> = ({ 
  movements, 
  loading, 
  selectedCaixaId,
  onRefresh 
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [newMovement, setNewMovement] = React.useState({
      tipo: 'E' as 'E' | 'S',
      valor: '',
      historico: '',
      documento: ''
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleCreateMovement = async () => {
      if (!newMovement.valor || !newMovement.historico) {
          toast.error("Por favor, preencha valor e histórico.");
          return;
      }
      
      setIsSubmitting(true);
      try {
          const res = await ixcService.createCashMovement({
              ...newMovement,
              id_caixa: selectedCaixaId
          });
          
          if (res.success) {
              toast.success("Lançamento realizado!");
              setIsModalOpen(false);
              setNewMovement({ tipo: 'E', valor: '', historico: '', documento: '' });
              onRefresh();
          } else {
              toast.error(res.message);
          }
      } catch (error) {
          toast.error("Erro ao realizar lançamento.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const filteredMovements = movements.filter(m => 
    m.historico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.documento?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Card className="bg-white shadow-sm border-none overflow-hidden">
        <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
        <CardContent><Skeleton className="h-[400px] w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white shadow-sm border-none overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-bold text-gray-900">Resumo do Caixa</CardTitle>
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder="Buscar lançamentos..." 
              className="pl-10 h-9 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button 
            className="bg-indigo-600 hover:bg-indigo-700 h-9 gap-2"
            onClick={() => setIsModalOpen(true)}
            disabled={!selectedCaixaId}
          >
            <Plus className="w-4 h-4" /> Novo Lançamento
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500 uppercase font-semibold">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Histórico</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredMovements.length > 0 ? filteredMovements.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                    {m.data?.split(' ')[0].split('-').reverse().join('/')}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">{m.historico}</span>
                      <span className="text-xs text-gray-400">Doc: {m.documento || '---'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {m.tipo === 'E' ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-none hover:bg-emerald-100 gap-1">
                        <ArrowUpCircle className="w-3 h-3" /> Entrada
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-100 text-rose-700 border-none hover:bg-rose-100 gap-1">
                        <ArrowDownCircle className="w-3 h-3" /> Saída
                      </Badge>
                    )}
                  </td>
                  <td className={`px-4 py-4 text-right font-bold ${m.tipo === 'E' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {m.tipo === 'E' ? '+' : '-'} R$ {parseFloat(m.valor || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-gray-500 italic">
                    Nenhum lançamento encontrado para o período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-md bg-white">
              <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-gray-900">Novo Lançamento Manual</DialogTitle>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                      <label className="text-sm font-medium">Tipo</label>
                      <Select 
                        value={newMovement.tipo} 
                        onValueChange={(val: 'E' | 'S') => setNewMovement({...newMovement, tipo: val})}
                      >
                          <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                              <SelectItem value="E" className="text-emerald-600 font-bold">Entrada (+)</SelectItem>
                              <SelectItem value="S" className="text-rose-600 font-bold">Saída (-)</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="grid gap-2">
                      <label className="text-sm font-medium">Valor (R$)</label>
                      <Input 
                        type="number" 
                        placeholder="0,00" 
                        value={newMovement.valor}
                        onChange={(e) => setNewMovement({...newMovement, valor: e.target.value})}
                      />
                  </div>
                  <div className="grid gap-2">
                      <label className="text-sm font-medium">Histórico</label>
                      <Input 
                        placeholder="Ex: Pagamento extra ou Recebimento manual" 
                        value={newMovement.historico}
                        onChange={(e) => setNewMovement({...newMovement, historico: e.target.value})}
                      />
                  </div>
                  <div className="grid gap-2">
                      <label className="text-sm font-medium">Documento (Opcional)</label>
                      <Input 
                        placeholder="Ex: REC-123" 
                        value={newMovement.documento}
                        onChange={(e) => setNewMovement({...newMovement, documento: e.target.value})}
                      />
                  </div>
              </div>

              <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                  <Button 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                    onClick={handleCreateMovement}
                    disabled={isSubmitting}
                  >
                      {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Confirmar Lançamento
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </Card>
  );
};
