# Contrato da API — Personalytte v1

Este arquivo é o alinhamento técnico entre backend e frontend. O `PRD.md` vence em regra de produto. Este contrato vence no formato HTTP. Nenhum dos dois lados altera este arquivo sozinho. Dúvida de produto vai para `docs/duvidas-backend.md` ou `docs/duvidas-frontend.md`, e a implementação daquele ponto para.

## Stack alinhada

- pnpm
- Node 22
- Backend: NestJS, TypeScript, MikroORM, PostgreSQL
- Frontend: React, TypeScript, Vite, Tailwind, React Router
- API em `/api`
- Cookie de sessão: nome `sessao`, httpOnly, SameSite=Lax, Secure só em produção, Max-Age de 7 dias
- Segredo: `SESSION_SECRET`
- Datas de negócio em America/Sao_Paulo. JSON de instante em ISO-8601 com offset. Data de calendário em `YYYY-MM-DD`. Horário de plano em `HH:mm`.

## Erro

Status HTTP adequado (`400`, `401`, `403`, `404`, `409`). Corpo:

```json
{ "codigo": "HORARIO_OCUPADO", "mensagem": "Texto em português." }
```

Códigos: `DADOS_INVALIDOS`, `CREDENCIAIS_INVALIDAS`, `SEM_PERMISSAO`, `NAO_ENCONTRADO`, `HORARIO_OCUPADO`, `BLOQUEIO_AGENDA`, `AULA_JA_INICIOU`, `PLANO_INCOMPLETO`, `ULTIMO_ADMINISTRADOR`, `INTEGRANTE_COM_AGENDA`.

## Sessão

`POST /api/sessao` com `{ "email", "senha" }`. Sucesso `200` e cookie. Corpo: integrante atual.

`POST /api/sessao/encerrar` limpa o cookie.

`GET /api/sessao/atual` devolve o integrante atual ou `401`.

Integrante atual:

```json
{
  "id": "uuid",
  "nome": "string",
  "email": "string",
  "funcao": "PROFESSOR",
  "papel": "professor",
  "ativo": true
}
```

`funcao`: `PROFESSOR`, `SOCIO` ou `OUTROS`. `papel`: `professor` ou `administrador`. `OUTROS` entra como `professor`.

## Integrantes

Lista e escrita: só administrador.

`GET /api/integrantes?busca=` lista só ativos. Busca em nome, e-mail e telefone.

`GET /api/integrantes/responsaveis` autenticado. Lista ativos com `id`, `nome`, `funcao`. Serve os seletores de responsável. Professor e administrador. No novo agendamento e no cadastro do aluno, o painel mostra só `funcao` `PROFESSOR` e chama o campo de Professor.

`POST /api/integrantes` cria a conta. Campos: `nome`, `email`, `senha` (mínimo 8), `funcao`, `telefone` opcional, `dataNascimento` opcional (`YYYY-MM-DD`).

`PATCH /api/integrantes/:id` edita nome, e-mail, telefone, data de nascimento, função e senha. Senha omitida permanece. Trocar a senha encerra as sessões daquele integrante.

`POST /api/integrantes/:id/inativar` inativa e encerra a sessão. Recusa com `INTEGRANTE_COM_AGENDA` ou `ULTIMO_ADMINISTRADOR`.

Leitura do PRD: inativo some da lista operacional. O nome continua nas aulas já gravadas.

Resposta de integrante: `id`, `nome`, `email`, `telefone`, `funcao`, `papel`, `ativo`, `dataNascimento`, `cadastradoEm`.

## Alunos

Leitura: professor e administrador. Escrita: administrador.

`GET /api/alunos?busca=` só ativos. Busca em nome, e-mail, telefone e Instagram.

`GET /api/alunos/:id`

`POST /api/alunos` e `PATCH /api/alunos/:id` com:

```json
{
  "nome": "string",
  "telefone": "11999990000",
  "email": null,
  "instagram": "anacosta",
  "dataNascimento": "1992-03-15",
  "plano": "PARTICULAR",
  "categoria": "D",
  "horarios": [
    { "dia": "seg", "horarioInicio": "19:00" },
    { "dia": "qui", "horarioInicio": "09:00" }
  ],
  "responsavelId": "uuid"
}
```

