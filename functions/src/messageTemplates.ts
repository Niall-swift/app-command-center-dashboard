/**
 * Templates de mensagens de boas-vindas com Spintax
 */

export interface MessageTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

export const premixWelcomeTemplate: MessageTemplate = {
  id: "premix_welcome",
  name: "Boas-Vindas Pre-Mix",
  subject: "Boas-Vindas ao Pre-Mix",
  body: `{Olá|Oi|Opa|E aí}, {{nome}}! {👋|🎉|✨}

{Seja bem-vindo|Bem-vindo|É um prazer ter você} ao *Pre-Mix*! {🎊|🎁|🌟}

{Seu cadastro foi realizado com sucesso|Você já está cadastrado}! {🚀|💫}

{Confira as regras aqui|Veja as regras do sorteio}: https://avl-telecom-promo-page-main.vercel.app/

*Importante:* {Você precisa|É necessário} ter o *App da AVL Telecom* instalado, pois {você receberá|existe} um *código único* para resgatar o prêmio. {📱|🎟️|✨}

{Qualquer dúvida|Se precisar de ajuda}? {Estamos aqui|Chama a gente}!

_Att, Equipe Pre-Mix_`,
  variables: ["nome"],
};

/**
 * Preenche o template com os dados fornecidos
 */
export function fillTemplate(
  template: MessageTemplate,
  data: Record<string, string>
): string {
  let message = template.body;

  // Substituir variáveis
  template.variables.forEach((variable) => {
    const value = data[variable] || "";
    message = message.replace(new RegExp(`{{${variable}}}`, "g"), value);
  });

  return message;
}

/**
 * Aplica Spintax para gerar variações de mensagem
 * Exemplo: {Olá|Oi|Opa} -> escolhe aleatoriamente uma opção
 */
export function spin(text: string): string {
  const pattern = /{([^{}]+)}/g;
  let result = text;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    const options = match[1].split("|");
    const randomOption = options[Math.floor(Math.random() * options.length)];
    result = result.replace(match[0], randomOption);
  }

  return result;
}
