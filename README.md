# Nexauren Tools

Aplicação Cloudflare Worker + D1 para o sistema de ferramentas do Nexauren.

## Funcionalidades
- Home
- Registro e login
- Sessão por cookie
- Minha conta
- Dashboard de administrador
- Criação de ferramentas sem alterar código
- HTML e JavaScript próprios por ferramenta
- Publicação automática no catálogo
- 5 categorias iniciais: Data, Texto, Áudio, Imagem e Produtividade
- Cloudflare D1 `nexauren-db`

## Rotas
- `/`
- `/register`
- `/login`
- `/account`
- `/dashboard`
- `/dashboard/tools/new`
- `/tools`
- `/tool/:slug`

## Primeiro acesso
A primeira conta registrada recebe o papel `admin`. Depois disso, novas contas recebem `user`.

## Deploy
O workflow de GitHub Actions aplica a migration D1 e publica o Worker automaticamente. Configure os secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` no repositório.

O domínio configurado é `nexaurenstory.com`.
