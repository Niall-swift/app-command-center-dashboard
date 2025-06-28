
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Wifi } from 'lucide-react';
import { motion } from 'framer-motion';
import type { UserDetails } from '@/types/dashboard';
import type { IXCContactData, IXCPreRegistrationFormData } from '@/types/ixc';

interface IXCPreRegistrationFormProps {
  userDetails: UserDetails;
  requestId: string;
}

const ixcSchema = z.object({
  nome: z.string().min(2, 'Nome é obrigatório (mínimo 2 caracteres)'),
  tipo_pessoa: z.enum(['F', 'J'], {
    required_error: 'Selecione o tipo de pessoa',
  }),
  cnpj_cpf: z.string().min(11, 'CPF/CNPJ é obrigatório'),
  telefone: z.string().min(10, 'Telefone é obrigatório'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  endereco: z.string().min(5, 'Endereço é obrigatório'),
  bairro: z.string().min(2, 'Bairro é obrigatório'),
  cep: z.string().min(8, 'CEP é obrigatório'),
  cidade: z.string().min(2, 'Cidade é obrigatória'),
  observacoes: z.string().optional(),
});

export default function IXCPreRegistrationForm({ userDetails, requestId }: IXCPreRegistrationFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<IXCPreRegistrationFormData>({
    resolver: zodResolver(ixcSchema),
    defaultValues: {
      nome: userDetails.name || '',
      tipo_pessoa: 'F',
      cnpj_cpf: userDetails.cpf || '',
      telefone: userDetails.phone || '',
      email: userDetails.email || '',
      endereco: userDetails.address || '',
      bairro: '',
      cep: userDetails.cep || '',
      cidade: userDetails.city || '',
      observacoes: '',
    },
  });

  const handleIXCPreRegistration = async (data: IXCPreRegistrationFormData) => {
    setIsLoading(true);

    try {
      // Mapear dados do formulário para o formato esperado pela API do IXC
      const ixcData: IXCContactData = {
        nome: data.nome,
        tipo_pessoa: data.tipo_pessoa,
        cnpj_cpf: data.cnpj_cpf,
        fone_whatsapp: data.telefone,
        fone_celular: data.telefone,
        email: data.email || '',
        endereco: data.endereco,
        bairro: data.bairro,
        cep: data.cep,
        cidade: data.cidade,
        obs: data.observacoes || '',
        lead: 'S',
        ativo: 'S',
        principal: 'N',
      };

      console.log('Dados para envio ao IXC:', ixcData);

      // Aqui você faria a integração real com a API do IXC
      // const response = await fetch('/api/ixc/contato', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${IXC_TOKEN}`
      //   },
      //   body: JSON.stringify(ixcData)
      // });

      // Simulação da API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Pré-cadastro IXC realizado!",
        description: `Cliente ${data.nome} foi cadastrado no sistema IXC como lead`,
      });

      console.log('Pré-cadastro IXC realizado:', {
        client: data,
        ixcData,
        requestId
      });

      setIsOpen(false);
      form.reset();
    } catch (error) {
      toast({
        title: "Erro no pré-cadastro IXC",
        description: "Não foi possível realizar o cadastro no IXC. Tente novamente.",
        variant: "destructive",
      });
      console.error('Erro no pré-cadastro IXC:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <UserPlus className="w-4 h-4 mr-1" />
          Cadastrar IXC
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-blue-600" />
            Pré-cadastro IXCSoft
          </DialogTitle>
          <DialogDescription>
            Cadastre o cliente {userDetails.name} no sistema IXC como lead
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleIXCPreRegistration)} className="space-y-4">
            <motion.div 
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome completo do cliente" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tipo_pessoa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Pessoa *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="F">Pessoa Física</SelectItem>
                          <SelectItem value="J">Pessoa Jurídica</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cnpj_cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF/CNPJ *</FormLabel>
                      <FormControl>
                        <Input placeholder="000.000.000-00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone/WhatsApp *</FormLabel>
                      <FormControl>
                        <Input placeholder="(00) 00000-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="email@exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cep"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP *</FormLabel>
                      <FormControl>
                        <Input placeholder="00000-000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="endereco"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço *</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua, número, complemento" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bairro"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do bairro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome da cidade" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Observações adicionais sobre o cliente ou solicitação"
                        className="min-h-[80px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Cadastrar no IXC
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
