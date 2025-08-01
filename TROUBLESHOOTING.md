# Guia de Troubleshooting - Sistema de Notificações

## 🔍 Problemas Identificados e Soluções

### 1. Notificações não funcionam

#### Sintomas:

- Som não toca quando chegam novas mensagens
- Notificações do navegador não aparecem
- Botão "Testar Som" não funciona

#### Soluções:

**A. Verificar Permissões do Navegador:**

1. Clique no ícone de configurações (⚙️) no chat
2. Verifique se "Suporte do Navegador" está verde
3. Se "Permissão" estiver amarelo, clique em "Solicitar Permissão"
4. Aceite a permissão quando o navegador solicitar

**B. Verificar Configurações do Sistema:**

1. Verifique se o som do sistema está ativado
2. Verifique se o navegador não está em modo silencioso
3. Teste o som usando o botão "Testar Som"

**C. Usar o Painel de Debug:**

1. Clique no ícone de debug (🐛) no chat
2. Verifique o status de todos os componentes
3. Use os botões de teste para verificar cada funcionalidade

### 2. Mensagens demoram para aparecer

#### Sintomas:

- Novas mensagens não aparecem em tempo real
- Precisa recarregar a página para ver mensagens
- Delay entre envio e recebimento

#### Soluções:

**A. Verificar Conexão com Firebase:**

1. Abra o Console do Navegador (F12)
2. Verifique se há erros de conexão
3. Verifique se as regras do Firestore permitem leitura/escrita

**B. Forçar Atualização:**

1. Clique no botão de atualização (🔄) no chat
2. Isso força o re-render das mensagens
3. Se ainda não funcionar, recarregue a página

**C. Verificar Listener do Firebase:**

1. No console, procure por logs como:
   - "Snapshot recebido"
   - "Mensagens processadas"
   - "Nova(s) mensagem(ns) recebida(s)"

### 3. Som não toca

#### Sintomas:

- Notificações visuais funcionam, mas sem som
- Botão "Testar Som" não produz som
- Som funciona em alguns navegadores mas não em outros

#### Soluções:

**A. Verificar AudioContext:**

1. Abra o Console do Navegador (F12)
2. Procure por mensagens como:
   - "Som de notificação reproduzido com sucesso"
   - "AudioContext não está disponível"
   - "Erro ao reproduzir som de notificação"

**B. Interação do Usuário:**

1. O navegador pode bloquear áudio sem interação
2. Clique em qualquer lugar da página
3. Tente o botão "Testar Som" novamente

**C. Configurações do Navegador:**

1. Verifique se o site não está em modo silencioso
2. Verifique as configurações de som do navegador
3. Tente em outro navegador (Chrome, Firefox, Edge)

### 4. Notificações do navegador não aparecem

#### Sintomas:

- Som funciona, mas notificações visuais não aparecem
- Notificações aparecem mesmo com a página visível
- Notificações não aparecem quando a página está em segundo plano

#### Soluções:

**A. Verificar Permissões:**

1. Clique no ícone de configurações (⚙️)
2. Verifique se "Permissão" está verde (Permitido)
3. Se estiver vermelho (Negado), você precisa:
   - Ir nas configurações do navegador
   - Permitir notificações para este site
   - Ou usar outro navegador

**B. Verificar Visibilidade da Página:**

1. O indicador laranja mostra quando a página está em segundo plano
2. Notificações só aparecem quando a página não está visível
3. Para testar, minimize a janela ou mude de aba

### 5. Debug e Logs

#### Como usar o Painel de Debug:

1. **Acessar o Painel:**

   - Clique no ícone de debug (🐛) no chat
   - O painel mostra o status de todos os componentes

2. **Verificar Status:**

   - **Notificações:** Verde = Ativadas, Vermelho = Desativadas
   - **Suporte do Navegador:** Verde = Suportado, Vermelho = Não suportado
   - **Permissão:** Verde = Permitido, Amarelo = Não definido, Vermelho = Negado
   - **Visibilidade da Página:** Ícone de olho mostra o status

3. **Testar Funcionalidades:**

   - **Testar Som:** Verifica se o áudio funciona
   - **Testar Notificação:** Verifica se as notificações do navegador funcionam

4. **Ver Logs:**
   - Os logs mostram as últimas ações do sistema
   - Útil para identificar quando algo não funciona

### 6. Comandos de Debug no Console

```javascript
// Verificar status das notificações
console.log("Status das notificações:", {
  isEnabled: true / false,
  isSupported: true / false,
  permission: "granted" / "denied" / "default",
  isPageVisible: true / false,
});

// Forçar teste de som
playNotificationSound();

// Verificar mensagens atuais
console.log("Mensagens do cliente:", clientMessages);

// Verificar cliente selecionado
console.log("Cliente selecionado:", selectedClient);
```

### 7. Problemas Comuns por Navegador

#### Chrome:

- ✅ Melhor suporte para notificações
- ✅ AudioContext funciona bem
- ⚠️ Pode bloquear áudio sem interação

#### Firefox:

- ✅ Bom suporte para notificações
- ⚠️ AudioContext pode ter problemas
- ⚠️ Pode precisar de permissões explícitas

#### Safari:

- ⚠️ Suporte limitado para notificações
- ⚠️ AudioContext pode não funcionar
- ✅ Melhor em dispositivos Apple

#### Edge:

- ✅ Baseado em Chromium, funciona bem
- ✅ Suporte similar ao Chrome
- ⚠️ Pode ter problemas em versões antigas

### 8. Soluções Rápidas

#### Se nada funcionar:

1. **Recarregar a página** (Ctrl+F5)
2. **Limpar cache do navegador**
3. **Tentar em modo incógnito**
4. **Verificar se o Firebase está funcionando**
5. **Verificar conexão com a internet**

#### Para testar rapidamente:

1. Clique no ícone de debug (🐛)
2. Use "Testar Som" e "Testar Notificação"
3. Verifique se todos os status estão verdes
4. Se algum estiver vermelho, siga as instruções acima

### 9. Logs Úteis para Identificar Problemas

Procure por estas mensagens no console:

```javascript
// Logs de sucesso
"Som de notificação reproduzido com sucesso";
"Notificação do navegador exibida: [título]";
"Snapshot recebido";
"Mensagens processadas";

// Logs de erro
"Erro ao reproduzir som de notificação";
"Erro ao mostrar notificação";
"AudioContext não está disponível";
"Notificações não são suportadas neste navegador";
```

### 10. Contato e Suporte

Se os problemas persistirem:

1. **Verifique o console** para erros específicos
2. **Use o painel de debug** para identificar o problema
3. **Teste em diferentes navegadores**
4. **Verifique as configurações do Firebase**

---

**Dica:** O painel de debug é sua melhor ferramenta para identificar problemas. Use-o sempre que algo não estiver funcionando como esperado!
