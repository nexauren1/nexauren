# Nexauren Tools

Aplicação Cloudflare Worker + D1 para o sistema de ferramentas do Nexauren.

## Funcionalidades
- Home e catálogo de ferramentas
- Registro e login
- Sessão por cookie
- Minha conta
- Dashboard de administrador
- Registro de ferramentas pelo Dashboard
- 7 categorias: Audio, Image, PDF, Text, Productivity, Business e Marketplace
- Cada ferramenta pode ter uma pasta própria com `index.html`, `script.js` e `style.css`
- D1 controla o catálogo, categoria, caminho e publicação
- Cloudflare Static Assets serve os arquivos das ferramentas
- Cloudflare D1 `nexauren-db`

## Estrutura

```text
frontend/
├── data/
│   ├── categories.js
│   └── tools.js
├── pages/
├── categories/
└── tools/
    ├── audio/
    ├── image/
    ├── pdf/
    ├── text/
    ├── productivity/
    ├── business/
    └── marketplace/
```

Cada ferramenta fica em:

`frontend/tools/<categoria>/<slug>/`

com:

- `index.html`
- `script.js`
- `style.css`

## Rotas
- `/`
- `/register`
- `/login`
- `/account`
- `/dashboard`
- `/dashboard/tools/new`
- `/tools`
- `/tools?category=audio`
- `/tool/:slug`

## Primeiro acesso
A primeira conta registrada recebe o papel `admin`. Depois disso, novas contas recebem `user`.

## Deploy
O repositório está conectado ao Cloudflare. O deploy é feito automaticamente pelo Cloudflare quando alterações são enviadas para a branch `main`.

O domínio configurado é `nexaurenstory.com`.
