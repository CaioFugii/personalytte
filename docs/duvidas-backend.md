# Respostas do backend

## Campos das listas

Nada falta na API. Os formatos abaixo já saem do backend.

### Integrante

`GET /api/integrantes` devolve um array só de ativos. Cada item:

```json
{
  "id": "uuid",
  "nome": "string",
  "email": "string",
  "telefone": "11922220002",
  "funcao": "PROFESSOR",
  "papel": "professor",
  "ativo": true,
  "dataNascimento": "1990-04-15",
  "cadastradoEm": "2026-10-19T14:25:08-03:00"
}
```

`telefone` e `dataNascimento` podem ser `null`. `funcao` é `PROFESSOR` ou `SOCIO`. `papel` é `professor` ou `administrador`. `cadastradoEm` é instante ISO-8601 com offset `-03:00`. `dataNascimento` é `YYYY-MM-DD`.

`GET /api/integrantes/responsaveis` continua menor: só `id`, `nome` e `funcao`. O integrante da sessão (`POST /api/sessao` e `GET /api/sessao/atual`) não traz telefone, data de nascimento nem `cadastradoEm`.

### Evento

`GET /api/eventos?de=YYYY-MM-DD&ate=YYYY-MM-DD` devolve um array. O mesmo objeto vai em `eventosDaSemana` no dashboard. Cada item:

```json
{
  "id": "uuid",
  "tipo": "AUSENCIA",
  "nome": "string",
  "inicio": "2026-12-20T15:00:00-03:00",
  "fim": "2026-12-20T17:00:00-03:00",
  "contato": "11922220002",
  "bloqueiaAulas": false,
  "responsavelId": "uuid"
}
```

`contato` e `responsavelId` podem ser `null`. `inicio` e `fim` são instantes ISO-8601 com offset `-03:00`.

### Aviso

`GET /api/avisos` devolve um array, do mais recente ao mais antigo. O mesmo objeto vai em `avisos` no dashboard. Cada item:

```json
{
  "id": "uuid",
  "titulo": "string",
  "mensagem": "string",
  "criadoEm": "2026-10-19T14:25:08-03:00"
}
```

`criadoEm` é instante ISO-8601 com offset `-03:00`.

### Criar aula

`POST /api/aulas` responde `201` com a aula, inclusive o `id`:

```json
{
  "id": "uuid",
  "aluno": { "id": "uuid", "nome": "string", "categoria": "D" },
  "responsavel": { "id": "uuid", "nome": "string" },
  "inicio": "2026-12-15T10:00:00-03:00",
  "fim": "2026-12-15T11:00:00-03:00",
  "status": "AGUARDANDO",
  "experimental": false,
  "reposicaoDeAulaId": null,
  "ligadaAoPlano": false
}
```

Aula avulsa nasce `AGUARDANDO` e `ligadaAoPlano: false`.

### Plano vazio

`POST /api/alunos` e `PATCH /api/alunos/:id` aceitam os três campos vazios juntos:

```json
{
  "diasSemana": [],
  "horarioInicio": null,
  "responsavelId": null
}
```

A resposta devolve esses mesmos valores. Se só parte do plano vier preenchida, a API responde `400` com `PLANO_INCOMPLETO`.

## Onde o administrador edita e apaga um evento

`PATCH /api/eventos/:id` e `DELETE /api/eventos/:id` já existem. Os dois são só do administrador; o professor recebe `403`. O `PATCH` devolve o evento no mesmo formato da lista. O `DELETE` devolve `{ "ok": true }`.

A lista e o dashboard já trazem o evento inteiro, com `id` e os campos do corpo. Uma tela que já tem esse objeto edita com `PATCH /api/eventos/:id` e apaga com `DELETE /api/eventos/:id`. Não precisa de `GET /api/eventos/:id`. Essa rota não foi criada.

O lugar da tela no produto não é lacuna da API. O contrato não descreve uma leitura por id, e o PRD não descreve uma tela de detalhe do evento já gravado.
