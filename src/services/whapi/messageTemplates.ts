import type { MessageTemplate } from '@/types/whapi';

export const messageTemplates: MessageTemplate[] = [
  {
    id: 'vencida',
    name: 'Fatura Vencida',
    subject: 'Fatura em Atraso',
    body: `Olá {{nome}}! 👋

Identificamos que sua fatura no valor de *R$ {{valor}}* com vencimento em {{data_vencimento}} está em atraso há {{dias_atraso}} dias.

⚠️ Para evitar a suspensão do serviço, realize o pagamento o quanto antes.

{{link_boleto}}

Dúvidas? Entre em contato conosco!

_Mensagem automática - AVL Telecom_`,
    variables: ['nome', 'valor', 'data_vencimento', 'dias_atraso', 'link_boleto']
  },
  {
    id: 'vencendo_hoje',
    name: 'Vencendo Hoje',
    subject: 'Fatura Vence Hoje',
    body: `Olá {{nome}}! 👋

⏰ Sua fatura no valor de *R$ {{valor}}* vence *HOJE* ({{data_vencimento}}).

Evite multas e juros! Pague até o final do dia.

{{link_boleto}}

_Mensagem automática - AVL Telecom_`,
    variables: ['nome', 'valor', 'data_vencimento', 'link_boleto']
  },
  {
    id: 'vencendo_breve',
    name: 'Vencendo em Breve',
    subject: 'Lembrete de Vencimento',
    body: `Olá {{nome}}! 👋

📅 Sua fatura no valor de *R$ {{valor}}* vence em {{data_vencimento}}.

Evite multas e juros! Pague até o vencimento.

{{link_boleto}}

_Mensagem automática - AVL Telecom_`,
    variables: ['nome', 'valor', 'data_vencimento', 'link_boleto']
  }
];

export function fillTemplate(template: MessageTemplate, data: Record<string, string>): string {
  let message = template.body;
  
  // Substituir variáveis
  template.variables.forEach(variable => {
    const value = data[variable] || '';
    message = message.replace(new RegExp(`{{${variable}}}`, 'g'), value);
  });
  
  return message;
}

export function getTemplateForGroup(group: string): MessageTemplate {
  if (group.startsWith('vencidas')) {
    return messageTemplates[0]; // Vencida
  } else if (group === 'vencendo_hoje') {
    return messageTemplates[1]; // Vencendo Hoje
  } else {
    return messageTemplates[2]; // Vencendo em Breve
  }
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR');
}

export function calculateDaysOverdue(vencimento: string): number {
  const hoje = new Date();
  const dataVenc = new Date(vencimento);
  const diff = hoje.getTime() - dataVenc.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
