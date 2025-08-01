# Sistema de Notificações

## Visão Geral

O sistema de notificações implementado permite que os usuários recebam alertas sonoros e visuais quando novas mensagens chegam no chat, mesmo quando a página está em segundo plano.

## Funcionalidades

### 🎵 Som de Notificação

- **Som Profissional**: Utiliza Web Audio API para gerar um som de notificação de 3 tons (800Hz, 1000Hz, 1200Hz)
- **Reprodução Inteligente**: O som é reproduzido apenas quando necessário
- **Controle de Volume**: Volume otimizado para não ser intrusivo

### 🔔 Notificações do Navegador

- **Notificações Nativas**: Utiliza a API de Notificações Web do navegador
- **Detecção de Visibilidade**: Notificações aparecem apenas quando a página não está visível
- **Auto-fechamento**: Notificações fecham automaticamente após 5 segundos
- **Clique para Focar**: Clicar na notificação traz a página para o primeiro plano

### ⚙️ Configurações Avançadas

- **Controle Total**: Ativar/desativar notificações a qualquer momento
- **Status em Tempo Real**: Mostra o status das permissões e suporte do navegador
- **Teste de Notificação**: Botão para testar o sistema
- **Indicador Visual**: Mostra quando a página está em segundo plano

## Como Funciona

### 1. Detecção de Novas Mensagens

```typescript
// Verifica se há novas mensagens não do admin
const newMessages = messages.filter(
  (msg) =>
    !msg.isAdmin && !currentMessages.some((existing) => existing.id === msg.id)
);
```

### 2. Reprodução de Som

```typescript
// Usa Web Audio API para gerar som profissional
const frequencies = [800, 1000, 1200];
frequencies.forEach((freq, index) => {
  const osc = audioContext.createOscillator();
  // Configuração do som...
});
```

### 3. Notificações do Navegador

```typescript
// Mostra notificação apenas se a página não estiver visível
if (!isPageVisible) {
  showChatNotification(clientName, message);
}
```

## Configuração

### Permissões

1. O navegador solicita permissão para notificações automaticamente
2. O usuário pode conceder ou negar permissão
3. Se negado, o sistema ainda funciona com som, mas sem notificações visuais

### Controles

- **Botão de Sino**: Ativar/desativar notificações
- **Botão de Configurações**: Abrir painel de configurações avançadas
- **Botão de Teste**: Testar o sistema de notificações
- **Indicador Laranja**: Mostra quando a página está em segundo plano

## Compatibilidade

### Navegadores Suportados

- ✅ Chrome/Chromium (versão 22+)
- ✅ Firefox (versão 22+)
- ✅ Safari (versão 7+)
- ✅ Edge (versão 17+)

### Funcionalidades por Navegador

| Navegador | Som | Notificações | Permissões |
| --------- | --- | ------------ | ---------- |
| Chrome    | ✅  | ✅           | ✅         |
| Firefox   | ✅  | ✅           | ✅         |
| Safari    | ✅  | ✅           | ✅         |
| Edge      | ✅  | ✅           | ✅         |

## Troubleshooting

### Problemas Comuns

#### 1. Notificações não aparecem

- Verifique se as permissões foram concedidas
- Clique em "Solicitar Permissão" nas configurações
- Verifique se o navegador suporta notificações

#### 2. Som não toca

- Verifique se o som do sistema está ativado
- Teste o som usando o botão "Testar Som"
- Verifique se as notificações estão ativadas

#### 3. Notificações aparecem mesmo com a página visível

- Isso é normal para testes
- Em produção, as notificações só aparecem quando a página está em segundo plano

### Debug

```typescript
// Logs úteis para debug
console.log("Status da página:", isPageVisible);
console.log("Notificações ativadas:", isEnabled);
console.log("Permissão:", permission);
console.log("Suporte do navegador:", isSupported);
```

## Personalização

### Alterar Som de Notificação

```typescript
// Em use-notifications.ts
const frequencies = [800, 1000, 1200]; // Frequências em Hz
const duration = 0.15; // Duração de cada tom
```

### Alterar Duração das Notificações

```typescript
// Auto-fechar após X segundos
setTimeout(() => {
  notification.close();
}, 5000); // 5 segundos
```

### Alterar Texto das Notificações

```typescript
// Em showChatNotification
title: `Nova mensagem de ${clientName}`,
body: message.length > 100 ? message.substring(0, 100) + '...' : message,
```

## Segurança

- As notificações só funcionam em contextos seguros (HTTPS)
- Permissões são solicitadas explicitamente
- Dados sensíveis não são incluídos nas notificações
- O sistema respeita as configurações de privacidade do usuário

## Performance

- AudioContext é reutilizado para evitar overhead
- Notificações são limitadas para evitar spam
- Detecção de visibilidade é otimizada
- Som é gerado sob demanda

## Futuras Melhorias

- [ ] Notificações push para dispositivos móveis
- [ ] Sons personalizáveis pelo usuário
- [ ] Configurações de volume individual
- [ ] Notificações com ações (responder, arquivar)
- [ ] Integração com notificações do sistema operacional
