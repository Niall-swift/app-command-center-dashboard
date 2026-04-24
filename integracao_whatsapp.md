# 🚀 Guia de Integração: WhatsApp + Dashboard AVL Telecom

Este documento explica como funciona a integração do WhatsApp (via Whapi.cloud) com o seu Painel de Controle, permitindo receber e responder mensagens em tempo real.

---

## 🏗️ 1. Arquitetura do Sistema

A integração funciona como uma "ponte" de três pilares:

1.  **Whapi.cloud**: Recebe a mensagem do celular do cliente e avisa o nosso servidor (via Webhook).
2.  **Firebase (Backend/Cloud Functions)**: Processa a mensagem, identifica o cliente no IXC e salva a conversa no banco de dados.
3.  **Dashboard (Frontend)**: Mostra a mensagem na tela para a equipe e permite enviar respostas.

---

## 📥 2. Como as Mensagens CHEGAM (Fluxo de Entrada)

Quando um cliente envia um "Oi" no WhatsApp:

1.  A **Whapi** envia os dados para o link: `https://us-central1-avl-telecom.cloudfunctions.net/whatsappWebhook`.
2.  A função `whatsappWebhook` entra em ação:
    *   **Identificação**: Ela limpa o número de telefone e busca no seu sistema **IXC** quem é o dono desse número.
    *   **Persistência**: Ela grava a mensagem na coleção `chat` do Firestore.
    *   **Inteligência**: Se o robô (IA) estiver ligado, ele responde automaticamente. Se não, a mensagem fica lá apenas para os humanos verem.
3.  O **Dashboard** percebe a mudança no banco de dados e atualiza a lista de chats instantaneamente com um ícone verde do WhatsApp.

---

## 📤 3. Como as Mensagens SÃO ENVIADAS (Fluxo de Saída)

Quando você digita uma resposta no painel:

1.  O Painel grava sua mensagem na subcoleção `mensagens` do cliente selecionado.
2.  A função `onDashboardMessageSent` detecta que você (Admin) escreveu algo.
3.  Ela chama a API da Whapi enviando o seu texto para o celular do cliente.

---

## 🛠️ 4. Comandos de Controle (Admin)

Você pode controlar o comportamento do robô diretamente pelo WhatsApp enviando estes comandos:

*   `#bot:off` ou `#robo:desligar`: Desativa as respostas automáticas da IA (útil para atendimento 100% humano).
*   `#bot:on` ou `#robo:ligar`: Reativa a inteligência artificial.
*   `#debug`: O sistema responde com o seu ID do IXC e informações técnicas (útil para testes).

---

## 🔐 5. Segurança e Permissões (IAM)

Para que tudo isso funcione, as contas de serviço do Google Cloud precisam de "poderes" específicos:

*   **Administrador do Firebase**: Permite gerenciar o banco de dados.
*   **Proprietário do Cloud Datastore**: Permite ler e escrever dados no Firestore.
*   **Cloud Build Service Agent**: Permite que o código seja atualizado (deploy).

---

## 🖥️ 6. Melhorias Visuais no Painel

Implementamos várias mudanças visuais para facilitar a identificação:

*   **Badge WhatsApp**: Clientes vindos do WhatsApp aparecem com um selo verde na lista.
*   **Identificador de Origem**: Cada mensagem no histórico mostra se veio do "WhatsApp" ou do "App".
*   **Botão de Diagnóstico**: Adicionamos um botão temporário para você testar se a conexão com o banco de dados está ativa.

---

## 🆘 Solução de Problemas Comuns

| Problema | Causa Provável | Solução |
| :--- | :--- | :--- |
| Mensagem não aparece no painel | Webhook da Whapi desconfigurado | Verifique a URL no painel da Whapi.cloud |
| Erro `PERMISSION_DENIED` | Falta de função IAM no Google Cloud | Adicione "Cloud Datastore Owner" à conta de serviço |
| Resposta não chega no celular | API Key da Whapi inválida ou expirada | Verifique o arquivo `.env` nas Functions |

---

** AVL Telecom - Tecnologia em Conectividade **
