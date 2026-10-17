import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Wallet, Landmark, ArrowRightLeft, RefreshCcw } from 'lucide-react';
import { ISPFYFinancialCaixaData } from '@/types/ispfy';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ispfyService } from '@/services/ispfy/ispfyService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CaixaManagerProps {
  accounts: ISPFYFinancialCaixaData[];
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
      const res = await ispfyService.createCashAccount(newAccountName);
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
          const res = await ispfyService.transferBetweenAccounts(
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
    <Card className="bg-card border-border shadow-sm h-full text-card-foreground">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
           <Wallet className="w-5 h-5 text-primary" />
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
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg space-y-3 animate-in fade-in slide-in-from-top-2">
            <h4 className="text-sm font-semibold text-foreground">Novo Caixa (Caixa 2)</h4>
            <Input 
              placeholder="Ex: Caixa 2 - Filial Norte" 
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              className="bg-background border-input text-foreground"
            />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleCreate}>Criar</Button>
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => setIsCreating(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {accounts.map((acc) => (
            <div 
              key={acc.id}
              onClick={() => onSelect(acc.id as string)}
              className={`p-4 rounded-xl border transition-all cursor-pointer group ${
                selectedId === acc.id 
                ? 'border-primary bg-primary/10 shadow-sm' 
                : 'border-border/60 bg-secondary/30 hover:bg-secondary/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    selectedId === acc.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground group-hover:text-primary'
                  }`}>
                    {acc.descricao?.toLowerCase().includes('banco') ? <Landmark className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                  </div>
                  <div>
                    <h5 className="font-bold text-foreground">{acc.descricao}</h5>
                    <p className="text-xs text-muted-foreground">ID: {acc.id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">R$ {parseFloat(acc.saldo || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saldo Atual</p>
                </div>
              </div>
            </div>
          ))}
          
          {accounts.length === 0 && !loading && (
            <p className="text-center text-muted-foreground py-10 text-sm italic">Nenhuma conta vinculada.</p>
          )}

          <Button 
            variant="ghost" 
            className="w-full text-primary hover:bg-primary/10 gap-2 border border-dashed border-primary/30 mt-2"
            onClick={() => setIsTransferModalOpen(true)}
            disabled={!selectedId}
          >
            <ArrowRightLeft className="w-4 h-4" /> Transferir entre Caixas
          </Button>
        </div>
      </CardContent>

      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
          <DialogContent className="max-w-md bg-card border-border text-foreground">
              <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                      <ArrowRightLeft className="w-5 h-5 text-primary" />
                      Transferência entre Contas
                  </DialogTitle>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-700 dark:text-amber-300">
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
                          <SelectContent className="bg-popover border-border text-popover-foreground">
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
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
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
