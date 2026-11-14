import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Wifi, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import { ispfyService } from '@/services/ispfy/ispfyService';
import type { UserDetails } from '@/types/dashboard';

interface ISPFYPreRegistrationFormProps {
  userDetails: UserDetails;
  requestId: string;
}

const ispfySchema = z.object({
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
  cidade_id: z.string().optional(),
  observacoes: z.string().optional(),
  abrir_os_instalacao: z.boolean().default(true),
  assunto_os: z.string().optional(),
});

type ISPFYFormData = z.infer<typeof ispfySchema>;

interface IspfyCityOption {
  id: string;
  razao: string;
  nome_fantasia: string;
}

export default function ISPFYPreRegistrationForm({
  userDetails,
  requestId,
}: ISPFYPreRegistrationFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cities, setCities] = useState<IspfyCityOption[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const { toast } = useToast();

  const form = useForm<ISPFYFormData>({
    resolver: zodResolver(ispfySchema),
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
      cidade_id: '',
      observacoes: '',
      abrir_os_instalacao: true,
      assunto_os: 'Instalação de Internet Fibra Óptica',
    },
  });

  useEffect(() => {
    if (!isOpen || cities.length > 0) return;
    setLoadingCities(true);
    ispfyService
      .getFiliais()
      .then((rows) => {
        setCities(rows || []);
        if (rows?.length && !form.getValues('cidade_id')) {
          const match = rows.find((c) =>
            (c.nome_fantasia || c.razao || '')
              .toLowerCase()
              .includes((userDetails.city || '').toLowerCase())
          );
          if (match) {
            form.setValue('cidade_id', String(match.id));
            form.setValue('cidade', match.nome_fantasia || match.razao || userDetails.city || '');
          }
        }
      })
      .catch((err) => console.warn('Aviso ao carregar cidades ISPFY:', err))
      .finally(() => setLoadingCities(false));
  }, [isOpen, cities.length, form, userDetails.city]);

  const handleISPFYPreRegistration = async (data: ISPFYFormData) => {
    setIsLoading(true);

    try {
      const cpfDigits = data.cnpj_cpf.replace(/\D/g, '');
      const phoneDigits = data.telefone.replace(/\D/g, '');
      const cepDigits = data.cep.replace(/\D/g, '');

      const payload: Record<string, unknown> = {
        nome_razao: data.nome.trim(),
        razao: data.nome.trim(),
        nome: data.nome.trim(),
        tipo_pessoa: data.tipo_pessoa,
        cpf_cnpj: cpfDigits,
        cnpj_cpf: cpfDigits,
        fone_whatsapp: phoneDigits,
        fone_celular: phoneDigits,
        email: data.email || undefined,
        endereco: data.endereco.trim(),
        bairro: data.bairro.trim(),
        cep: cepDigits,
        cidade: data.cidade.trim(),
        ...(data.cidade_id ? { id_cidade: data.cidade_id } : {}),
        observacao:
          data.observacoes?.trim() ||
          `Lead convertido da solicitação #${requestId} via AVL Command Center`,
      };

      const actionFn = httpsCallable<
        Record<string, unknown>,
        {
          success?: boolean;
          created?: { id?: string; message?: string };
          ticketResult?: { id?: string };
        }
      >(functions, 'ispfyToolActions');
      const res = await actionFn({
        action: 'create_lead_client',
        payload,
        openInstallTicket: data.abrir_os_instalacao,
        ticketAssunto: data.assunto_os?.trim() || 'Instalação de Novo Assinante',
        ticketDescricao: data.observacoes?.trim()
          ? `Instalação para ${data.nome} — ${data.endereco}, ${data.bairro} (${data.cidade}). Obs: ${data.observacoes}`
          : `Instalação para ${data.nome} — ${data.endereco}, ${data.bairro} (${data.cidade}).`,
      });

      const result = res.data;
      if (!result?.success) {
        throw new Error(result?.created?.message || 'Erro ao cadastrar cliente no ISPFY.');
      }

      const clientIdLabel = result.created?.id ? ` (ID #${result.created.id})` : '';
      const ticketLabel = result.ticketResult?.id
        ? ` e O.S. de instalação #${result.ticketResult.id} aberta`
        : '';

      toast({
        title: 'Cliente cadastrado direto no ISPFY!',
        description: `${data.nome}${clientIdLabel} integrado com sucesso${ticketLabel}.`,
      });

      setIsOpen(false);
      form.reset();
    } catch (error: unknown) {
      console.error('Erro ao cadastrar assinante no ISPFY:', error);
      toast({
        title: 'Erro no cadastro ISPFY',
        description:
          error instanceof Error
            ? error.message
            : 'Não foi possível concluir a integração automática no ISPFY.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
          <UserPlus className="w-4 h-4 mr-1" />
          Cadastrar no ISPFY
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-blue-600" />
            Cadastro Direto no ISPFY (Lead → Assinante)
          </DialogTitle>
          <DialogDescription>
            Integre {userDetails.name} diretamente na base do ISPFY sem digitar tokens ou IPs, com opção de abrir O.S. de instalação automaticamente.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleISPFYPreRegistration)} className="space-y-4">
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 flex items-center gap-2.5 text-xs text-blue-800 dark:text-blue-200">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Conexão segura automática via servidor Cloud Functions (`POST /api/tool/cliente/novo`).
                </span>
              </div>

              {/* Dados do cliente */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo / Razão Social *</FormLabel>
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
                      <FormLabel>CPF / CNPJ *</FormLabel>
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
                      <FormLabel>Telefone / WhatsApp *</FormLabel>
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

                {cities.length > 0 ? (
                  <FormField
                    control={form.control}
                    name="cidade_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade / Filial ISPFY *</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(val) => {
                            field.onChange(val);
                            const found = cities.find((c) => String(c.id) === val);
                            if (found) {
                              form.setValue('cidade', found.nome_fantasia || found.razao || '');
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  loadingCities ? 'Carregando cidades...' : 'Selecione a cidade'
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {cities.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.nome_fantasia || c.razao}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="cidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={loadingCities ? 'Carregando cidades...' : 'Nome da cidade'}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ponto de referência, melhor horário de instalação, CTO próxima..."
                        className="min-h-[75px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="p-3.5 rounded-lg border bg-muted/40 space-y-3">
                <FormField
                  control={form.control}
                  name="abrir_os_instalacao"
                  render={({ field }) => (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold">
                          Abrir O.S. de Instalação automaticamente no ISPFY
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Gera o ticket técnico vinculado ao novo assinante logo após o cadastro.
                        </p>
                      </div>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </div>
                  )}
                />

                {form.watch('abrir_os_instalacao') && (
                  <FormField
                    control={form.control}
                    name="assunto_os"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Assunto da O.S.</FormLabel>
                        <FormControl>
                          <Input className="h-8 text-xs" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="flex gap-2 pt-2">
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
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Integrando ao ISPFY...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Cadastrar no ISPFY
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
