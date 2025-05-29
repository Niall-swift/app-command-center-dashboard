
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Wifi } from 'lucide-react';
import { motion } from 'framer-motion';
import type { UserDetails } from '@/types/dashboard';

interface IXCSoftPreRegistrationProps {
  userDetails: UserDetails;
  requestId: string;
}

const internetPlans = [
  { id: '1', name: 'Plano Básico 50MB', price: 'R$ 49,90' },
  { id: '2', name: 'Plano Intermediário 100MB', price: 'R$ 79,90' },
  { id: '3', name: 'Plano Avançado 200MB', price: 'R$ 119,90' },
  { id: '4', name: 'Plano Premium 500MB', price: 'R$ 199,90' },
];

export default function IXCSoftPreRegistration({ userDetails, requestId }: IXCSoftPreRegistrationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [observations, setObservations] = useState('');
  const { toast } = useToast();

  const handlePreRegistration = async () => {
    if (!selectedPlan) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um plano de internet",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Aqui você faria a integração real com a API do IXCSoft
      // const response = await fetch('/api/ixcsoft/pre-register', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${IXCSOFT_API_KEY}`
      //   },
      //   body: JSON.stringify({
      //     name: userDetails.name,
      //     email: userDetails.email,
      //     phone: userDetails.phone,
      //     cpf: userDetails.cpf,
      //     address: userDetails.address,
      //     city: userDetails.city,
      //     state: userDetails.state,
      //     cep: userDetails.cep,
      //     planId: selectedPlan,
      //     observations,
      //     requestId
      //   })
      // });

      // Simulação da API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const selectedPlanDetails = internetPlans.find(plan => plan.id === selectedPlan);
      
      toast({
        title: "Pré-cadastro realizado!",
        description: `Cliente ${userDetails.name} foi pré-cadastrado no IXCSoft com o ${selectedPlanDetails?.name}`,
      });

      console.log('Pré-cadastro realizado:', {
        client: userDetails,
        plan: selectedPlanDetails,
        observations,
        requestId
      });

      setIsOpen(false);
      setSelectedPlan('');
      setObservations('');
    } catch (error) {
      toast({
        title: "Erro no pré-cadastro",
        description: "Não foi possível realizar o pré-cadastro no IXCSoft. Tente novamente.",
        variant: "destructive",
      });
      console.error('Erro no pré-cadastro:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          <UserPlus className="w-4 h-4 mr-1" />
          Pré-cadastro IXC
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-purple-600" />
            Pré-cadastro IXCSoft
          </DialogTitle>
          <DialogDescription>
            Realize o pré-cadastro do cliente {userDetails.name} no sistema IXCSoft
          </DialogDescription>
        </DialogHeader>
        
        <motion.div 
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Dados do Cliente:</h4>
            <p className="text-sm text-gray-600">{userDetails.name}</p>
            <p className="text-sm text-gray-600">{userDetails.email}</p>
            <p className="text-sm text-gray-600">{userDetails.phone}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan">Plano de Internet *</Label>
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um plano" />
              </SelectTrigger>
              <SelectContent>
                {internetPlans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    <div className="flex justify-between items-center w-full">
                      <span>{plan.name}</span>
                      <span className="text-green-600 font-medium ml-2">{plan.price}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observations">Observações</Label>
            <Input
              id="observations"
              placeholder="Observações adicionais (opcional)"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handlePreRegistration}
              disabled={isLoading}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Confirmar
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
