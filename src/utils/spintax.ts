/**
 * Processador de Spintax (Spin Syntax)
 * Permite variações de texto usando o formato {opção1|opção2|opção3}
 * Exemplo: "{Olá|Oi|E aí} como vai?" -> "Oi como vai?"
 */
export function spin(text: string): string {
  if (!text) return '';

  // Regex para encontrar padrões {a|b|c}
  // Usa um loop para garantir que spintax aninhados funcionem (se houver, embora nosso uso seja simples)
  let result = text;
  const spintaxRegex = /\{([^{}]+)\}/g;

  while (spintaxRegex.test(result)) {
    result = result.replace(spintaxRegex, (match, content) => {
      const choices = content.split('|');
      const randomIndex = Math.floor(Math.random() * choices.length);
      return choices[randomIndex];
    });
  }

  return result;
}