`plano`: `PARTICULAR`, `GYMPASS`, `TOTALPASS`, `MENSAL`. `categoria`: `D`, `C`, `B`, `A`. `dia`: `seg`, `ter`, `qua`, `qui`, `sex`, `sab`, `dom`.

`horarios` lista cada aula da semana com o próprio horário. O mesmo dia pode repetir com horários que não se cruzam. Dia e horário iguais são recusados. `horarios` e `responsavelId` vão os dois vazios ou os dois preenchidos. Vazio é `horarios: []` e `responsavelId: null`. Caso contrário, `PLANO_INCOMPLETO`. Telefone com 10 ou 11 dígitos; a API guarda só os dígitos. `instagram` é opcional: o usuário do perfil, até 30 caracteres, sem `@` e sem o endereço. A API tira um `@` inicial. `dataNascimento` é opcional, no formato `YYYY-MM-DD`. Vazio grava `null`.

`POST /api/alunos/:id/inativar` remove as aulas futuras daquele aluno que estejam Aguardando. O restante do histórico fica.

Aluno na resposta inclui `id`, os campos acima, `ativo` e `cadastradoEm`.

## Aulas

Leitura e escrita de aula: professor e administrador.

`GET /api/aulas?de=YYYY-MM-DD&ate=YYYY-MM-DD` inclui aulas cujo início cai nesse intervalo, em Brasília, inclusive as canceladas.

`GET /api/aulas/:id`

`POST /api/aulas` cria avulsa, status Aguardando, fora do plano:

```json
{
  "alunoId": "uuid",
  "responsavelId": "uuid",
  "inicio": "2026-10-20T19:00:00-03:00",
  "experimental": false
}
```

Data de `inicio` anterior a hoje, em Brasília, responde `DADOS_INVALIDOS`. Hoje é aceito. Com `experimental: true` e sem `alunoId`, o corpo pode trazer `alunoTemporario: { "nome": "string", "telefone": "string ou null" }`. Isso grava um aluno temporário, fora de `GET /api/alunos` e da contagem do dashboard. Sem experimental, `alunoId` de um aluno efetivo é obrigatório.

`PATCH /api/aulas/:id` aceita `alunoId`, `responsavelId`, `inicio`, `status`, `experimental` e, no aluno temporário, `telefone`. Mudar aluno, responsável ou início solta a ocorrência do plano. Mudar status mantém o vínculo. Se a aula já começou, mudar `inicio` responde `AULA_JA_INICIOU`.

Ao enviar `status: "FALTA"`, o corpo pode incluir `reposicao`. Sem `reposicao`, só a falta é gravada. Com `reposicao`, nasce outra aula Aguardando, fora do plano, apontando para a origem:

```json
{ "status": "FALTA", "reposicao": { "responsavelId": "uuid", "inicio": "2026-10-22T19:00:00-03:00" } }
```

`POST /api/aulas/:id/cancelar` grava Cancelada.

Criar, editar, obter e cancelar devolvem a aula, inclusive o `id`.

Conflito de horário ou bloqueio: `409` com `HORARIO_OCUPADO` ou `BLOQUEIO_AGENDA`.

Aula na resposta:

```json
{
  "id": "uuid",
  "aluno": { "id": "uuid", "nome": "string", "categoria": "D", "telefone": "11999990000", "temporario": false },
  "responsavel": { "id": "uuid", "nome": "string" },
  "inicio": "2026-10-20T19:00:00-03:00",
  "fim": "2026-10-20T20:00:00-03:00",
  "status": "AGUARDANDO",
  "experimental": false,
  "reposicaoDeAulaId": null,
  "ligadaAoPlano": true
}
```

`status`: `AGUARDANDO`, `CONFIRMADA`, `FALTA`, `CANCELADA`.

## Eventos

Leitura: professor e administrador. Escrita: administrador. Professor recebe `403` em POST, PATCH e DELETE.

