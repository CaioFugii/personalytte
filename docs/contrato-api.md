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

`GET /api/integrantes/responsaveis` autenticado. Lista ativos com `id`, `nome`, `funcao`. Serve os seletores de responsável. Professor e administrador. No novo agendamento, o painel chama o campo de Professor e mostra `PROFESSOR` e `SOCIO`. A aula entra num grupo que já tem vaga. A ficha do aluno não envia `horarios`.

`POST /api/integrantes` cria a conta. Campos: `nome`, `email`, `senha` (mínimo 8), `funcao`, `telefone` opcional, `dataNascimento` opcional (`YYYY-MM-DD`).

`PATCH /api/integrantes/:id` edita nome, e-mail, telefone, data de nascimento, função e senha. Senha omitida permanece. Trocar a senha encerra as sessões daquele integrante.

`POST /api/integrantes/:id/inativar` inativa e encerra a sessão. Recusa com `INTEGRANTE_COM_AGENDA` ou `ULTIMO_ADMINISTRADOR`.

Leitura do PRD: inativo some da lista operacional. O nome continua nas aulas já gravadas.

Resposta de integrante: `id`, `nome`, `email`, `telefone`, `funcao`, `papel`, `ativo`, `dataNascimento`, `cadastradoEm`.

## Alunos

Leitura: professor e administrador. Escrita: administrador.

`GET /api/alunos?busca=` só ativos, sem temporários. Busca em nome, e-mail, telefone e Instagram.

`GET /api/alunos?busca=&incluirInativos=1` inclui inativos na mesma lista, sem temporários. Ativos vêm primeiro. O novo agendamento e o detalhe da aula usam a lista sem esse parâmetro.

