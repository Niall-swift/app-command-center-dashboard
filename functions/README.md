# Firebase Cloud Functions - Mensagens de Boas-Vindas

Esta pasta contém a Cloud Function que envia automaticamente mensagens de boas-vindas via WhatsApp quando um cliente se cadastra no sorteio Pre-Mix.

## 📁 Estrutura

```
functions/
├── src/
│   ├── index.ts              # Função principal
│   ├── types.ts              # Tipos TypeScript
│   ├── messageTemplates.ts   # Templates de mensagens
│   └── whapiService.ts       # Serviço WhatsApp
├── package.json              # Dependências
├── tsconfig.json             # Config TypeScript
└── .env.example              # Exemplo de variáveis
```

## 🚀 Como Funciona

1. **Cliente se cadastra** no app mobile
2. **Documento é criado** na coleção `usuariosDoPreMix`
3. **Cloud Function dispara** automaticamente
4. **Mensagem é enviada** via WhatsApp
5. **Documento é atualizado** com status de envio
6. **Log é criado** em `welcome_message_logs`

## 📦 Instalação

Veja o guia completo em: `DEPLOY_GUIDE.md`

### Resumo Rápido

```bash
# 1. Instalar dependências
npm install

# 2. Configurar API Key
firebase functions:config:set whapi.api_key="SUA_KEY"

# 3. Build
npm run build

# 4. Deploy
firebase deploy --only functions
```

## 🔧 Desenvolvimento

```bash
# Compilar TypeScript
npm run build

# Compilar em modo watch
npm run build:watch

# Testar localmente
npm run serve

# Ver logs
npm run logs
```

## 📝 Variáveis de Ambiente

Configure usando Firebase CLI:

```bash
firebase functions:config:set whapi.api_key="YOUR_KEY"
firebase functions:config:set whapi.base_url="https://gate.whapi.cloud"
```

## 🧪 Testando

1. Adicione um documento em `usuariosDoPreMix` no Firestore
2. A função será disparada automaticamente
3. Verifique os logs: `npm run logs`
4. Verifique o documento atualizado no Firestore

## 📊 Monitoramento

- **Logs:** `firebase functions:log`
- **Console:** https://console.firebase.google.com/
- **Métricas:** Functions > onNewRaffleRegistration

## 🐛 Troubleshooting

Veja o guia completo em: `DEPLOY_GUIDE.md`

## 📚 Documentação

- [Firebase Functions](https://firebase.google.com/docs/functions)
- [Whapi.Cloud](https://whapi.cloud/docs)
