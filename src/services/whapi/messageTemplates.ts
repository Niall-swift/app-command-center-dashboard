import type { MessageTemplate } from '@/types/whapi';
import { calculateDaysDiff, formatDate } from '@/utils/date';

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES: FATURA VENCIDA
// ─────────────────────────────────────────────────────────────────────────────
export const templatesFaturaVencida: MessageTemplate[] = [
  {
    id: 'vencida_1',
    name: 'Fatura Vencida – Gentil',
    subject: 'Fatura em Atraso',
    body: `{Olá|Oi|Boa tarde|Bom dia}, {{nome}}! {👋|😊}

{Tudo bem?|Como vai?} Passando {rapidinho|só} para {avisar|lembrar} que {identificamos|consta aqui} uma fatura de *R$ {{valor}}* com vencimento em {{data_vencimento}} que ainda {não foi paga|está em aberto}.

{Fica tranquilo|Não se preocupe}, {acontece com todo mundo|a gente entende}! 😉 {Regularize|Quite} o valor {o quanto antes|assim que possível} para {manter|garantir} sua internet {turbinada|funcionando direitinho}.

{Link da fatura|Boleto aqui}:\n{{link_boleto}}

{Qualquer dúvida, é só chamar|Precisando de ajuda, estamos por aqui}! 🤝

_Att, {Josué|Soraya|Luan|Estela} – AVL Telecom_
_Caso já tenha pago, {desconsidere|ignore} este aviso._`,
    variables: ['nome', 'valor', 'data_vencimento', 'link_boleto'],
  },
  {
    id: 'vencida_2',
    name: 'Fatura Vencida – Urgente',
    subject: 'Fatura em Atraso',
    body: `{Atenção|Aviso importante}, {{nome}}! {⚠️|🚨|❗}

{Identificamos|Verificamos no sistema} que sua fatura de *R$ {{valor}}* (venc. {{data_vencimento}}) está em atraso há *{{dias_atraso}} dias*.

{Para evitar o bloqueio do seu serviço|Para não ter sua internet suspensa}, {realize|efetue} o pagamento {hoje mesmo|o quanto antes|com urgência}.

{Acesse seu boleto|Clique para pagar}:\n{{link_boleto}}

{Importe-se|Não deixe passar}! {Em caso de dúvidas|Se precisar}, {chame a gente|entre em contato}.

_Att, {Josué|Soraya|Luan|Estela} – AVL Telecom_`,
    variables: ['nome', 'valor', 'data_vencimento', 'dias_atraso', 'link_boleto'],
  },
  {
    id: 'vencida_3',
    name: 'Fatura Vencida – Informal',
    subject: 'Fatura em Atraso',
    body: `{Oi|E aí}, {{nome}}! {👋|😄}

{A gente notou|Vimos aqui} que ainda {tem uma fatura|consta um débito} de *R$ {{valor}}* no seu nome, com venc. em {{data_vencimento}}.

{Bora acertar isso|Vamos resolver isso juntos}? {Pagando|Quitando} agora você {garante|mantém} a internet {no ar|funcionando} sem {sustos|interrupções}.

{Seu boleto tá aqui|Link para pagamento}:\n{{link_boleto}}

{Qualquer coisa, chama aqui|Precisando, é só falar}! 💬

_Att, {Josué|Soraya|Luan|Estela} – AVL Telecom_
_{Mensagem automática.|Caso já tenha pago, pode desconsiderar.}_`,
    variables: ['nome', 'valor', 'data_vencimento', 'link_boleto'],
  },
  {
    id: 'vencida_4',
    name: 'Fatura Vencida – Empática',
    subject: 'Fatura em Atraso',
    body: `{{nome}}, {olá|oi}! {💙|🌟}

{Sabemos que a correria do dia a dia|A vida atarefada} às vezes faz a gente esquecer de alguns detalhes… {e tudo bem!|e a gente entende!}

{Mas, para não ter|Para evitar} surpresas na sua conexão, {precisamos|gostaríamos} avisar que a fatura de *R$ {{valor}}* (venc. {{data_vencimento}}) {está em aberto|ainda não foi quitada}.

{Regularize|Pague} {com facilidade|agora} pelo link abaixo:\n{{link_boleto}}

{Se tiver alguma dificuldade|Precisando de atendimento}, {estamos aqui|pode falar}, {vamos te ajudar|resolveremos juntos}! 😊

_Att, {Josué|Soraya|Luan|Estela} – AVL Telecom_`,
    variables: ['nome', 'valor', 'data_vencimento', 'link_boleto'],
  },
  {
    id: 'vencida_5',
    name: 'Fatura Vencida – Direta',
    subject: 'Fatura em Atraso',
    body: `{{nome}}, {bom dia|boa tarde|olá}!

{Aqui é|Contato d}a *AVL Telecom*. 📶

{Consta em nosso sistema|Verificamos} que a fatura de *R$ {{valor}}*, com vencimento em {{data_vencimento}}, *não foi identificada como paga* até o momento.

{Pedimos|Solicitamos} que regularize {o quanto antes|com brevidade} para {evitar|não sofrer} {a suspensão|interrupção} do serviço.

{Boleto|Fatura}:\n{{link_boleto}}

{Atenciosamente|Abraços},
_{Josué|Soraya|Luan|Estela} – AVL Telecom_`,
    variables: ['nome', 'valor', 'data_vencimento', 'link_boleto'],
  },
  {
    id: 'vencida_6',
    name: 'Fatura Vencida – Última Chance',
    subject: 'Fatura em Atraso',
    body: `{Olá|Oi}, {{nome}}. {🔔|📣}

{Este é um aviso importante|Precisamos te avisar} sobre {seu plano de internet|sua conexão} com a AVL Telecom.

{A fatura|O boleto} de *R$ {{valor}}* está *{{dias_atraso}} dias em atraso* (venc. {{data_vencimento}}). {Caso não ocorra o pagamento|Se não for regularizado}, o serviço {poderá ser suspenso|será bloqueado} {em breve|a qualquer momento}.

{Pague agora|Regularize hoje}:\n{{link_boleto}}

{Após a confirmação do pagamento|Assim que o pagamento for identificado}, {seu acesso será reativado|a conexão retornará automaticamente}. {⚡|🚀}

_AVL Telecom – {Josué|Soraya|Luan|Estela}_`,
    variables: ['nome', 'valor', 'data_vencimento', 'dias_atraso', 'link_boleto'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES: VENCENDO HOJE
// ─────────────────────────────────────────────────────────────────────────────
export const templatesVencendoHoje: MessageTemplate[] = [
  {
    id: 'vencendo_hoje_1',
    name: 'Vence Hoje – Animado',
    subject: 'Fatura Vence Hoje',
    body: `{{nome}}, {bom dia|boa tarde}! {☀️|👋|😊}

{Só um lembrete|Passando rapidinho para avisar}: {sua fatura|o boleto} de *R$ {{valor}}* vence *HOJE* ({{data_vencimento}})! {⏰|⚡}

{Não deixe|Evite} multas e juros! {Pague|Quite} hoje e {mantenha|garanta} sua internet {voando|no ar}.

{Acesse o boleto|Link para pagamento|Copie o código Pix}:\n{{link_boleto}}

_Att, {Josué|Soraya|Luan|Estela} – AVL Telecom_
_{Lembrete automático – caso já tenha pago, desconsidere.}_`,
    variables: ['nome', 'valor', 'data_vencimento', 'link_boleto'],
  },
  {
    id: 'vencendo_hoje_2',
    name: 'Vence Hoje – Urgente',
    subject: 'Fatura Vence Hoje',
    body: `{Atenção|Aviso}, {{nome}}! {📅|⏰|🔔}

Sua fatura de *R$ {{valor}}* vence *hoje, {{data_vencimento}}*.

{Pague antes da meia-noite|Não perca o prazo|Quite ainda hoje} para {evitar|não acumular} multa e juros e {manter|não perder} seu acesso à internet.

{Boleto|Fatura digital}:\n{{link_boleto}}

_AVL Telecom – {Josué|Soraya|Luan|Estela}_`,
    variables: ['nome', 'valor', 'data_vencimento', 'link_boleto'],
  },
  {
    id: 'vencendo_hoje_3',
    name: 'Vence Hoje – Amigável',
    subject: 'Fatura Vence Hoje',
    body: `{E aí|Oi}, {{nome}}! {👋|😄}

{A gente não esqueceu de você|Lembrete de amigo} aqui da AVL! {😉|🤝}

Sua fatura de *R$ {{valor}}* tem vencimento *hoje* ({{data_vencimento}}). {Aproveita|Não deixa pra depois} e {garante|mantém} sua internet {sem interrupções|funcionando direitinho}.

{Pagar agora é moleza|É rápido, basta clicar abaixo}:\n{{link_boleto}}

{Qualquer dúvida, chama|Tá com dúvida? Fala com a gente}! 💬

_Att, {Josué|Soraya|Luan|Estela} – AVL Telecom_`,
    variables: ['nome', 'valor', 'data_vencimento', 'link_boleto'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES: VENCENDO EM BREVE
// ─────────────────────────────────────────────────────────────────────────────
export const templatesVencendoBreve: MessageTemplate[] = [
  {
    id: 'vencendo_breve_1',
    name: 'Vence em Breve – Gentil',
    subject: 'Lembrete de Vencimento',
    body: `{Olá|Oi|Boa tarde}, {{nome}}! {👋|✨}

{Lembretezinho|Aviso rápido|Passando para lembrar}: sua fatura de *R$ {{valor}}* vence em *{{data_vencimento}}* ({faltam|apenas} *{{dias_restantes}} dias*).

{Pague|Quite} {com antecedência|antes do prazo} e {evite|fuja de} multas e juros. {Fica mais tranquilo|Você agradece depois}! 😊

{Boleto|Fatura digital}:\n{{link_boleto}}

_Att, {Josué|Soraya|Luan|Estela} – AVL Telecom_
_Caso já tenha pago, desconsidere._`,
    variables: ['nome', 'valor', 'data_vencimento', 'link_boleto', 'dias_restantes'],
  },
  {
    id: 'vencendo_breve_2',
    name: 'Vence em Breve – Informal',
    subject: 'Lembrete de Vencimento',
    body: `{E aí|Oi}, {{nome}}! {🙂|👋}

{Vem cá|Atenção}: sua fatura de *R$ {{valor}}* vai vencer em {{data_vencimento}} ({só|faltam} {{dias_restantes}} dias!).

{Não esquece|Não deixa passar}! Pagar {antes|antecipado} é sempre melhor. {Bora resolver|Que tal já pagar}? 😄

{Link do boleto|Acesse aqui}:\n{{link_boleto}}

{Qualquer dúvida, fala com a gente|Precisando, é só chamar}! 💬

_Att, {Josué|Soraya|Luan|Estela} – AVL Telecom_`,
    variables: ['nome', 'valor', 'data_vencimento', 'link_boleto', 'dias_restantes'],
  },
  {
    id: 'vencendo_breve_3',
    name: 'Vence em Breve – Proativo',
    subject: 'Lembrete de Vencimento',
    body: `{{nome}}, {olá|tudo bem?}! {📅|🗓️}

Sua próxima fatura com a *AVL Telecom* é de *R$ {{valor}}* e vence em {{data_vencimento}} ({{dias_restantes}} dias restantes).

{Que tal já deixar programado o pagamento|Aproveite para já pagar agora}? Assim você {mantém|garante} seu acesso {sem preocupações|sem sustos}.

{Fatura disponível|Boleto aqui}:\n{{link_boleto}}

_Att, {Josué|Soraya|Luan|Estela} – AVL Telecom_`,
    variables: ['nome', 'valor', 'data_vencimento', 'link_boleto', 'dias_restantes'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES: CLIENTE BLOQUEADO
// ─────────────────────────────────────────────────────────────────────────────
export const templatesBloqueados: MessageTemplate[] = [
  {
    id: 'bloqueado_1',
    name: 'Bloqueado – Gentil',
    subject: 'Acesso Bloqueado',
    body: `{Olá|Oi}, {{nome}}! {👋|🙂}

{Percebemos|Identificamos} que sua internet {está sem acesso|foi temporariamente suspensa} {desde|a partir de} {{data_vencimento}} devido a {uma fatura em aberto|um débito pendente}.

{Não se preocupe|Fica tranquilo} – é {rápido e simples|fácil} de resolver! {Regularize|Pague} o valor em aberto e {sua conexão volta logo|o acesso é liberado automaticamente}. {⚡|🚀}

{Quer ajuda|Precisando de apoio}? {Responda esta mensagem|Chama a gente}, estamos {prontos|disponíveis} para te atender!

_Att, {Josué|Soraya|Luan|Estela} – AVL Telecom_`,
    variables: ['nome', 'data_vencimento'],
  },
  {
    id: 'bloqueado_2',
    name: 'Bloqueado – Urgente',
    subject: 'Acesso Bloqueado',
    body: `{{nome}}, {atenção|aviso importante}! {🚨|🛑}

Sua conexão com a internet {foi bloqueada|está suspensa} por conta da fatura de {{data_vencimento}} que {consta em aberto|não foi identificada como paga}.

{Para reativar|Para liberar o acesso} {imediatamente|agora mesmo}, {entre em contato|responda esta mensagem} e {vamos resolver|te ajudamos} na {hora|maior velocidade}!

{Não perca mais|Cada minuto sem internet conta}! {📶|⚡}

_Att, {Josué|Soraya|Luan|Estela} – AVL Telecom_`,
    variables: ['nome', 'data_vencimento'],
  },
  {
    id: 'bloqueado_3',
    name: 'Bloqueado – Empático',
    subject: 'Acesso Bloqueado',
    body: `{{nome}}, {olá|oi}! 💙

{A gente sabe que|Entendemos que} às vezes {bate um aperto|passamos por dificuldades}, e tudo bem! {Estamos aqui para ajudar|Você não está sozinho}.

Sua internet {foi pausada|está bloqueada} devido à fatura de {{data_vencimento}}. {Mas não precisa se preocupar|A boa notícia}: {assim que|no momento em que} o pagamento for {confirmado|identificado}, {o acesso volta|a internet é reativada} {automático|na hora}. {⚡|🚀}

{Precisando negociar|Se quiser parcelar} ou {tirar dúvidas|entender melhor}, {é só chamar|estamos aqui}. 🤝

_Att, {Josué|Soraya|Luan|Estela} – AVL Telecom_`,
    variables: ['nome', 'data_vencimento'],
  },
  {
    id: 'bloqueado_4',
    name: 'Bloqueado – Direto ao Ponto',
    subject: 'Acesso Bloqueado',
    body: `{{nome}}, {bom dia|boa tarde}!

{Aqui é a|Contato d}a *AVL Telecom*.

{Informamos|Comunicamos} que seu serviço de internet {foi suspenso|está bloqueado} por débito em aberto (venc. {{data_vencimento}}).

{Para regularização|Para reativar seu acesso}, {por favor responda esta mensagem|entre em contato conosco} {o quanto antes|com urgência}.

{Atenciosamente|Abraços},
_{Josué|Soraya|Luan|Estela} – AVL Telecom_`,
    variables: ['nome', 'data_vencimento'],
  },
  {
    id: 'bloqueado_5',
    name: 'Bloqueado – Solução Rápida',
    subject: 'Acesso Bloqueado',
    body: `{Oi|E aí}, {{nome}}! {👋|😊}

{Notamos|Vimos} que sua internet {tá bloqueada|está sem acesso} desde {{data_vencimento}} por conta de {um boleto em aberto|uma fatura pendente}.

{A solução é rápida|Fica tranquilo}: {é só|basta} regularizar o pagamento e {pronto, a internet volta|o acesso é liberado na hora}! {⚡|🚀}

{Para gerar uma nova via|Se precisar do boleto}, {chama aqui|fala com a gente} que {a gente te manda|enviamos na hora}! 💬

_Att, {Josué|Soraya|Luan|Estela} – AVL Telecom_`,
    variables: ['nome', 'data_vencimento'],
  },
  {
    id: 'bloqueado_6',
    name: 'Bloqueado – Última Tentativa',
    subject: 'Acesso Bloqueado',
    body: `{{nome}}, {olá|oi}! {🔔|📣}

{Esta é|Aqui vai} {mais uma tentativa de|outro} contato da *AVL Telecom* {sobre|referente a} sua internet, que {está bloqueada|encontra-se suspensa} {desde|a partir de} {{data_vencimento}}.

{Gostaríamos muito de|Queremos} resolver {isso de forma rápida|a situação} {com você|junto com você}. {Pode ser uma questão simples de|Às vezes é só} {confirmação de pagamento|um pagamento que não foi identificado}.

{Por favor, nos retorne|Por gentileza, responda esta mensagem} {o quanto antes|hoje} para {evitar|não ter} {maiores consequências|mais transtornos}. {🤝|🙏}

_Att, {Josué|Soraya|Luan|Estela} – AVL Telecom_`,
    variables: ['nome', 'data_vencimento'],
  },
  {
    id: 'bloqueado_7',
    name: 'Bloqueado – Negociação',
    subject: 'Acesso Bloqueado',
    body: `{Oi|Olá}, {{nome}}! {👋|💬}

{Estamos tentando|Passamos para} {entrar em contato|falar com você} sobre {sua conexão|seu plano de internet} com a *AVL Telecom*, que {está suspensa|foi bloqueada} desde {{data_vencimento}}.

{Sabemos que pode ter sido|Entendemos que às vezes acontece} um {imprevisto|esquecimento}. {Por isso|Pensando nisso}, {estamos disponíveis para conversar|temos opções} – {seja para negociar|parcelar}, emitir {segunda via|novo boleto} ou {apenas confirmar|checar} {um pagamento já feito|se já pagou}.

{Chama aqui|Responde essa mensagem} {e resolve na hora|rapidinho}! {⚡|😊}

_Att, {Josué|Soraya|Luan|Estela} – AVL Telecom_`,
    variables: ['nome', 'data_vencimento'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES ESPECIAIS (sem alteração)
// ─────────────────────────────────────────────────────────────────────────────
export const templateWarmup: MessageTemplate = {
  id: 'warmup',
  name: 'Aquecimento (Sem Link)',
  subject: 'Aquecimento de Chip',
  body: `{Olá|Oi|Opa|E aí}, {{nome}}! {tudo bem?|como vai?} {👋|😀|🙂}

{Passando apenas para|Só passando para} {desejar um ótimo dia|saber se está tudo certo com sua internet|perguntar se precisa de alguma ajuda}.

{Qualquer coisa|Se precisar}, {chama a gente|estamos por aqui}!

_Att, {Josué|Soraya|Luan|Estela} - AVL Telecom_`,
  variables: ['nome'],
};

export const templatePremixWelcome: MessageTemplate = {
  id: 'premix_welcome',
  name: 'Boas-Vindas Pre-Mix',
  subject: 'Boas-Vindas ao Pre-Mix',
  body: `{Olá|Oi|Opa|E aí}, {{nome}}! {👋|🎉|✨}

{Seja bem-vindo|Bem-vindo|É um prazer ter você} ao *Pre-Mix*! {🎊|🎁|🌟}

{Estamos muito felizes|Ficamos felizes|Que bom} em ter você {conosco|com a gente|participando}!

{Em breve|Logo logo|Fique atento}, você receberá {novidades|informações|atualizações} sobre {sorteios|promoções|benefícios exclusivos}! {🎯|🚀|💫}

{Qualquer dúvida|Se precisar de algo|Precisa de ajuda}? {Estamos aqui|Chama a gente|Entre em contato}!

_Att, Equipe Pre-Mix_`,
  variables: ['nome'],
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Sorteia aleatoriamente um template de um array */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function fillTemplate(template: MessageTemplate, data: Record<string, string>): string {
  let message = template.body;
  template.variables.forEach(variable => {
    const value = data[variable] || '';
    message = message.replace(new RegExp(`{{${variable}}}`, 'g'), value);
  });
  return message;
}

export function getTemplateForGroup(group: string): MessageTemplate {
  if (group === 'warmup') {
    return templateWarmup;
  } else if (group === 'premix_welcome') {
    return templatePremixWelcome;
  } else if (group.startsWith('vencidas')) {
    return pickRandom(templatesFaturaVencida);
  } else if (group === 'vencendo_hoje') {
    return pickRandom(templatesVencendoHoje);
  } else if (group === 'bloqueados') {
    return pickRandom(templatesBloqueados);
  } else {
    return pickRandom(templatesVencendoBreve);
  }
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Re-exporta formatDate para manter compatibilidade
export { formatDate };

export function calculateDaysOverdue(vencimento: string): number {
  const diff = calculateDaysDiff(vencimento);
  return diff > 0 ? diff : 0;
}

export function calculateDaysRemaining(vencimento: string): number {
  const diff = calculateDaysDiff(vencimento);
  return diff < 0 ? Math.abs(diff) : 0;
}

// Exportação dos arrays originais (compatibilidade com quem importar diretamente)
export const messageTemplates: MessageTemplate[] = [
  ...templatesFaturaVencida,
  ...templatesVencendoHoje,
  ...templatesVencendoBreve,
  ...templatesBloqueados,
  templateWarmup,
  templatePremixWelcome,
];
