# AGENTS

Leia nesta ordem antes de mudar comportamento:

1. [PRD.md](PRD.md) define o produto.
2. [DOMAIN.md](DOMAIN.md) resume as regras que o código precisa cumprir.
3. [docs/contrato-api.md](docs/contrato-api.md) define o HTTP.
4. [ARCHITECTURE.md](ARCHITECTURE.md) define pastas, sessão e deploy.

O PRD vence em regra de produto. O contrato vence no formato HTTP. Se os dois divergirem, pare e pergunte. Não invente módulo, campo, papel ou tela que esses arquivos não descrevem.

## Pastas

- `frontend/` é o painel. Não grave regra de negócio só no cliente.
- `backend/` é a API e o domínio. A agenda, o bloqueio e a sessão se decidem aqui.
- `docs/contrato-api.md` só muda quando os dois lados passam a precisar do mesmo formato. Não altere o contrato num lado só.

## Como trabalhar

- O compromisso se chama **aula**. Não introduza o tipo Treino nem as categorias Iniciante, Intermediário e Avançado.
- Textos de interface e mensagens de erro ficam em português.
- Datas de negócio usam America/Sao_Paulo.
- A sessão é o cookie `sessao`. Não guarde token no `localStorage`.
- Professor não grava aluno, equipe, evento nem aviso. Sócio entra como administrador.
- Fora desta versão: portal do aluno, financeiro, relatórios, mensagens, configurações, turmas e quadra.

## Verificação

```bash
pnpm --dir backend test
pnpm --dir frontend exec tsc --noEmit
```

Não faça commit de `.env`. O exemplo versionado é `.env.example`.
