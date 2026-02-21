import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { LockOpen, Loader2 } from 'lucide-react';
import { ixcService } from '@/services/ixc/ixcService';
import { toast } from 'sonner';

interface TrustUnlockButtonProps {
  contratoId: string;
  statusInternet: string; // 'A', 'CM', 'CA', etc.
  onSuccess?: () => void;
}

export const TrustUnlockButton: React.FC<TrustUnlockButtonProps> = ({ 
  contratoId, 
  statusInternet,
  onSuccess 
}) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Verifica se está bloqueado (CM = Corte Manual, CA = Corte Automático, etc.)
  // Ajuste conforme as siglas do IXC do cliente
  const isBlocked = ['CM', 'CA', 'FA', 'BA'].includes(statusInternet);

  if (!isBlocked) return null;

  const handleUnlock = async () => {
    setLoading(true);
    try {
      const result = await ixcService.unlockContract(contratoId);
      
      if (result.success) {
        toast.success(result.message);
        setOpen(false);
        if (onSuccess) onSuccess();
      } else {
        toast.error('Erro ao desbloquear', { description: result.message });
      }
    } catch (error) {
      toast.error('Erro ao tentar desbloquear contrato.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="text-amber-600 border-amber-200 hover:bg-amber-50"
        >
          <LockOpen className="w-4 h-4 mr-2" />
          Desbloqueio em Confiança
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Desbloqueio em Confiança</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Você está prestes a liberar o sinal deste cliente provisoriamente.
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground bg-muted p-2 rounded">
              <li>O sinal será liberado por um período determinado (ex: 24h ou 48h).</li>
              <li>Essa ação pode ter limites de uso por cliente.</li>
              <li>O cliente deve ser orientado a regularizar o pagamento.</li>
            </ul>
            <p className="font-semibold mt-4">Deseja continuar?</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e) => {
              e.preventDefault(); // Previne fechar automático
              handleUnlock();
            }}
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              'Confirmar Desbloqueio'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
