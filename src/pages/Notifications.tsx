import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, Send, Zap, Users, User, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/config/firebase";

const customNotificationSchema = z.object({
  title: z.string().min(3, "O título deve ter no mínimo 3 caracteres"),
  body: z.string().min(5, "A mensagem deve ter no mínimo 5 caracteres"),
  target: z.enum(["all", "specific"]),
  userId: z.string().optional(),
  screen: z.string().default("HomePage"),
}).refine((data) => {
  if (data.target === "specific" && !data.userId) {
    return false;
  }
  return true;
}, {
  message: "ID do usuário é obrigatório para envio específico",
  path: ["userId"],
});

export default function Notifications() {
  const [isTriggeringInvoices, setIsTriggeringInvoices] = useState(false);
  const [isSendingCustom, setIsSendingCustom] = useState(false);

  const form = useForm<z.infer<typeof customNotificationSchema>>({
    resolver: zodResolver(customNotificationSchema),
    defaultValues: {
      title: "",
      body: "",
      target: "all",
      userId: "",
      screen: "HomePage",
    },
  });

  const target = form.watch("target");

  const handleTriggerInvoices = async () => {
    setIsTriggeringInvoices(true);
    const triggerPromise = async () => {
      const triggerInvoiceCheckManual = httpsCallable(functions, 'triggerInvoiceCheckManual');
      const result = await triggerInvoiceCheckManual();
      return result.data;
    };

    toast.promise(triggerPromise(), {
      loading: "Verificando faturas e disparando notificações...",
      success: (data: any) => `Verificação concluída! ${data.sent} notificações enviadas.`,
      error: "Erro ao disparar verificação de faturas. Verifique o console.",
    });
    
    setIsTriggeringInvoices(false);
  };

  const onSubmitCustom = async (values: z.infer<typeof customNotificationSchema>) => {
    setIsSendingCustom(true);
    
    const sendPromise = async () => {
      const sendCustomNotification = httpsCallable(functions, 'sendCustomNotification');
      const result = await sendCustomNotification({
        title: values.title,
        body: values.body,
        target: values.target,
        userId: values.userId,
        screen: values.screen
      });
      return result.data;
    };

    toast.promise(sendPromise(), {
      loading: "Enviando notificação...",
      success: (data: any) => {
        form.reset();
        return `Sucesso! Notificação enviada para ${data.sent} dispositivo(s).`;
      },
      error: "Erro ao enviar notificação. Verifique o console para mais detalhes.",
    });

    setIsSendingCustom(false);
  };

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Notificações Push</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        {/* Card Verificação de Faturas */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Faturas (Automático)
            </CardTitle>
            <CardDescription>
              A verificação de faturas (Pre-mix / IXC) está agendada para rodar todos os dias às 08:00 AM automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-orange-500/10 p-4 rounded-lg flex items-start gap-3 border border-orange-500/20">
              <Zap className="w-5 h-5 text-orange-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-orange-500">Disparo Manual</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Use esta opção para forçar a verificação de faturas de todos os clientes agora mesmo, ignorando o agendamento de 08:00.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleTriggerInvoices} 
              disabled={isTriggeringInvoices}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              {isTriggeringInvoices ? "Processando..." : "Disparar Verificação Agora"}
            </Button>
          </CardFooter>
        </Card>

        {/* Card Envio Customizado */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-500" />
              Nova Notificação Customizada
            </CardTitle>
            <CardDescription>
              Crie uma notificação avulsa para enviar a um cliente específico ou para toda a base.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitCustom)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título da Notificação</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Novidade na AVL Telecom!" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="body"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Corpo da Mensagem</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Digite a mensagem que o cliente irá receber..." 
                          className="resize-none" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="target"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Público Alvo</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="all" />
                              </FormControl>
                              <FormLabel className="font-normal flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground" /> Todos os Clientes
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="specific" />
                              </FormControl>
                              <FormLabel className="font-normal flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" /> Cliente Específico
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="screen"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ação ao clicar (Tela)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a tela" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="HomePage">Início</SelectItem>
                            <SelectItem value="Boletos">Faturas / Boletos</SelectItem>
                            <SelectItem value="chat">Suporte (Chat)</SelectItem>
                            <SelectItem value="Profile">Perfil</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Tela que abrirá no app
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {target === "specific" && (
                  <FormField
                    control={form.control}
                    name="userId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID do Cliente (IXC) ou CPF</FormLabel>
                        <FormControl>
                          <Input placeholder="Digite o ID ou CPF do cliente" {...field} />
                        </FormControl>
                        <FormDescription>
                          Apenas números. O sistema buscará o token associado.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <Button type="submit" disabled={isSendingCustom} className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  {isSendingCustom ? "Enviando..." : "Enviar Notificação"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
