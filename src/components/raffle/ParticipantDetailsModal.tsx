
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User, Mail, Phone, CreditCard, MapPin, MessageCircle, X, Gift } from 'lucide-react';
import type { Client } from '@/types/dashboard';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useToast } from '@/hooks/use-toast';

interface ParticipantDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  participant: Client | null;
}

export default function ParticipantDetailsModal({ isOpen, onClose, participant }: ParticipantDetailsModalProps) {
  if (!participant) return null;

  const { toast } = useToast();
  const [rouletteEnabled, setRouletteEnabled] = useState(false);

  useEffect(() => {
    if (participant) {
      setRouletteEnabled(!!participant.rouletteEnabled);
    }
  }, [participant]);

  const handleToggleRoulette = async () => {
    const nextState = !rouletteEnabled;
    setRouletteEnabled(nextState);
    try {
      await updateDoc(doc(db, 'usuariosDoPreMix', participant.id), {
        rouletteEnabled: nextState
      });
      toast({
        title: nextState ? "Roleta Ativada" : "Roleta Desativada",
        description: `Roleta da Sorte ${nextState ? 'permitida' : 'bloqueada'} para ${participant.name}.`
      });
    } catch (error) {
      setRouletteEnabled(!nextState); // Rollback
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o status da roleta do cliente.",
        variant: "destructive"
      });
    }
  };

  const sendWhatsApp = () => {
    const message = `Olá ${participant.name}! obrigado por participar do nosso sorteio. desejamos boa sorte! 🎉`;
    const phoneNumber = participant.phone?.replace(/\D/g, '') || '';
    const whatsappUrl = `https://wa.me/55${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Detalhes do Participante
          </DialogTitle>
          <DialogDescription>
            Informações completas do participante
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Avatar and Basic Info */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <Avatar className="w-16 h-16">
              <AvatarImage src={participant.avatar} alt={participant.name} />
              <AvatarFallback className="bg-blue-100 text-blue-600 text-xl font-bold">
                {participant.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-semibold">{participant.name}</h3>
              <p className="text-gray-600">@{participant.name.toLowerCase().replace(' ', '')}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${participant.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                <span className="text-sm text-gray-500">
                  {participant.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{participant.email || 'Não informado'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Telefone/WhatsApp</p>
                <p className="font-medium">{participant.phone || 'Não informado'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <CreditCard className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">CPF</p>
                <p className="font-medium">{participant.cpf || 'Não informado'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">CEP</p>
                <p className="font-medium">{participant.cep || 'Não informado'}</p>
              </div>
            </div>

            <div className="border-t border-gray-200 my-2 pt-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Gift className="w-4 h-4 text-purple-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-700 text-left">Roleta da Sorte</p>
                  <p className="text-xs text-gray-500 text-left">Permissão individual para girar a roleta</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={rouletteEnabled}
                onChange={handleToggleRoulette}
                className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={sendWhatsApp}
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={!participant.phone}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Enviar WhatsApp
            </Button>
            <Button variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
