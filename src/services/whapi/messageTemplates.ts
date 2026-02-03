import type { MessageTemplate } from '@/types/whapi';
import { calculateDaysDiff, formatDate } from '@/utils/date';

export const messageTemplates: MessageTemplate[] = [
  {
    id: 'vencida',
    name: 'Fatura Vencida',
    subject: 'Fatura em Atraso',
    body: `{Olá|Oi|Oiê|Saudações|Tudo bem}, {{nome}}! {👋|😀|🙂|👀}

{Identificamos|Verificamos|Consta no sistema|Notamos} que sua fatura de *R$ {{valor}}* (vencimento: {{data_vencimento}}) {está em atraso|ainda está pendente|consta em aberto|não foi compensada} há {{dias_atraso}} dias.

{⚠️|❗|🚨|🛑} {Para evitar a suspensão|Para não ter o serviço interrompido|Evite o bloqueio} da sua internet, {realize|efetue|faça} o pagamento {o quanto antes|assim que possível|hoje mesmo}.

{Segue o link|Link para pagamento|Acesse sua fatura aqui|Boleto disponível abaixo}:
{{link_boleto}}

{Dúvidas|Qualquer dúvida|Precisa de ajuda}? {Entre em contato|Chama a gente|Estamos à disposição}!

_Att, {Josué|Soraya|Luan|Estela} - AVL Telecom_
_Caso já tenha pago, {desconsidere|ignore|por favor desconsidere} esta mensagem._`,
    variables: ['nome', 'valor', 'data_vencimento', 'dias_atraso', 'link_boleto']
  },
  {
    id: 'vencendo_hoje',
    name: 'Vencendo Hoje',
    subject: 'Fatura Vence Hoje',
    body: `{{nome}}, {bom dia|tarde|olá}! {👋|😊|🚀}

{⏰|📅|🔔|📢} {Passando para avisar|Um lembrete amigo|Só para lembrar|Lembrete rápido}:
Sua fatura de *R$ {{valor}}* {vence|tem vencimento} *HOJE* ({{data_vencimento}}).

{Evite|Não pague} multas e juros! {Pague|Realize o pagamento} {agora mesmo|hoje} e {garanta|mantenha} sua conexão {ativa|voando}.

{Baixe o boleto|Copie o código|Acesse a fatura}:
{{link_boleto}}

_Att, {Josué|Soraya|Luan|Estela} - AVL Telecom_
_{Mensagem automática|Lembrete automático}, caso já tenha pago, {desconsidere|ignore}._`,
    variables: ['nome', 'valor', 'data_vencimento', 'link_boleto']
  },
  {
    id: 'vencendo_breve',
    name: 'Vencendo em Breve',
    subject: 'Lembrete de Vencimento',
    body: `{Olá|Oi|Saudações}, {{nome}}! {👋|✨}

{📅|🗓️|📆} {Lembrete|Aviso antecipado}: Sua fatura de *R$ {{valor}}* vence em {{data_vencimento}} ({apenas|faltam} {{dias_restantes}} dias).

{Evite|Previna-se de} {imprevistos|multas} e juros! {Pague|Programe o pagamento} {com tranquilidade|antecipado} até o vencimento.

{Link do boleto|Acesse aqui|Fatura digital}:
{{link_boleto}}

_Att, {Josué|Soraya|Luan|Estela} - AVL Telecom_
_Caso já tenha pago, {desconsidere|ignore}._`,
    variables: ['nome', 'valor', 'data_vencimento', 'link_boleto', 'dias_restantes']
  },
  {
    id: 'aviso_bloqueio',
    name: 'Aviso de Bloqueio',
    subject: 'Acesso Bloqueado',
    body: `{{nome}}, {tudo bem?|como vai?} {👋|🛑|⚠️}

{Identificamos|Verificamos} um {bloqueio|bloqueio temporário} na sua conexão. Isso ocorreu devido à fatura de *{{data_vencimento}}* que {consta em aberto|ainda não foi compensada}.

Para {regularizar|liberar|restabelecer} o acesso {imediatamente|agora}, {responda essa mensagem|nos chame aqui|entre em contato}.

Estamos aguardando! {👊|🤝}

_Att, {Josué|Soraya|Luan|Estela} - AVL Telecom_`,
    variables: ['nome', 'data_vencimento']
  },
  {
    id: 'warmup',
    name: 'Aquecimento (Sem Link)',
    subject: 'Aquecimento de Chip',
    body: `{Olá|Oi|Opa|E aí}, {{nome}}! {tudo bem?|como vai?} {👋|😀|🙂}

{Passando apenas para|Só passando para} {desejar um ótimo dia|saber se está tudo certo com sua internet|perguntar se precisa de alguma ajuda}.

{Qualquer coisa|Se precisar}, {chama a gente|estamos por aqui}!

_Att, {Josué|Soraya|Luan|Estela} - AVL Telecom_`,
    variables: ['nome']
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
  if (group === 'warmup') {
    return messageTemplates[4]; // Aquecimento
  } else if (group.startsWith('vencidas')) {
    return messageTemplates[0]; // Vencida
  } else if (group === 'vencendo_hoje') {
    return messageTemplates[1]; // Vencendo Hoje
  } else if (group === 'bloqueados') {
    return messageTemplates[3]; // Aviso de Bloqueio
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

// Re-exporta formatDate para manter compatibilidade mas usando a nova lógica
export { formatDate };

export function calculateDaysOverdue(vencimento: string): number {
  const diff = calculateDaysDiff(vencimento);
  return diff > 0 ? diff : 0;
}

export function calculateDaysRemaining(vencimento: string): number {
  const diff = calculateDaysDiff(vencimento);
  return diff < 0 ? Math.abs(diff) : 0;
}
