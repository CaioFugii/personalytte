# Domínio

Uma escola. O aluno não entra no sistema. O fuso das regras é America/Sao_Paulo e a semana começa na segunda, com domingo incluído.

## Pessoas

**Integrante** é quem entra no painel. A função define o papel: `PROFESSOR` e `OUTROS` entram como professor e `SOCIO` entra como administrador. O sócio também pode ser responsável por aula e por plano semanal. No novo agendamento, o campo se chama Professor e a lista traz `PROFESSOR` e `SOCIO`. A ficha do aluno não edita o plano semanal.

O professor vê o dashboard, o acompanhamento do mês, a agenda inteira e os alunos, com telefone. Cria, edita, cancela e muda o status das aulas. Não grava aluno, equipe, evento nem aviso.

O administrador faz o que o professor faz e ainda grava alunos, integrantes, eventos e avisos.

Não há cadastro público. O administrador define a senha, com no mínimo 8 caracteres. Inativar um integrante corta o login na hora. A API recusa inativar quem ainda é responsável por um plano de aluno ativo ou por uma aula futura não cancelada. O último administrador ativo permanece.

**Aluno** tem nome, telefone, plano (`PARTICULAR`, `GYMPASS`, `TOTALPASS`, `MENSAL`), categoria (`INICIANTE`, `D`, `C`, `B` ou `A`) e gênero (`FEMININO` ou `MASCULINO`). E-mail, Instagram e data de nascimento são opcionais. A data é um dia civil (`YYYY-MM-DD`). O Instagram guarda o usuário do perfil, para marcação nos stories. A categoria fica só no aluno, e a agenda mostra a categoria atual. O plano não gera cobrança.

Cada item do plano semanal tem o próprio dia, horário e professor. Segunda às 19h e quinta às 9h são duas aulas, e cada uma pode ter um professor diferente. A linha sem professor é recusada. A lista vazia significa aluno sem aula gerada. A ficha do aluno não grava esse plano. Ela lista os grupos em que o aluno está, só para consulta. Entrar e sair do horário fixo fica na lista de grupos. Apagar inativa: o histórico fica, e as aulas futuras ainda `AGUARDANDO` saem da agenda. Aluno inativo permanece na lista de Alunos e sai da busca de um agendamento novo. O detalhe abre; edição e nova aula, não. Reativar devolve o aluno à lista ativa e não recria as aulas que saíram na inativação. O plano semanal continua no cadastro, e o horizonte não gera ocorrência dele enquanto o plano não for alterado. Alterar o plano gera as ocorrências futuras a partir dessa alteração.

## Check-in

Gympass e TotalPass avisam a visita por webhook. O painel guarda os dois na mesma lista e não confirma o check-in no provedor. O dia da lista é America/Sao_Paulo. E-mail ou telefone que aponte um único aluno ativo liga o nome à ficha. CPF não é guardado.

## Aula

O grupo é a sessão. Tem um professor, início, fim e capacidade. A aula é a participação de um aluno nessa sessão: status, experimental, reposição, justificativa e o vínculo com o plano semanal.

O grupo nasce com 1 hora e capacidade 4. A capacidade só pode ser 4 ou 6. Ampliar para 6 é uma escolha da sessão, em qualquer horário. Reduzir para 4 é recusado se já houver mais de 4 vagas ocupadas. O fim pode passar de 1 hora e também voltar até 1 hora. Menos de 1 hora é recusado. Começo e fim ficam no mesmo dia. Mudar início ou fim depois que a sessão começou continua recusado. O professor pode ser trocado a qualquer momento, inclusive depois do início. A troca vale para todos os alunos da sessão e não reescreve o plano semanal de cada um. Trocar professor, início ou fim solta do plano as aulas daquela sessão. Mudar a capacidade não solta.

Ocupam vaga as aulas `AGUARDANDO` e `CONFIRMADA`. `FALTA` e `CANCELADA` liberam a vaga. O mesmo professor não pode ter dois grupos que se cruzem enquanto os dois ocupam vaga. O mesmo aluno não pode estar em dois grupos que se cruzem, em qualquer status da própria aula. No novo agendamento, a aula avulsa ou experimental entra num grupo que já existe e ainda tem vaga. Horário sem grupo não aparece, e a tela não muda a capacidade nem o fim. O aluno não entra se já cruza outro grupo. A tela Horários com vaga lê a semana escolhida, de segunda a sábado, das 7h às 21h, sem os inícios de 12h e de 13h, e usa a capacidade e o intervalo real do grupo. Sem grupo ocupando o horário, ele é Horário vago. Com vaga, mostra a categoria presente, a quantidade e o professor. Grupo cheio mostra a categoria e Lotado. Horário coberto por um grupo que começou antes é Ocupado. Evento que cobre o horário é Agenda fechada. O texto copiado repete o quadro e não inclui nome de aluno. A agenda da semana e a do dia leem os grupos. Na semana, o nome do aluno abre o status na própria grade. Ao marcar Falta, a vaga de reposição nasce com o quadro marcado e a justificativa preenchida. Cancelar continua pedindo a justificativa. O horário sem grupo aparece como Horário vago. A falta ou o cancelamento do próprio aluno continua impedindo outro grupo que cruze essa aula. Sair da falta ou do cancelamento volta a ocupar a vaga, e o grupo cheio recusa essa volta.

