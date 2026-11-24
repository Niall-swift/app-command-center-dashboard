import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { ispfyService } from '@/services/ispfy/ispfyService';

interface NewClientISPFYDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (clientId?: string) => void;
}

export const NewClientISPFYDialog: React.FC<NewClientISPFYDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [observacao, setObservacao] = useState('');

  const reset = () => {
    setNome('');
    setCpfCnpj('');
    setTelefone('');
    setEmail('');
    setCep('');
    setRua('');
    setNumero('');
    setBairro('');
    setCidade('');
    setObservacao('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !cpfCnpj.trim() || !telefone.trim()) {
      toast.error('Nome, CPF/CNPJ e Telefone são obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      const res = await ispfyService.createNovoCliente({
        nome_razao: nome.trim(),
        cpf_cnpj: cpfCnpj.replace(/\D/g, ''),
        contato: telefone.replace(/\D/g, ''),
        email: email.trim() || undefined,
        cep: cep.replace(/\D/g, '') || undefined,
        rua: rua.trim() || undefined,
        numero: numero.trim() || undefined,
        bairro: bairro.trim() || undefined,
        cidade: cidade.trim() || undefined,
        observacao: observacao.trim() || undefined,
      });

      if (res.success) {
        toast.success(res.message || 'Cliente cadastrado com sucesso no ISPFY!');
        reset();
        onOpenChange(false);
        onCreated?.(res.id);
      } else {
        toast.error(res.message || 'Não foi possível cadastrar o cliente no ISPFY.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro de comunicação ao cadastrar cliente no ISPFY.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <UserPlus className="w-5 h-5 text-primary" />
            Cadastrar Novo Cliente no ISPFY
          </DialogTitle>
          <DialogDescription>
            Integração nativa via <code className="font-mono text-[11px]">POST /api/tool/cliente/novo</code>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Nome Completo / Razão Social *</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: MARIA DA SILVA"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>CPF / CNPJ *</Label>
              <Input
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder="000.000.000-00"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>WhatsApp / Telefone *</Label>
              <Input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(21) 99999-9999"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@email.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label>CEP</Label>
              <Input
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                placeholder="00000-000"
              />
            </div>

            <div className="sm:col-span-2 grid grid-cols-12 gap-3">
              <div className="col-span-9 space-y-1.5">
                <Label>Rua / Logradouro</Label>
                <Input value={rua} onChange={(e) => setRua(e.target.value)} placeholder="Rua..." />
              </div>
              <div className="col-span-3 space-y-1.5">
                <Label>Número</Label>
                <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="123" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Bairro</Label>
              <Input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Centro" />
            </div>

            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade" />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                rows={2}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ponto de referência, plano de interesse, melhor horário para instalação..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Cadastrar no ISPFY
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