`GET /api/eventos?de=YYYY-MM-DD&ate=YYYY-MM-DD` eventos que cruzam o intervalo.

`GET /api/eventos/:id` devolve um evento. Professor e administrador podem ler.

`POST /api/eventos` e `PATCH /api/eventos/:id`:

```json
{
  "tipo": "FERIADO",
  "nome": "string",
  "inicio": "2026-10-12T00:00:00-03:00",
  "fim": "2026-10-13T00:00:00-03:00",
  "contato": null,
  "bloqueiaAulas": true,
  "responsavelId": null
}
```

`tipo`: `FERIADO`, `AGENDA_FECHADA`, `AUSENCIA`, `ANIVERSARIO`, `TORNEIO`. Todo evento recusa aula nova que cruze o intervalo (`BLOQUEIO_AGENDA`). Aula não cancelada recusa o evento (`HORARIO_OCUPADO`). Aula já existente não muda de status. `inicio` anterior a hoje responde `DADOS_INVALIDOS`. `AUSENCIA` exige `responsavelId`. `bloqueiaAulas` permanece no corpo por compatibilidade e não altera essa regra.

`DELETE /api/eventos/:id` apaga o evento e libera o horário para um agendamento novo.

Cada evento na lista traz `id`, `tipo`, `nome`, `inicio`, `fim`, `contato`, `bloqueiaAulas` e `responsavelId`.

## Avisos

`GET /api/avisos` professor e administrador, do mais recente ao mais antigo.

`POST /api/avisos`, `PATCH /api/avisos/:id`, `DELETE /api/avisos/:id`: só administrador. Corpo: `{ "titulo", "mensagem" }`.

Cada aviso traz `id`, `titulo`, `mensagem` e `criadoEm`.

## Dashboard

`GET /api/dashboard` autenticado.

```json
{
  "aulasHoje": 0,
  "confirmadas": 0,
  "alunosCadastrados": 0,
  "alunosDoDia": 0,
  "proximoHorario": null,
  "eventosDaSemana": [],
  "avisos": []
}
```

`proximoHorario` é uma aula no formato acima, ou `null`.

## Check-ins

`GET /api/checkins?data=YYYY-MM-DD` autenticado, professor e administrador. Sem `data`, o dia é hoje em America/Sao_Paulo. Data inválida responde `400` `DADOS_INVALIDOS`.

```json
{
  "itens": [
    {
      "id": "uuid",
      "provedor": "GYMPASS",
      "nome": "Ana Lima",
      "email": "ana@exemplo.com",
      "telefone": "11911110001",
      "iniciadoEm": "2026-10-21T10:00:00-03:00",
      "alunoId": "uuid"
    }
  ],
  "gympass": true,
  "totalpass": false
}
```

`provedor`: `GYMPASS` ou `TOTALPASS`. `alunoId` é `null` quando o e-mail e o telefone não apontam um único aluno ativo. `gympass` e `totalpass` dizem se as chaves daquele provedor estão no ambiente. A lista vem do mais recente ao mais antigo e junta os dois.

`POST /api/webhooks/gympass` e `POST /api/webhooks/totalpass` são públicos. O Gympass exige o cabeçalho `X-Gympass-Signature`. A TotalPass exige `token` na query, igual ao cadastrado em `TOTALPASS_WEBHOOK_TOKEN`. Assinatura ou token inválido responde `401` `CREDENCIAIS_INVALIDAS`. O corpo gravado não inclui CPF. Estes endpoints não confirmam a visita no provedor.

## Desenvolvimento

- Postgres local via `docker-compose.yml` na raiz, banco `personalytte`, usuário e senha `personalytte`.
- Backend em `http://localhost:3000`. Vite em `http://localhost:5173`, com proxy de `/api` para o backend e `credentials` incluído.
- Produção: NestJS serve `frontend/dist` e o fallback do SPA fora de `/api`.
- `pnpm dev` na raiz sobe os dois. Seed de exemplo só quando `NODE_ENV=development`. Produção não executa o seed. O bootstrap do primeiro sócio roda em todo ambiente se não houver usuário.
