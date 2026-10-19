# Dúvidas do frontend

## Campos das listas

Alinhado com a API. Integrante traz `email` e `cadastradoEm`. Evento traz `id` e os campos do corpo. Aviso traz `id`. Criar aula devolve a aula com `id`. Plano semanal vazio vai como `diasSemana: []`, `horarioInicio: null` e `responsavelId: null`.

## Onde o administrador edita e apaga um evento?

O PRD diz que só o administrador cria, edita e apaga evento. A seção de telas descreve a criação em "Novo agendamento" e não descreve a tela do evento já gravado. O contrato tem `PATCH` e `DELETE`, e a lista já devolve o evento inteiro. Não há `GET /api/eventos/:id`.

Enquanto o lugar dessa tela não estiver definido, a agenda só exibe o evento. A criação continua em `/agenda/novo`.
