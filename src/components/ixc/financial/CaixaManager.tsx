import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Wallet, Landmark, ArrowRightLeft, RefreshCcw } from 'lucide-react';
import { IXCFinancialCaixaData } from '@/types/ixc';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ixcService } from '@/services/ixc/ixcService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CaixaManagerProps {
  accounts: IXCFinancialCaixaData[];
  selectedId: string;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const CaixaManager: React.FC<CaixaManagerProps> = ({ 
  accounts, 
  selectedId, 
  onSelect, 
  onRefresh,
  loading 
}) => {
  const [isCreating, setIsCreating] = React.useState(false);
  const [newAccountName, setNewAccountName] = React.useState('');
  const [isTransferModalOpen, setIsTransferModalOpen] = React.useState(false);
  const [transferData, setTransferData] = React.useState({
      toId: '',
      value: ''
  });
  const [isTransferring, setIsTransferring] = React.useState(false);

  const handleCreate = async () => {
    if (!newAccountName.trim()) return;
    try {
      const res = await ixcService.createCashAccount(newAccountName);
      if (res.success) {
        toast.success(res.message);
        setNewAccountName('');
        setIsCreating(false);
        onRefresh();
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error('Erro ao criar caixa.');
    }
  };

  const handleTransfer = async () => {
      if (!selectedId || !transferData.toId || !transferData.value) {
          toast.error("Preencha todos os campos da transferência.");
          return;
      }
      
      if (selectedId === transferData.toId) {
          toast.error("Selecione um destino diferente da origem.");
          return;
      }

      setIsTransferring(true);
      try {
          const res = await ixcService.transferBetweenAccounts(
              selectedId,
              transferData.toId,
              parseFloat(transferData.value)
          );
          
          if (res.success) {
              toast.success("Transferência realizada com sucesso!");
              setIsTransferModalOpen(false);
              setTransferData({ toId: '', value: '' });
              onRefresh();
          } else {
              toast.error(res.message);
          }
      } catch (error) {
          toast.error("Erro ao processar transferência.");
      } finally {
          setIsTransferring(false);
      }
  };

  return (
    <Card className="bg-white shadow-sm border-none h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
           <Wallet className="w-5 h-5 text-indigo-600" />
           Contas e Caixas
        </CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 gap-1"
          onClick={() => setIsCreating(!isCreating)}
        >
          <Plus className="w-4 h-4" /> Novo
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCreating && (
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg space-y-3 animate-in fade-in slide-in-from-top-2">
            <h4 className="text-sm font-semibold text-indigo-900">Novo Caixa (Caixa 2)</h4>
            <Input 
              placeholder="Ex: Caixa 2 - Filial Norte" 
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              className="bg-white border-indigo-200"
            />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={handleCreate}>Criar</Button>
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => setIsCreating(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {accounts.map((acc) => (
            <div 
              key={acc.id}
              onClick={() => onSelect(acc.id as string)}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer group ${
                selectedId === acc.id 
                ? 'border-indigo-600 bg-indigo-50/50' 
                : 'border-transparent bg-gray-50 hover:border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    selectedId === acc.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400 group-hover:text-indigo-600'
                  }`}>
                    {acc.descricao?.toLowerCase().includes('banco') ? <Landmark className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                  </div>
                  <div>
                    <h5 className="font-bold text-gray-900">{acc.descricao}</h5>
                    <p className="text-xs text-gray-500">ID: {acc.id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">R$ {parseFloat(acc.saldo || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Saldo Atual</p>
                </div>
              </div>
            </div>
          ))}
          
          {accounts.length === 0 && !loading && (
            <p className="text-center text-gray-400 py-10 text-sm italic">Nenhuma conta vinculada.</p>
          )}

          <Button 
            variant="ghost" 
            className="w-full text-indigo-600 bg-indigo-50/0 hover:bg-indigo-50 gap-2 border border-dashed border-indigo-200 mt-2"
            onClick={() => setIsTransferModalOpen(true)}
            disabled={!selectedId}
          >
            <ArrowRightLeft className="w-4 h-4" /> Transferir entre Caixas
          </Button>
        </div>
      </CardContent>

      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
          <DialogContent className="max-w-md bg-white">
              <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                      Transferência entre Contas
                  </DialogTitle>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">
                      <strong>Origem:</strong> {accounts.find(a => a.id === selectedId)?.descricao || 'Selecione um caixa'}
                  </div>

                  <div className="grid gap-2">
                      <label className="text-sm font-medium">Conta Destino</label>
                      <Select 
                        value={transferData.toId} 
                        onValueChange={(val) => setTransferData({...transferData, toId: val})}
                      >
                          <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecione o destino" />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                              {accounts.filter(a => a.id !== selectedId).map(acc => (
                                  <SelectItem key={acc.id} value={acc.id as string}>
                                      {acc.descricao} (R$ {parseFloat(acc.saldo || '0').toLocaleString('pt-BR')})
                                  </SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>

                  <div className="grid gap-2">
                      <label className="text-sm font-medium">Valor da Transferência (R$)</label>
                      <Input 
                        type="number" 
                        placeholder="0,00" 
                        value={transferData.value}
                        onChange={(e) => setTransferData({...transferData, value: e.target.value})}
                      />
                  </div>
              </div>

              <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsTransferModalOpen(false)}>Cancelar</Button>
                  <Button 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                    onClick={handleTransfer}
                    disabled={isTransferring}
                  >
                      {isTransferring ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                      Executar Transferência
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </Card>
  );
};
