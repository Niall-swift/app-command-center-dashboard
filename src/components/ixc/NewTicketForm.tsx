
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ixcService } from '@/services/ixc/ixcService';
import { toast } from 'sonner';
import { Loader2, PlusCircle } from 'lucide-react';

interface NewTicketFormProps {
  idCliente: string;
  onSuccess?: () => void;
  triggerAsString?: boolean;
}

export const NewTicketForm: React.FC<NewTicketFormProps> = ({ 
  idCliente, 
  onSuccess,
  triggerAsString = false 
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<{ id: string; assunto: string }[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // Form State
  const [selectedSubject, setSelectedSubject] = useState('');
  const [priority, setPriority] = useState('N'); // N = Normal
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (open && subjects.length === 0) {
      loadSubjects();
    }
  }, [open]);

  const loadSubjects = async () => {
    setLoadingSubjects(true);
    try {
      const data = await ixcService.getTicketSubjects();
      setSubjects(data);
    } catch (error) {
      toast.error('Erro ao carregar assuntos de tickets.');
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSubject || !message.trim()) {
      toast.warning('Preencha os campos obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      const result = await ixcService.createTicket({
        id_cliente: idCliente,
        id_assunto: selectedSubject,
        prioridade: priority,
        mensagem: message
      });

      if (result.success) {
        toast.success(result.message);
        setOpen(false);
        setMessage('');
        setSelectedSubject('');
        setPriority('N');
        if (onSuccess) onSuccess();
      } else {
        toast.error('Erro ao abrir chamado', { description: result.message });
      }
    } catch (error) {
      toast.error('Erro ao processar solicitação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerAsString ? "default" : "outline"} size="sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          Novo Chamado
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Abrir Novo Chamado</DialogTitle>
          <DialogDescription>
            Crie um novo ticket de suporte para este cliente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="subject" className="text-right">
              Assunto
            </Label>
            <div className="col-span-3">
              <Select onValueChange={setSelectedSubject} value={selectedSubject}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o assunto" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                     <SelectItem key={s.id} value={s.id}>{s.assunto}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="priority" className="text-right">
              Prioridade
            </Label>
            <div className="col-span-3">
               <Select onValueChange={setPriority} value={priority}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Normal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="B">Baixa</SelectItem>
                  <SelectItem value="N">Normal</SelectItem>
                  <SelectItem value="A">Alta</SelectItem>
                  <SelectItem value="C">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="message" className="text-right">
              Mensagem
            </Label>
            <Textarea
              id="message"
              className="col-span-3"
              placeholder="Descreva o problema..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Abrir Chamado
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