`GET /api/alunos/:id` devolve o cadastro permanente, ativo ou inativo.

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
  "genero": "FEMININO",
  "horarios": [
    { "dia": "ter", "horarioInicio": "19:00", "responsavelId": "uuid" },
    { "dia": "qui", "horarioInicio": "19:00", "responsavelId": "uuid" }
  ]
}
```

`plano`: `PARTICULAR`, `GYMPASS`, `TOTALPASS`, `MENSAL`. `categoria`: `INICIANTE`, `D`, `C`, `B`, `A`. `genero`: `FEMININO` ou `MASCULINO`, obrigatório no cadastro permanente. `dia`: `seg`, `ter`, `qua`, `qui`, `sex`, `sab`, `dom`.

`horarios` lista cada aula da semana com o próprio horário e o próprio professor. O mesmo dia pode repetir com horários que não se cruzam. Dia e horário iguais são recusados. Cada item traz `dia`, `horarioInicio` e `responsavelId`. Professores diferentes na mesma lista são aceitos. Linha sem professor responde `PLANO_INCOMPLETO`. Vazio é `horarios: []`. Telefone com 10 ou 11 dígitos; a API guarda só os dígitos. `instagram` é opcional: o usuário do perfil, até 30 caracteres, sem `@` e sem o endereço. A API tira um `@` inicial. `dataNascimento` é opcional, no formato `YYYY-MM-DD`. Vazio grava `null`.

`POST /api/alunos/:id/inativar` remove as aulas futuras daquele aluno que estejam Aguardando. O restante do histórico fica.

`POST /api/alunos/:id/reativar` torna o aluno ativo de novo e não recria as aulas que saíram na inativação. O plano semanal permanece no cadastro. O horizonte não gera ocorrência dele enquanto o plano não for alterado. Alterar o plano gera as ocorrências futuras a partir dessa alteração. Aluno já ativo responde `400` com `DADOS_INVALIDOS`. Aluno inexistente responde `404`.

Aluno na resposta inclui `id`, os campos acima, `ativo`, `cadastradoEm` e `reposicoesDisponiveis`. `genero` pode vir `null` num cadastro antigo, até a edição gravar `FEMININO` ou `MASCULINO`. Aluno temporário fica com `genero` `null`. `reposicoesDisponiveis` conta aulas com `justificativaReposicao` gravada que ainda não têm aula de reposição em aberto. Marcar falta, sozinha, não entra nessa conta.

## Grupos

Leitura e escrita de grupo: professor e administrador. O grupo é a sessão. A aula é a participação de um aluno.

`GET /api/grupos` devolve todas as sessões, da mais antiga à mais recente. `GET /api/grupos?de=YYYY-MM-DD&ate=YYYY-MM-DD` limita às sessões cujo início cai nesse intervalo, em Brasília. Cada uma traz professor, início, fim, capacidade e as aulas aninhadas. A agenda da semana, do dia e de vagas lê o intervalo.

`GET /api/grupos/semana` devolve os grupos fixos, de segunda a sábado, sem data. Cada item junta os alunos ativos cujo plano semanal tem aquele dia, horário e professor. Domingo não entra. A capacidade é a da próxima sessão daquele horário, ou 4 se ela ainda não existe.

`POST /api/grupos/semana` cria um grupo fixo. O corpo traz `dia`, `horarioInicio`, `responsavelId` e `alunoIds`, com de 1 aluno até o limite. `capacidade` é opcional e só aceita 4, 5 ou 6; sem ela, o limite é 4. O horário entra no plano de cada aluno e as próximas aulas Aguardando são geradas. Horário que já tem esse professor responde `DADOS_INVALIDOS`. Domingo, horário inválido, aluno repetido ou acima do limite também. Professor ocupado ou aluno em outro horário que cruze responde `HORARIO_OCUPADO`. A resposta é a lista atualizada de `GET /api/grupos/semana`.

`POST /api/grupos/semana/alunos` inclui o aluno no grupo fixo. O corpo traz `dia`, `horarioInicio`, `responsavelId` e `alunoId`. O horário entra no plano semanal e as próximas aulas Aguardando são geradas. Aluno que já está no grupo não muda. Grupo cheio responde `HORARIO_OCUPADO`. Domingo responde `DADOS_INVALIDOS`.

`DELETE /api/grupos/semana/alunos` tira o aluno desse horário do plano. As próximas aulas Aguardando ligadas ao plano saem. Aula já confirmada permanece. Os dois métodos respondem a lista atualizada de `GET /api/grupos/semana`.

`PATCH /api/grupos/semana` altera o grupo fixo. O corpo traz `dia`, `horarioInicio` e `responsavelId`. `novoResponsavelId` troca o professor. `capacidade` troca o limite, e só aceita 4, 5 ou 6. Pelo menos um dos dois vem no corpo. No painel, o botão Editar de cada horário oferece Professor e Sócio, o limite e a entrada e a saída de alunos. O mesmo professor não muda nada. O professor novo entra no plano de todos os alunos daquele horário. As próximas aulas Aguardando ligadas ao plano são recriadas com ele. Aula já confirmada permanece com o professor anterior. Se o professor novo ainda não tem esse horário, a capacidade da próxima sessão acompanha o grupo. Se ele já tem, os alunos entram nessa capacidade. O limite novo vale para as sessões desse horário que ainda não começaram, e a ocorrência nova desse professor, dia e horário usa essa capacidade. Reduzir abaixo dos alunos do horário, ou de uma sessão que já ocupe mais vagas, responde `HORARIO_OCUPADO`. Professor ocupado nesse horário também. Grupo sem aluno responde `DADOS_INVALIDOS`. A resposta é a lista atualizada de `GET /api/grupos/semana`.

`GET /api/grupos/:id`

`POST /api/grupos` cria a sessão e as participações, de 1 aluno até a capacidade. Se já existir grupo daquele professor naquele início, as aulas entram nele. `fim` e `capacidade` são opcionais. Sem eles, a sessão nova dura 1 hora e nasce com capacidade 4. Num grupo que já existe, `fim` e `capacidade` só mudam quando o corpo os envia. Capacidade diferente de 4, 5 ou 6 responde `DADOS_INVALIDOS`. Duração menor que 1 hora, ou início e fim em dias diferentes, também. Mais alunos do que a capacidade, ou aluno repetido, responde `DADOS_INVALIDOS`. Responde `201` com o grupo e as aulas. Se um aluno for recusado, nenhuma aula nova é gravada.

```json
{
  "alunoIds": ["uuid", "uuid"],
  "responsavelId": "uuid",
  "inicio": "2026-10-20T19:00:00-03:00",
  "fim": "2026-10-20T20:30:00-03:00",
  "capacidade": 6,
  "experimental": false
}
```

O painel não edita a sessão datada. Professor, limite e alunos do horário fixo ficam em Grupos.

`PATCH /api/grupos/:id` troca `responsavelId`, `inicio`, `fim` ou `capacidade`. Se só o início muda, o fim acompanha e a duração permanece. Se o fim vem no corpo, ele vale. O mesmo instante de início não altera a sessão. Mudar professor, início ou fim solta do plano todas as aulas do grupo. Mudar a capacidade não solta. Reduzir a capacidade abaixo das vagas ocupadas responde `HORARIO_OCUPADO`. Capacidade diferente de 4, 5 ou 6 responde `DADOS_INVALIDOS` com a mensagem de que a capacidade do grupo é 4, 5 ou 6. Duração menor que 1 hora responde `DADOS_INVALIDOS` com a mensagem de que o grupo dura no mínimo 1 hora. Começo e fim em dias diferentes responde `DADOS_INVALIDOS`. Mudar início ou fim depois que a sessão começou responde `AULA_JA_INICIOU`. Trocar o professor continua permitido depois do início.

Grupo na resposta:

```json
{
  "id": "uuid",
  "responsavel": { "id": "uuid", "nome": "string" },
  "inicio": "2026-10-20T19:00:00-03:00",
  "fim": "2026-10-20T20:00:00-03:00",
  "capacidade": 4,
  "aulas": []
}
```

## Aulas

Leitura e escrita de aula: professor e administrador.

`GET /api/aulas?de=YYYY-MM-DD&ate=YYYY-MM-DD` inclui aulas cujo início cai nesse intervalo, em Brasília, inclusive as canceladas.

`GET /api/aulas/:id`

`POST /api/aulas` cria avulsa, status Aguardando, fora do plano. O corpo traz `grupoId` ou, para achar ou criar o grupo, `responsavelId` e `inicio`. `fim` e `capacidade` são opcionais e seguem a mesma regra do `POST /api/grupos`.

```json
{
  "alunoId": "uuid",
  "responsavelId": "uuid",
  "inicio": "2026-10-20T19:00:00-03:00",
  "experimental": false
}
```

Data de `inicio` anterior a hoje, em Brasília, responde `DADOS_INVALIDOS`. Hoje é aceito. Com `experimental: true` e sem `alunoId`, o corpo pode trazer `alunoTemporario: { "nome": "string", "telefone": "string ou null" }`. Isso grava um aluno temporário, fora de `GET /api/alunos` e da contagem do dashboard. Sem experimental, `alunoId` de um aluno efetivo é obrigatório.

`POST /api/aulas/reposicao` agenda a reposição de um aluno que já tem vaga. O corpo traz `alunoId` e, como na aula avulsa, `grupoId` ou `responsavelId` com `inicio`. A aula nasce Aguardando, fora do plano, e aponta para a origem disponível mais antiga. A vaga é consumida. Sem vaga, responde `DADOS_INVALIDOS` com a mensagem de que o aluno não tem reposição disponível. A data segue a regra de hoje em diante, e o horário segue o mesmo conflito da aula avulsa. Responde `201` com a aula criada.

```json
{
  "alunoId": "uuid",
  "responsavelId": "uuid",
  "inicio": "2026-10-26T11:00:00-03:00"
}
```

`PATCH /api/aulas/:id` aceita `alunoId`, `status`, `experimental` e, no aluno temporário, `telefone`. Professor, início, fim e capacidade ficam em `PATCH /api/grupos/:id`. Mudar o aluno solta a ocorrência do plano. Mudar status mantém o vínculo. `status: "CANCELADA"` numa aula que não está cancelada responde `DADOS_INVALIDOS`: o cancelamento passa por `POST /api/aulas/:id/cancelar`. Tirar a aula de Cancelada apaga a justificativa.

Ao enviar `status: "FALTA"`, o corpo pode incluir `concederReposicao` e `reposicao`. Sem `concederReposicao`, a falta é gravada e nenhuma vaga nasce. `concederReposicao: { "justificativa": "string" }` grava a justificativa e concede uma vaga. `concederReposicao: null` apaga a vaga, desde que não exista reposição em aberto. `reposicao` só vale com essa justificativa já gravada ou enviada no mesmo corpo; sem ela, responde `DADOS_INVALIDOS` pedindo a justificativa. Com `reposicao`, nasce outra aula Aguardando, fora do plano, apontando para a origem, e a vaga é consumida. Numa aula Cancelada com `cancelamento.geraReposicao: true`, o PATCH aceita `reposicao` sem `status`, porque o cancelamento já gravou a justificativa. Fora desses dois casos, `reposicao` responde `DADOS_INVALIDOS`. A mesma aula recusa outra `reposicao` enquanto existir reposição não cancelada apontando para ela, com a mensagem de que a reposição já está agendada. Cancelar essa reposição devolve a vaga. Sair do status Falta apaga a justificativa da reposição. A data da reposição segue a regra de hoje em diante.

```json
{
  "status": "FALTA",
  "concederReposicao": { "justificativa": "Aluno avisou" },
  "reposicao": { "responsavelId": "uuid", "inicio": "2026-10-22T19:00:00-03:00" }
}
```

`POST /api/aulas/:id/cancelar` grava Cancelada. `justificativa` e `geraReposicao` são obrigatórios. Com `geraReposicao: true`, a justificativa do cancelamento também fica em `justificativaReposicao` e concede a vaga. `reposicao` é opcional e só vale com `geraReposicao: true`. Aula já cancelada responde `DADOS_INVALIDOS`.

```json
{
  "justificativa": "Chuva forte",
  "geraReposicao": true,
  "reposicao": { "responsavelId": "uuid", "inicio": "2026-10-24T09:00:00-03:00" }
}
```

Criar, editar, obter e cancelar devolvem a aula, inclusive o `id`.

Conflito de horário ou bloqueio: `409` com `HORARIO_OCUPADO` ou `BLOQUEIO_AGENDA`. O conflito usa o intervalo real do grupo. O mesmo professor não pode ter dois grupos que se cruzem enquanto os dois ocupam vaga. Ocupam vaga `AGUARDANDO` e `CONFIRMADA`. `FALTA` e `CANCELADA` liberam a vaga. A aula além da capacidade responde `HORARIO_OCUPADO`. O mesmo aluno em dois grupos que se cruzem responde `HORARIO_OCUPADO` em qualquer status da própria aula. Sair de `FALTA` ou de `CANCELADA` volta a ocupar a vaga e, com o grupo cheio, responde `HORARIO_OCUPADO`.

Aula na resposta. `responsavel`, `inicio` e `fim` repetem o grupo:

```json
{
  "id": "uuid",
  "grupo": {
    "id": "uuid",
    "responsavel": { "id": "uuid", "nome": "string" },
    "inicio": "2026-10-20T19:00:00-03:00",
    "fim": "2026-10-20T20:00:00-03:00",
    "capacidade": 4
  },
  "aluno": { "id": "uuid", "nome": "string", "categoria": "D", "telefone": "11999990000", "temporario": false },
  "responsavel": { "id": "uuid", "nome": "string" },
  "inicio": "2026-10-20T19:00:00-03:00",
  "fim": "2026-10-20T20:00:00-03:00",
  "status": "AGUARDANDO",
  "experimental": false,
  "reposicaoDeAulaId": null,
  "reposicaoAgendadaId": null,
  "reposicoesDisponiveis": 0,
  "justificativaReposicao": null,
  "ligadaAoPlano": true,
  "cancelamento": null
}
```

`status`: `AGUARDANDO`, `CONFIRMADA`, `FALTA`, `CANCELADA`. `cancelamento` é `{ "justificativa": "string", "geraReposicao": true }` na aula Cancelada e `null` nas outras. `reposicaoAgendadaId` aponta a reposição em aberto desta aula, ou `null`. `reposicoesDisponiveis` é o saldo do aluno desta aula. `justificativaReposicao` é a justificativa que concedeu a vaga, ou `null` quando a aula não concede reposição.

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

`GET /api/avisos` professor e administrador, do mais recente ao mais antigo. Se a semana ainda não tem o aviso dos aniversariantes, essa leitura cria o aviso. Sem aluno ativo aniversariando, a mensagem informa que não há aniversariantes na semana.

`POST /api/avisos`, `PATCH /api/avisos/:id`, `DELETE /api/avisos/:id`: só administrador. Corpo: `{ "titulo", "mensagem" }`.

Cada aviso traz `id`, `titulo`, `mensagem` e `criadoEm`.

## Dashboard

`GET /api/dashboard` autenticado. Também cria o aviso dos aniversariantes da semana, se ainda não existir, como em `GET /api/avisos`.

```json
{
  "aulasHoje": 0,
  "confirmadas": 0,
  "alunosCadastrados": 0,
  "alunosDoDia": 0,
  "proximoHorario": [],
  "eventosDaSemana": [],
  "avisos": []
}
```

`proximoHorario` é a lista de aulas não canceladas do próximo início que ainda não terminou, no formato de aula acima. Grupo no mesmo horário entra inteiro. Sem aula por vir, a lista é `[]`.

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
