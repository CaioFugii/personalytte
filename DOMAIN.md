# Domínio

Uma escola. O aluno não entra no sistema. O fuso das regras é America/Sao_Paulo e a semana começa na segunda, com domingo incluído.

## Pessoas

**Integrante** é quem entra no painel. A função define o papel: `PROFESSOR` e `OUTROS` entram como professor e `SOCIO` entra como administrador. O sócio também pode ser responsável por aula e por plano semanal. No cadastro do aluno e no novo agendamento, o campo se chama Professor e a lista traz só a função `PROFESSOR`.

O professor vê o dashboard, o acompanhamento do mês, a agenda inteira e os alunos, com telefone. Cria, edita, cancela e muda o status das aulas. Não grava aluno, equipe, evento nem aviso.

O administrador faz o que o professor faz e ainda grava alunos, integrantes, eventos e avisos.

Não há cadastro público. O administrador define a senha, com no mínimo 8 caracteres. Inativar um integrante corta o login na hora. A API recusa inativar quem ainda é responsável por um plano de aluno ativo ou por uma aula futura não cancelada. O último administrador ativo permanece.

**Aluno** tem nome, telefone, plano (`PARTICULAR`, `GYMPASS`, `TOTALPASS`, `MENSAL`), categoria (`INICIANTE`, `D`, `C`, `B` ou `A`) e gênero (`FEMININO` ou `MASCULINO`). E-mail, Instagram e data de nascimento são opcionais. A data é um dia civil (`YYYY-MM-DD`). O Instagram guarda o usuário do perfil, para marcação nos stories. A categoria fica só no aluno, e a agenda mostra a categoria atual. O plano não gera cobrança.

Cada item do plano semanal tem o próprio dia, horário e professor. Segunda às 19h e quinta às 9h são duas aulas, e cada uma pode ter um professor diferente. A linha sem professor é recusada. A lista vazia significa aluno sem aula gerada. Apagar inativa: o histórico fica, e as aulas futuras ainda `AGUARDANDO` saem da agenda. Aluno inativo permanece na lista de Alunos e sai da busca de um agendamento novo. O detalhe abre; edição e nova aula, não. Reativar devolve o aluno à lista ativa e não recria as aulas que saíram na inativação. O plano semanal continua no cadastro, e o horizonte não gera ocorrência dele enquanto o plano não for alterado. Alterar o plano gera as ocorrências futuras a partir dessa alteração.

## Check-in

Gympass e TotalPass avisam a visita por webhook. O painel guarda os dois na mesma lista e não confirma o check-in no provedor. O dia da lista é America/Sao_Paulo. E-mail ou telefone que aponte um único aluno ativo liga o nome à ficha. CPF não é guardado.

## Aula

Cada aula tem um aluno, um responsável, início, status e o marcador de experimental. Dura 60 minutos e começa e termina no mesmo dia.

Aula é dada em grupo de até 4 alunos. O mesmo responsável pode ter até 4 aulas que ocupam vaga no mesmo início, uma por aluno. Ocupam vaga os status `AGUARDANDO` e `CONFIRMADA`. O sistema recusa a quinta, outro início do mesmo responsável que cruze o grupo e qualquer cruzamento do mesmo aluno. A aula das 7h, a primeira do dia, aceita até 6 alunos com o mesmo responsável. A sétima é recusada. No novo agendamento, a lista de horário só oferece inícios em que ainda cabe o grupo, sem cruzar outra aula do professor ou dos alunos escolhidos. Aula `CANCELADA` ou `FALTA` libera a vaga do grupo. A tela Horários com vaga lê a semana escolhida, de segunda a sábado, das 7h às 22h, sem os inícios de 12h e de 13h. Sem aula ocupando vaga, o horário é Horário vago. Com vaga, mostra a categoria presente, a quantidade e o professor. Grupo cheio mostra a categoria da turma e Lotado. Evento que cobre o horário é Agenda fechada. O texto copiado repete o quadro e não inclui nome de aluno. A agenda da semana lista esses inícios de segunda a domingo, e o horário sem aula aparece como Horário vago. A falta ou o cancelamento do próprio aluno continua impedindo outro horário que cruze essa aula. Sair da falta ou do cancelamento volta a ocupar a vaga, e o grupo cheio recusa essa volta.

Status: `AGUARDANDO`, `CONFIRMADA`, `FALTA`, `CANCELADA`. Toda aula nova nasce `AGUARDANDO`. Os dois papéis podem mover o status entre esses quatro, mas só se entra em `CANCELADA` pela ação de cancelar.

Cancelar exige a justificativa e a resposta se gera reposição. Com reposição, ela pode ser agendada no cancelamento ou depois, a partir da aula cancelada. Sair de `CANCELADA` apaga a justificativa.

Ao marcar `FALTA`, a vaga de reposição só nasce se a tela marcar criar reposição e gravar a justificativa. A falta sem isso não concede vaga. Com a vaga, a aula de reposição pode ser agendada na hora ou depois. A reposição é avulsa, nasce `AGUARDANDO` e aponta para a aula de origem. O cancelamento que gera reposição também concede uma vaga, usando a justificativa do cancelamento. Agendar a reposição consome essa vaga. No novo agendamento, o aluno com vaga disponível pode usar uma reposição: a aula consome a vaga mais antiga. Outra reposição da mesma aula só entra se a anterior estiver `CANCELADA`. O acompanhamento mostra quantas vagas ainda estão disponíveis.

O acompanhamento lê um mês civil de Brasília, o corrente ou um anterior. Falta, confirmação e cancelamento contam a aula daquele status cujo início cai no mês. Reposição é a aula que aponta para a origem, contada no mês do próprio início, em qualquer status. Aula `AGUARDANDO` que não é reposição fica de fora. As reposições disponíveis aparecem na mesma tela e não dependem do mês escolhido. Os dois papéis apenas leem.

Aula experimental é avulsa. Pode apontar para um aluno cadastrado ou criar um cadastro temporário: nome obrigatório, telefone opcional, sem plano, categoria, gênero ou plano semanal. Temporário não aparece na lista de alunos nem conta como cadastrado. Avulsa, experimental e reposição ficam fora do plano semanal.

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

A primeira leitura do painel ou dos avisos na semana cria o aviso dos aniversariantes, se ainda não existir. Entram alunos ativos com data de nascimento na semana corrente, de segunda a domingo. Em ano sem 29 de fevereiro, o aniversário de 29 cai no dia 28. Sem aniversariante, o aviso informa que não há aniversariantes na semana. Não há rotina agendada.
