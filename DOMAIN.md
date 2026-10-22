# Domínio

Uma escola. O aluno não entra no sistema. O fuso das regras é America/Sao_Paulo e a semana começa na segunda, com domingo incluído.

## Pessoas

**Integrante** é quem entra no painel. A função define o papel: `PROFESSOR` e `OUTROS` entram como professor e `SOCIO` entra como administrador. O sócio também pode ser responsável por aula e por plano semanal. No cadastro do aluno e no novo agendamento, o campo se chama Professor e a lista traz só a função `PROFESSOR`.

O professor vê o dashboard, a agenda inteira e os alunos, com telefone. Cria, edita, cancela e muda o status das aulas. Não grava aluno, equipe, evento nem aviso.

O administrador faz o que o professor faz e ainda grava alunos, integrantes, eventos e avisos.

Não há cadastro público. O administrador define a senha, com no mínimo 8 caracteres. Inativar um integrante corta o login na hora. A API recusa inativar quem ainda é responsável por um plano de aluno ativo ou por uma aula futura não cancelada. O último administrador ativo permanece.

**Aluno** tem nome, telefone, plano (`PARTICULAR`, `GYMPASS`, `TOTALPASS`, `MENSAL`) e categoria (`D`, `C`, `B` ou `A`). E-mail, Instagram e data de nascimento são opcionais. A data é um dia civil (`YYYY-MM-DD`). O Instagram guarda o usuário do perfil, para marcação nos stories. A categoria fica só no aluno, e a agenda mostra a categoria atual. O plano não gera cobrança.

Cada item do plano semanal tem o próprio dia e horário. Segunda às 19h e quinta às 9h são duas aulas. O professor é um só para o plano. Horários e professor entram juntos ou ficam os dois vazios. Vazio significa aluno sem aula gerada. Apagar inativa: o histórico fica, e as aulas futuras ainda `AGUARDANDO` saem da agenda. Aluno inativo sai da lista e da busca de um agendamento novo.

## Check-in

Gympass e TotalPass avisam a visita por webhook. O painel guarda os dois na mesma lista e não confirma o check-in no provedor. O dia da lista é America/Sao_Paulo. E-mail ou telefone que aponte um único aluno ativo liga o nome à ficha. CPF não é guardado.

## Aula

Cada aula tem um aluno, um responsável, início, status e o marcador de experimental. Dura 60 minutos e começa e termina no mesmo dia.

O sistema recusa outro horário que cruze o mesmo responsável ou o mesmo aluno. Aula `CANCELADA` libera o horário.

Status: `AGUARDANDO`, `CONFIRMADA`, `FALTA`, `CANCELADA`. Toda aula nova nasce `AGUARDANDO`. Os dois papéis podem mover o status entre esses quatro.

Ao marcar `FALTA`, dá para criar outra aula ligada a essa, já identificada como reposição. A falta também pode ficar sozinha. A reposição é avulsa, nasce `AGUARDANDO` e aponta para a aula de origem. Uma falta pode originar mais de uma reposição.

Aula experimental é avulsa. Pode apontar para um aluno cadastrado ou criar um cadastro temporário: nome obrigatório, telefone opcional, sem plano, categoria ou plano semanal. Temporário não aparece na lista de alunos nem conta como cadastrado. Avulsa, experimental e reposição ficam fora do plano semanal.

Um agendamento novo não aceita data anterior a hoje em Brasília. Hoje é permitido.

O plano gera ocorrências com início no futuro, até 8 semanas a partir de hoje. Todo dia o horizonte é estendido. Ocorrência que cair em qualquer evento não é criada.

Mudar um horário ou o responsável do plano recria só as ocorrências futuras ainda `AGUARDANDO` e ainda ligadas ao plano. Mudar aluno, responsável, data ou horário de um dia solta aquela ocorrência do plano. Mudar o status mantém o vínculo.

Depois que a aula começou, o status continua editável. Data e horário permanecem.

## Evento

Tipos: `FERIADO`, `AGENDA_FECHADA`, `AUSENCIA`, `ANIVERSARIO`, `TORNEIO`.

Nome, início e fim são obrigatórios. O evento pode atravessar dias. Contato é opcional. Ausência aponta um responsável.

Qualquer evento bloqueia aula nova em todo o intervalo, para qualquer responsável. Uma aula não cancelada bloqueia evento novo no mesmo intervalo. Aula existente não é cancelada. Ausência exige o responsável e mesmo assim bloqueia a escola toda. Apagar o evento libera o horário. Só o administrador cria, edita e apaga evento.

## Aviso

Título e mensagem. Os dois papéis leem a lista no dashboard, do mais recente ao mais antigo. O aviso permanece até o administrador editar ou apagar. Nada é enviado ao aluno.
