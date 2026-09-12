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
O repositório está conectado ao Cloudflare. O deploy do Worker é feito automaticamente pelo Cloudflare quando alterações são enviadas para a branch `main`.

A migration inicial do D1 está em `migrations/0001_initial.sql`. Como o banco começa sem tabelas, ela precisa ser executada uma vez no banco remoto `nexauren-db` antes do primeiro uso da aplicação.

O domínio configurado é `nexaurenstory.com`.
