# Arquitetura

Um repositório e um processo. Em produção, o NestJS escuta `PORT`, publica a API em `/api` e serve `frontend/dist` no mesmo domínio, com fallback de SPA para `index.html`. Em desenvolvimento, a API fica na porta 3000 e o Vite na 5173, com proxy de `/api` e CORS só para `http://localhost:5173`.

```text
frontend/     React, TypeScript, Vite, Tailwind
backend/      NestJS, MikroORM, regras de agenda
docs/         contrato HTTP e dúvidas de alinhamento
scripts/      sobe API e painel juntos
```

O banco é PostgreSQL. Localmente, `docker-compose.yml` sobe o Postgres 16 com usuário, senha e banco `personalytte`. Na Heroku, a conexão vem de `DATABASE_URL`. As migrações rodam na subida da API.

## Sessão

O cookie se chama `sessao`. É httpOnly, SameSite=Lax, vale 7 dias e só leva `Secure` em produção. O segredo é `SESSION_SECRET`. Cada requisição autenticada confere se o integrante segue ativo. Trocar a senha ou inativar o integrante aumenta a versão da sessão e invalida o cookie antigo.

O primeiro sócio administrador nasce na subida quando não existe usuário, a partir de `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD`. O seed de exemplo só roda com `NODE_ENV=development`.

## Módulos da API

| Caminho | Quem escreve |
| --- | --- |
| `/api/sessao` | quem entra e quem sai |
| `/api/integrantes` | administrador; a lista de responsáveis é leitura dos dois papéis |
| `/api/alunos` | administrador; professor só lê |
| `/api/aulas` | professor e administrador |
| `/api/eventos` | administrador; professor só lê |
| `/api/avisos` | administrador; professor só lê |
| `/api/dashboard` | professor e administrador |

O formato de cada corpo está em [docs/contrato-api.md](docs/contrato-api.md). Erros saem como `{ "codigo", "mensagem" }`, com a mensagem em português.

## Agenda

`backend/src/dominio/agenda.service.ts` gera o horizonte de 8 semanas, recusa sobreposição, aplica bloqueio de evento e recria as ocorrências ligadas ao plano. `pnpm horizonte` executa `backend/dist/horizonte.js` para o agendamento diário da Heroku.

O instante fica no banco com fuso. A comparação de “hoje”, “futura” e “já começou” usa America/Sao_Paulo.

## Deploy

O `Procfile` sobe `node backend/dist/main.js`. O build de produção compila o backend e gera `frontend/dist`. O endereço da primeira versão é o hostname padrão da Heroku.
