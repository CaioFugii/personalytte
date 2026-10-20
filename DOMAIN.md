# Domínio

Uma escola. O aluno não entra no sistema. O fuso das regras é America/Sao_Paulo e a semana começa na segunda, com domingo incluído.

## Pessoas

**Integrante** é quem entra no painel. A função define o papel: `PROFESSOR` entra como professor e `SOCIO` entra como administrador. O sócio também pode ser responsável por aula e por plano semanal.

O professor vê o dashboard, a agenda inteira e os alunos, com telefone. Cria, edita, cancela e muda o status das aulas. Não grava aluno, equipe, evento nem aviso.

O administrador faz o que o professor faz e ainda grava alunos, integrantes, eventos e avisos.

Não há cadastro público. O administrador define a senha, com no mínimo 8 caracteres. Inativar um integrante corta o login na hora. A API recusa inativar quem ainda é responsável por um plano de aluno ativo ou por uma aula futura não cancelada. O último administrador ativo permanece.

**Aluno** tem nome, telefone, plano (`PARTICULAR`, `GYMPASS`, `MENSAL`) e categoria (`D`, `C`, `B` ou `A`). E-mail é opcional. A categoria fica só no aluno, e a agenda mostra a categoria atual. O plano não gera cobrança.

Dias da semana, horário e responsável entram os três juntos ou ficam os três vazios. Vazio significa aluno sem aula gerada. Apagar inativa: o histórico fica, e as aulas futuras ainda `AGUARDANDO` saem da agenda. Aluno inativo sai da lista e da busca de um agendamento novo.

## Aula

Cada aula tem um aluno, um responsável, início, status e o marcador de experimental. Dura 60 minutos e começa e termina no mesmo dia.

O sistema recusa outro horário que cruze o mesmo responsável ou o mesmo aluno. Aula `CANCELADA` libera o horário.

Status: `AGUARDANDO`, `CONFIRMADA`, `FALTA`, `CANCELADA`. Toda aula nova nasce `AGUARDANDO`. Os dois papéis podem mover o status entre esses quatro.

Ao marcar `FALTA`, dá para criar outra aula ligada a essa, já identificada como reposição. A falta também pode ficar sozinha. A reposição é avulsa, nasce `AGUARDANDO` e aponta para a aula de origem. Uma falta pode originar mais de uma reposição.

Aula experimental é avulsa. Pode apontar para um aluno cadastrado ou criar um cadastro temporário: nome obrigatório, telefone opcional, sem plano, categoria ou plano semanal. Temporário não aparece na lista de alunos nem conta como cadastrado. Avulsa, experimental e reposição ficam fora do plano semanal.

Um agendamento novo não aceita data anterior a hoje em Brasília. Hoje é permitido.

O plano gera ocorrências com início no futuro, até 8 semanas a partir de hoje. Todo dia o horizonte é estendido. Ocorrência que cair em qualquer evento não é criada.

Mudar dias, horário ou responsável do plano recria só as ocorrências futuras ainda `AGUARDANDO` e ainda ligadas ao plano. Mudar aluno, responsável, data ou horário de um dia solta aquela ocorrência do plano. Mudar o status mantém o vínculo.

Depois que a aula começou, o status continua editável. Data e horário permanecem.

## Evento

Tipos: `FERIADO`, `AGENDA_FECHADA`, `AUSENCIA`, `ANIVERSARIO`, `TORNEIO`.

Nome, início e fim são obrigatórios. O evento pode atravessar dias. Contato é opcional. Ausência aponta um responsável.

Qualquer evento bloqueia aula nova em todo o intervalo, para qualquer responsável. Uma aula não cancelada bloqueia evento novo no mesmo intervalo. Aula existente não é cancelada. Ausência exige o responsável e mesmo assim bloqueia a escola toda. Apagar o evento libera o horário. Só o administrador cria, edita e apaga evento.

## Aviso

Título e mensagem. Os dois papéis leem a lista no dashboard, do mais recente ao mais antigo. O aviso permanece até o administrador editar ou apagar. Nada é enviado ao aluno.
