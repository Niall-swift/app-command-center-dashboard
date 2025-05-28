
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, CreditCard, MapPin, Home } from 'lucide-react';
import type { UserDetails } from '@/types/dashboard';

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userDetails: UserDetails;
}

export default function UserDetailsModal({ isOpen, onClose, userDetails }: UserDetailsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Detalhes do Usuário
          </DialogTitle>
          <DialogDescription>
            Informações completas do usuário
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500">Nome</p>
              <p className="font-medium">{userDetails.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium">{userDetails.email}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500">Telefone</p>
              <p className="font-medium">{userDetails.phone}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <CreditCard className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500">CPF</p>
              <p className="font-medium">{userDetails.cpf}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500">CEP</p>
              <p className="font-medium">{userDetails.cep}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Home className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500">Endereço</p>
              <p className="font-medium">{userDetails.address}</p>
              <p className="text-sm text-gray-500">{userDetails.city} - {userDetails.state}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
