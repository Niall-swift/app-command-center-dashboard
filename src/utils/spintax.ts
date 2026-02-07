/**
 * Processador de Spintax (Spin Syntax)
 * Permite variações de texto usando o formato {opção1|opção2|opção3}
 * Exemplo: "{Olá|Oi|E aí} como vai?" -> "Oi como vai?"
 */
export function spin(text: string): string {
  if (!text) return '';

  // Regex para encontrar padrões {a|b|c}
  const spintaxRegex = /\{([^{}]+)\}/g;
  
  // Processar todos os padrões spintax
  let result = text;
  let match;
  
  // Resetar o índice da regex
  spintaxRegex.lastIndex = 0;
  
  // Continuar processando enquanto houver padrões spintax
  while ((match = spintaxRegex.exec(result)) !== null) {
    const fullMatch = match[0]; // {opção1|opção2}
    const content = match[1];    // opção1|opção2
    const choices = content.split('|');
    const randomIndex = Math.floor(Math.random() * choices.length);
    const selected = choices[randomIndex];
    
    // Substituir o padrão encontrado
    result = result.replace(fullMatch, selected);
    
    // Resetar o índice para processar desde o início novamente
    // (necessário caso haja spintax aninhados ou múltiplos)
    spintaxRegex.lastIndex = 0;
  }

  return result;
}
