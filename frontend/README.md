# Nexauren frontend

A pasta `frontend/tools` contém as ferramentas estáticas publicadas pelo Nexauren.

Cada ferramenta deve ter sua própria pasta:

`frontend/tools/<categoria>/<slug>/`

E três arquivos próprios:

- `index.html`
- `script.js`
- `style.css`

O D1 registra o catálogo, categoria, caminho e estado de publicação. O Worker usa o D1 para descobrir a ferramenta e o binding `ASSETS` para servir os arquivos estáticos.