Status: `AGUARDANDO`, `CONFIRMADA`, `FALTA`, `CANCELADA`. Toda aula nova nasce `AGUARDANDO`. Os dois papéis podem mover o status entre esses quatro, mas só se entra em `CANCELADA` pela ação de cancelar.

Cancelar exige a justificativa e a resposta se gera reposição. Com reposição, ela pode ser agendada no cancelamento ou depois, a partir da aula cancelada. Sair de `CANCELADA` apaga a justificativa.

Ao marcar `FALTA`, a vaga de reposição só nasce se a tela marcar criar reposição e gravar a justificativa. A falta sem isso não concede vaga. Com a vaga, a aula de reposição pode ser agendada na hora ou depois. A reposição é avulsa, nasce `AGUARDANDO` e aponta para a aula de origem. O cancelamento que gera reposição também concede uma vaga, usando a justificativa do cancelamento. Agendar a reposição consome essa vaga. No novo agendamento, o aluno com vaga disponível pode usar uma reposição: a aula consome a vaga mais antiga. Outra reposição da mesma aula só entra se a anterior estiver `CANCELADA`. O acompanhamento mostra quantas vagas ainda estão disponíveis.

O acompanhamento lê um mês civil de Brasília, o corrente ou um anterior. Falta, confirmação e cancelamento contam a aula daquele status cujo início cai no mês. Reposição é a aula que aponta para a origem, contada no mês do próprio início, em qualquer status. Aula `AGUARDANDO` que não é reposição fica de fora. As reposições disponíveis aparecem na mesma tela e não dependem do mês escolhido. Os dois papéis apenas leem.

Aula experimental é avulsa. Pode apontar para um aluno cadastrado ou criar um cadastro temporário: nome obrigatório, telefone opcional, sem plano, categoria, gênero ou plano semanal. Temporário não aparece na lista de alunos nem conta como cadastrado. Avulsa, experimental e reposição ficam fora do plano semanal.

Um agendamento novo não aceita data anterior a hoje em Brasília. Hoje é permitido.

O plano gera ocorrências com início no futuro, até 8 semanas a partir de hoje. Cada ocorrência entra no grupo daquele professor e daquele início, de 1 hora. A capacidade é a já escolhida para esse dia, horário e professor, ou 4 se o horário ainda não existe. Alunos com o mesmo dia, horário e professor compartilham um único grupo. Todo dia o horizonte é estendido. Ocorrência que cair em qualquer evento não é criada. Remover aulas `AGUARDANDO` futuras apaga a participação. Grupo que ficar sem nenhuma aula é apagado.

Mudar um horário ou o responsável do plano recria só as ocorrências futuras ainda `AGUARDANDO` e ainda ligadas ao plano. Mudar o aluno de um dia solta aquela ocorrência do plano. Mudar professor, início ou fim do grupo solta todas as aulas da sessão. Mudar o status ou a capacidade mantém o vínculo.

Depois que o grupo começou, o status da aula continua editável. Início e fim da sessão permanecem. A lista de grupos fica em Gestão, de segunda a sábado, e não usa dia do mês. O horário fica à esquerda e o dia em cima. Cada célula mostra os alunos daquele horário. A célula vazia oferece Novo grupo: horário, professor, limite e ao menos um aluno. O botão Editar abre o professor, o limite e a entrada e a saída de alunos. O professor dessa lista é um integrante Professor ou Sócio. O limite é 4 ou 6 e vale para as próximas sessões daquele horário. Reduzir abaixo da quantidade de alunos do horário é recusado. Entrar no grupo grava o dia, o horário e o professor no plano semanal e gera as próximas aulas Aguardando. Sair apaga essas aulas Aguardando. Trocar o professor regrava o plano e recria as próximas aulas Aguardando com o professor novo. A aula já confirmada permanece com o professor anterior. A sessão datada não tem tela de edição. A tela da aula edita só o compromisso daquele aluno.

## Evento

Tipos: `FERIADO`, `AGENDA_FECHADA`, `AUSENCIA`, `ANIVERSARIO`, `TORNEIO`.

Nome, início e fim são obrigatórios. O evento pode atravessar dias. Contato é opcional. Ausência aponta um responsável.

Qualquer evento bloqueia aula nova em todo o intervalo, para qualquer responsável. Um grupo com alguma aula não cancelada bloqueia evento novo no mesmo intervalo. Evento não aponta para grupo. Aula existente não é cancelada. Ausência exige o responsável e mesmo assim bloqueia a escola toda. Apagar o evento libera o horário. Só o administrador cria, edita e apaga evento.

## Aviso

Título e mensagem. Os dois papéis leem a lista no dashboard, do mais recente ao mais antigo. O aviso permanece até o administrador editar ou apagar. Nada é enviado ao aluno.

A primeira leitura do painel ou dos avisos na semana cria o aviso dos aniversariantes, se ainda não existir. Entram alunos ativos com data de nascimento na semana corrente, de segunda a domingo. Em ano sem 29 de fevereiro, o aniversário de 29 cai no dia 28. Sem aniversariante, o aviso informa que não há aniversariantes na semana. Não há rotina agendada.
