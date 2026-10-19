# Personalytte

Painel web da equipe de uma escola de beach tennis. A primeira versão cobre login, dashboard, agenda, aulas, eventos, avisos, alunos e equipe.

O produto está descrito no [PRD](PRD.md). As regras de negócio estão em [DOMAIN.md](DOMAIN.md). A forma do sistema está em [ARCHITECTURE.md](ARCHITECTURE.md). Quem for alterar o código com um agente lê [AGENTS.md](AGENTS.md) antes.

## Stack

- `frontend/`: React, TypeScript, Vite e Tailwind
- `backend/`: NestJS, TypeScript, MikroORM e PostgreSQL
- Um processo na Heroku entrega a API em `/api` e o front buildado
- pnpm e Node 22

## Rodar localmente

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm dev
```

A API fica em `http://localhost:3000`. O painel fica em `http://localhost:5173` e encaminha `/api` para a API.

O primeiro administrador nasce das variáveis `BOOTSTRAP_ADMIN_*` quando o banco ainda não tem usuário. Em desenvolvimento, o seed cria a professora `marina@personalytte.local` com a senha `professor1`.

```bash
pnpm test
pnpm build
pnpm start
```

`pnpm horizonte` estende o plano semanal por mais um dia. Na Heroku, o Procfile sobe `node backend/dist/main.js`.
