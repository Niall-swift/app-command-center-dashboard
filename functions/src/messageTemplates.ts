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

{Estamos muito felizes|Ficamos felizes|Que bom} em ter você {conosco|com a gente|participando}!

{Em breve|Logo logo|Fique atento}, você receberá {novidades|informações|atualizações} sobre {sorteios|promoções|benefícios exclusivos}! {🎯|🚀|💫}

{Qualquer dúvida|Se precisar de algo|Precisa de ajuda}? {Estamos aqui|Chama a gente|Entre em contato}!

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
