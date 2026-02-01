# 🚀 Deploy para Produção na Vercel

## Configuração Atual

A aplicação está configurada para usar **Vercel Serverless Functions** como proxy para a API IXCSoft, resolvendo problemas de CORS e mantendo o token seguro.

## Arquitetura

```
Browser → Vercel App (/api/ixc/*) → Serverless Function → IXCSoft API
```

**Vantagens:**
- ✅ Token IXC fica seguro no servidor (não exposto no frontend)
- ✅ Sem problemas de CORS
- ✅ Escalável automaticamente
- ✅ Fácil de manter

## Passos para Deploy

### 1. Configurar Variáveis de Ambiente na Vercel

Acesse o painel da Vercel: **Settings > Environment Variables**

Adicione as seguintes variáveis:

| Nome | Valor | Ambiente |
|------|-------|----------|
| `IXC_HOST` | `https://coopertecisp.com.br/webservice/v1` | Production |
| `IXC_TOKEN` | `29:ed30004f8207dbe08feb05005d67ea023793429a91210655cbf03fe12b1e4c94` | Production |
| `VITE_IXC_HOST` | `/api/ixc` | Production |

> [!IMPORTANT]
> **Não commite o token no Git!** Ele deve estar apenas nas variáveis de ambiente da Vercel.

### 2. Fazer Deploy

```bash
# Fazer commit das mudanças
git add .
git commit -m "feat: Adiciona serverless function para proxy IXC"

# Push para o repositório (Vercel faz deploy automático)
git push origin main
```

### 3. Verificar Deploy

1. Acesse o dashboard da Vercel
2. Aguarde o build completar
3. Acesse a URL de produção
4. Teste a página **Sistema IXC > Consulta de Clientes**

## Estrutura de Arquivos

```
├── api/
│   └── ixc.js                 # Serverless function (proxy)
├── src/
│   ├── services/ixc/
│   │   └── ixcService.ts      # Cliente da API
│   └── pages/
│       ├── IXCConsulta.tsx    # Página de consulta
│       ├── IXCFinanceiro.tsx  # Página financeira
│       └── IXCTickets.tsx     # Página de tickets
├── .env.local                 # Desenvolvimento (não commitado)
├── .env.production            # Template para produção
└── vercel.json                # Configuração da Vercel
```

## Desenvolvimento vs Produção

### Desenvolvimento (localhost)
- Usa proxy do Vite (`vite.config.ts`)
- Variáveis em `.env.local`
- Token pode ficar no frontend (ambiente local)

### Produção (Vercel)
- Usa Serverless Function (`/api/ixc.js`)
- Variáveis no painel da Vercel
- Token fica seguro no servidor

## Troubleshooting

### Erro: "Token IXC não configurado"
- Verifique se a variável `IXC_TOKEN` está configurada na Vercel
- Certifique-se de que está no ambiente correto (Production)

### Erro: CORS
- Verifique se o `vercel.json` está commitado
- Confirme que a rota `/api/ixc/*` está sendo redirecionada corretamente

### Erro: 500 Internal Server Error
- Verifique os logs da função no dashboard da Vercel
- Confirme que o `IXC_HOST` está correto

## Monitoramento

Acesse os logs em tempo real:
```bash
vercel logs [deployment-url]
```

Ou no dashboard: **Deployments > [seu deploy] > Functions > Logs**

## Próximos Passos

- [ ] Adicionar cache na serverless function
- [ ] Implementar rate limiting
- [ ] Adicionar logs de auditoria
- [ ] Configurar alertas de erro
- [ ] Otimizar bundle size

## Suporte

Para problemas relacionados ao deploy, verifique:
- [Documentação da Vercel](https://vercel.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
