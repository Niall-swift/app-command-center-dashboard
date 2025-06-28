
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  // Campos para configuração da API
  host: z.string().url('URL da API é obrigatória').default('https://192.168.27.90/webservice/v1'),
  token: z.string().min(1, 'Token da API é obrigatório'),
});

type IXCFormData = z.infer<typeof ixcSchema>;

export default function IXCPreRegistrationForm({ userDetails, requestId }: IXCPreRegistrationFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<IXCFormData>({
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
      host: 'https://192.168.27.90/webservice/v1',
      token: '',
    },
  });

  const handleIXCPreRegistration = async (data: IXCFormData) => {
    setIsLoading(true);

    try {
      // Mapear dados do formulário para o formato esperado pela API do IXC
      const ixcData: IXCContactData = {
        principal: 'N',
        nome: data.nome,
        tipo_pessoa: data.tipo_pessoa,
        cnpj_cpf: data.cnpj_cpf,
        fone_whatsapp: data.telefone,
        fone_celular: data.telefone,
        fone_residencial: data.telefone,
        email: data.email || '',
        endereco: data.endereco,
        bairro: data.bairro,
        cep: data.cep,
        cidade: data.cidade,
        obs: data.observacoes || '',
        lead: 'S',
        ativo: 'S',
      };

      console.log('Dados para envio ao IXC:', ixcData);

      // Chamada real para a API do IXC
      const response = await axios.post(`${data.host}/contato`, ixcData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.token}`,
          'ixcsoft': data.token, // IXC pode usar este header também
        },
        timeout: 30000, // 30 segundos de timeout
      });

      console.log('Resposta da API IXC:', response.data);

      toast({
        title: "Pré-cadastro IXC realizado com sucesso!",
        description: `Cliente ${data.nome} foi cadastrado no sistema IXC como lead`,
      });

      setIsOpen(false);
      form.reset();
    } catch (error) {
      console.error('Erro na chamada da API IXC:', error);
      
      let errorMessage = "Não foi possível realizar o cadastro no IXC. Tente novamente.";
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          errorMessage = `Erro da API IXC: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`;
        } else if (error.request) {
          errorMessage = "Erro de conexão com a API IXC. Verifique a URL e conectividade.";
        }
      }

      toast({
        title: "Erro no pré-cadastro IXC",
        description: errorMessage,
        variant: "destructive",
      });
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
              {/* Configuração da API */}
              <div className="p-4 bg-gray-50 rounded-lg border">
                <h3 className="font-semibold text-gray-900 mb-3">Configuração da API IXC</h3>
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="host"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL da API IXC *</FormLabel>
                        <FormControl>
                          <Input placeholder="https://seu-servidor.com/webservice/v1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="token"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token da API *</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="Seu token de acesso à API IXC" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Dados do cliente */}
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
