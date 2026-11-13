# PRD — Personalytte

Versão do produto: 1  
Data: 19 de outubro de 2026  
Referência visual: [Personalyte no Canva](https://www.canva.com/design/DAHYI7rIbgM/-QKtnh7ASy4yj3rFAoDKew/view)

O Canva orienta layout e tom. Este documento vence quando os dois divergem. No desenho, a lista Iniciante / Intermediário / Avançado e o tipo Treino eram rascunho.

## 1. Objetivo

A Personalytte é uma escola de beach tennis. Esta versão é o painel web da equipe para cadastrar alunos e integrantes, ver o dia e a semana, registrar o status das aulas e publicar avisos internos.

Uma escola, um painel, dados reais. O aluno não entra no sistema. O telefone fica guardado para a equipe falar com ele por fora.

## 2. Esta versão

- Login da equipe
- Dashboard
- Acompanhamento do mês
- Agenda da semana, agenda do dia e horários com vaga
- Aula: detalhe, criação, edição, cancelamento e status
- Evento
- Avisos
- Alunos
- Equipe

O compromisso se chama **aula** em todo o produto: menu, agenda, botões e status.

Idioma da interface: português. Fuso das regras: America/Sao_Paulo. A semana começa na segunda e inclui o domingo.

## 3. Fora desta versão

- Portal do aluno
- Mais de uma escola no mesmo sistema
- Financeiro, cobrança e mensagens ao aluno
- Configurações e módulos separados de treinos, turmas e professores
- Quadra como recurso da agenda
- Importação de planilha
- Envio de e-mail e “esqueci minha senha”
- Domínio próprio (a primeira versão usa o endereço padrão da Heroku)

O plano do aluno (Particular, Gympass, TotalPass ou Mensal) é um dado cadastral. Ele não gera cobrança.

## 4. Papéis

Há dois logins. A função do integrante define o papel.

| Função | Papel | O que faz |
| --- | --- | --- |
| Professor(a) | Professor | Vê o dashboard, o acompanhamento do mês, a agenda inteira e a lista de alunos, com telefone. Cria, edita, cancela e muda o status das aulas. |
| Outros | Professor | Entra com o mesmo acesso do professor. Não entra na lista de Professor do novo agendamento. |
| Sócio | Administrador | Faz o que o professor faz. Também cria, edita e inativa alunos e integrantes, cria e edita eventos, e cria, edita e apaga avisos. |

O sócio pode ser o responsável por uma aula ou por um plano semanal. O login dele continua de administrador.

O professor não abre a tela de equipe, não grava aluno, não grava evento e não grava aviso. Aviso ele apenas lê, no dashboard.

Não há cadastro público. O administrador cria cada conta e define a senha, com no mínimo 8 caracteres. A senha é entregue pessoalmente. A troca de senha também é feita por ele.

## 5. Regras de domínio

### 5.1 Aluno

Obrigatórios: nome, telefone, plano, categoria e gênero.

- Telefone brasileiro, com 10 ou 11 dígitos.
- Plano: Particular, Gympass, TotalPass ou Mensal.
- Categoria: Iniciante, D, C, B ou A.
- Gênero: Feminino ou Masculino.

E-mail é opcional. Instagram também: o usuário do perfil, para marcação nos stories, sem o endereço. A data de nascimento é opcional, em dia civil, para os aniversariantes da semana. A busca encontra nome, e-mail, telefone ou Instagram.

O plano semanal é uma lista de dias, horários e professores. Cada item tem o próprio horário e o próprio professor: terça às 19h com um professor e quinta às 19h com outro geram aulas diferentes. O mesmo dia pode ter mais de um horário, desde que as aulas de 60 minutos não se cruzem. Cada linha traz o professor. A linha sem professor é recusada. A lista vazia significa aluno cadastrado sem aula gerada. No novo agendamento, esse campo se chama Professor e lista integrantes Professor e Sócio. A ficha do aluno não edita o plano semanal. Ela lista os grupos do aluno, só para consulta. A entrada e a saída do horário fixo ficam em Grupos.

A categoria fica só no aluno. A agenda mostra a categoria atual dele.

Apagar inativa. O histórico permanece. As aulas futuras ainda em Aguardando saem da agenda. Aulas futuras já Confirmada, Falta ou Cancelada permanecem. Aluno inativo permanece na lista de Alunos, identificado como inativo, e o detalhe abre só para consulta. Não entra em “alunos cadastrados” nem na busca de um agendamento novo. O administrador pode reativar. A reativação não recria as aulas que saíram. O plano semanal continua no cadastro, e o horizonte não gera ocorrência dele enquanto o plano não for alterado. Alterar o plano gera as ocorrências futuras a partir dessa alteração.

A data de cadastro é gravada pelo sistema.

### 5.2 Aula e recorrência

O grupo é a sessão: um professor, início, fim e capacidade. A aula é o compromisso de um aluno dentro dessa sessão e guarda status, experimental, reposição e o vínculo com o plano. O grupo nasce com 1 hora e capacidade 4. A capacidade é 4, 5 ou 6. O limite vale para qualquer horário. Menos de 1 hora é recusado, e início e fim ficam no mesmo dia. O professor pode ser trocado a qualquer momento, também depois do início, e a troca vale para todos os alunos da sessão sem reescrever o plano de cada um.

Ocupam vaga Aguardando e Confirmada. No novo agendamento, a aula avulsa ou experimental entra num grupo que já existe e ainda tem vaga. A tela não amplia a capacidade nem estende o fim. O sistema recusa aluno além das vagas, e qualquer horário que cruze outro grupo do mesmo aluno. Horário sem grupo ou grupo cheio não aparece. Aula cancelada ou com falta libera a vaga do grupo. A tela Horários com vaga mostra a semana escolhida, de segunda a sábado, das 7h às 21h, sem os inícios das 12h e das 13h, usando a capacidade e o fim real. Horário sem grupo que ocupe vaga aparece como Horário vago. Grupo com vaga mostra a categoria, a quantidade de vagas e o professor. Grupo cheio aparece com a categoria e Lotado. Horário coberto por um grupo que começou antes aparece como Ocupado. Horário coberto por evento aparece como Agenda fechada. A tela copia esse quadro em texto, sem nome de aluno, para colar no WhatsApp. A falta ou o cancelamento do próprio aluno continua impedindo outro grupo que cruze essa aula. Sair da falta ou do cancelamento volta a ocupar a vaga, e o grupo cheio recusa essa volta. Evento de aniversário ou torneio não ocupa o horário da aula.

Status:

- Aguardando
- Confirmada
- Falta
- Cancelada

Toda aula nova nasce Aguardando. Administrador e professor podem mover o status entre esses quatro. Cancelar aula grava Cancelada e exige a justificativa e a resposta se o cancelamento gera reposição. Quando gera, a reposição pode ser agendada no próprio cancelamento ou depois, no detalhe da aula cancelada. Tirar a aula de Cancelada apaga a justificativa.

Ao marcar Falta, o sistema oferece criar a reposição. A vaga só nasce se esse quadro estiver marcado e a justificativa preenchida. A falta sem isso não concede vaga. Com a vaga, a aula pode ser agendada na hora ou ficar para depois. A reposição é uma aula avulsa, segue o mesmo ciclo de status e aponta para a aula de origem. O cancelamento que gera reposição também concede uma vaga, com a justificativa do cancelamento. Agendar a reposição consome essa vaga. No novo agendamento, quando o aluno tem vaga, a opção Usar reposição agenda a aula e consome a vaga mais antiga. A segunda reposição da mesma aula é recusada enquanto a primeira não estiver cancelada. O acompanhamento mostra quantas vagas ainda estão disponíveis.

Aula experimental é avulsa. Pode usar um aluno já cadastrado ou um cadastro temporário, só com nome e telefone opcional, sem plano, categoria nem gênero. Esse cadastro não entra na lista de alunos nem na contagem de cadastrados. Avulsa, experimental e reposição ficam fora do plano semanal.

Um agendamento novo, de aula ou de evento, não aceita data anterior a hoje, no calendário de Brasília. Hoje continua válido. Editar uma aula que já existe não usa essa trava.

O plano gera ocorrências com início no futuro, até completar 8 semanas a partir de hoje. Cada ocorrência entra no grupo daquele professor e daquele início, de 1 hora. A capacidade é a já escolhida para esse dia, horário e professor, ou 4 se o horário ainda não existe. Alunos com o mesmo dia, horário e professor compartilham o grupo. Todo dia, um agendamento estende esse horizonte. Ocorrência nova que cair em qualquer evento não é criada. Grupo que ficar sem aula é apagado.

Mudar um horário ou o responsável do plano recria só as ocorrências futuras ainda Aguardando e ainda ligadas ao plano. As demais permanecem.

Mudar o aluno de um dia solta aquela ocorrência do plano. Mudar professor, início ou fim do grupo solta todas as aulas da sessão. Mudar o status ou a capacidade mantém o vínculo.

Depois que o grupo começou, o status da aula continua editável. O professor e a capacidade também. Início e fim permanecem.

“Hoje”, “futura” e “já começou” usam o relógio de Brasília.

### 5.3 Evento

Tipos: Feriado, Agenda fechada, Ausência de professor, Aniversário e Torneio.

Nome, início e fim são obrigatórios. O fim é posterior ao início. O evento pode atravessar dias. Contato é opcional. Ausência aponta um responsável, e esse campo é obrigatório nesse tipo.

Qualquer evento ocupa a agenda inteira no intervalo. Uma aula nova que cruze esse horário é recusada, e um evento novo que cruze um grupo com alguma aula não cancelada também é recusado. O evento não aponta para o grupo. Aula já marcada não é cancelada por causa do evento. Ausência continua exigindo o responsável, e o bloqueio vale para a escola toda, não só para essa pessoa. Apagar o evento libera o horário para um agendamento novo. Só o administrador cria, edita e apaga evento.

### 5.4 Aviso

Título e mensagem são obrigatórios. Os dois papéis veem a lista no dashboard, do mais recente para o mais antigo. O aviso permanece até o administrador editar ou apagar. Não tem data de validade e não é enviado ao aluno.

Na primeira leitura do painel ou da lista de avisos em cada semana, o sistema cria um aviso com os alunos ativos que fazem aniversário de segunda a domingo, se ainda não existir o daquela semana. Sem aniversariante, o aviso informa que não há aniversariantes na semana. Não usa agendamento: a criação acontece nessa leitura, para funcionar com o dyno da Heroku em sleep. O administrador pode editar ou apagar como os demais.

### 5.5 Equipe e sessão

Obrigatórios: nome, e-mail e função. Telefone e data de nascimento são opcionais. O e-mail de login é único.

Criar integrante já cria o login. Professor(a) e Outros entram como professor. Sócio entra como administrador. Outros não aparece na lista de Professor do novo agendamento.

Apagar inativa e corta o login na hora. A API recusa inativar quem ainda é responsável por um plano semanal de aluno ativo, ou por uma aula futura que não esteja cancelada. O administrador troca essa pessoa antes. O último administrador ativo também não pode ser inativado.

A sessão viaja num cookie httpOnly, Secure em produção, SameSite Lax, por 7 dias. O navegador envia o cookie sozinho. Trocar a senha ou inativar o integrante encerra a sessão antiga. Cada requisição autenticada confere se o integrante segue ativo.

O primeiro administrador nasce na subida da API, quando ainda não existe usuário. Nome, e-mail e senha vêm das variáveis de ambiente. A função dele é Sócio.

### 5.6 Dashboard

Os números usam o dia corrente em Brasília. Aula cancelada fica de fora das contagens de aula.

- **Aulas hoje:** aulas cujo início cai hoje.
- **Confirmadas:** aulas de hoje com status Confirmada.
- **Alunos cadastrados:** alunos ativos.
- **Alunos do dia:** alunos distintos com aula não cancelada hoje.
- **Próximo horário:** as aulas não canceladas do início mais cedo que ainda não terminou. Se um horário está em andamento, ele é o escolhido. Mostra os alunos do grupo, a categoria atual de cada um e o responsável.
- **Eventos da semana:** eventos que cruzam a semana corrente, de segunda a domingo.
- **Avisos:** a lista descrita em 5.4.

### 5.7 Acompanhamento

Os dois papéis leem o mês civil de Brasília. A tela abre no mês corrente e também abre os meses anteriores. Mês futuro não abre.

Falta, confirmação e cancelamento contam a aula daquele status cujo início cai no mês. Reposição é a aula que aponta para a origem, contada no mês do próprio início, em qualquer status. Uma reposição confirmada, com falta ou cancelada também entra na coluna do status. Aula em Aguardando que não é reposição fica de fora.

A lista traz os alunos que tiveram ao menos um desses registros no mês, com a data de cada aula. As reposições disponíveis ficam à parte: são as vagas ainda não agendadas, e não mudam ao trocar o mês.

### 5.8 Check-in

O painel lista, num dia de Brasília, os check-ins que o Gympass e a TotalPass avisam. Os dois aparecem na mesma tela. A confirmação da visita continua no portal de cada provedor: o sistema não valida o check-in. Quando o e-mail ou o telefone bate com um único aluno ativo, o nome abre a ficha. Sem essa correspondência, o nome fica só na lista. O CPF recebido da TotalPass não é guardado.

## 6. Telas

A referência visual é o Canva. O comportamento abaixo é o contrato.

- **Login.** E-mail e senha. Sem botão de criar conta e sem recuperação de senha.
- **Dashboard.** Saudação da equipe, os números de 5.6, próximo horário, eventos da semana e avisos. Atalho para novo agendamento. O administrador também cria aviso daqui.
- **Acompanhamento.** Mês corrente, com volta aos meses anteriores. Números e lista por aluno de faltas, confirmações, cancelamentos e reposições. Também lista as reposições disponíveis, as vagas ainda não agendadas. Visível para professor e administrador. Cada aula abre o detalhe.
- **Check-ins.** Lista do dia, visível para professor e administrador, com horário, nome, contato e provedor. Gympass e TotalPass na mesma tabela.
- **Agenda da semana.** Grade de segunda a domingo, das 7h às 21h, sem 12h e 13h. Cada grupo aparece no horário em que começa, com o professor e os alunos. O horário sem grupo aparece como Horário vago. O grupo com aula mostra as categorias presentes. Dá para ir à semana anterior, à seguinte e a hoje. O nome do aluno abre o status na própria grade: Aguardando, Confirmada ou Falta. Ao marcar Falta, a vaga de reposição nasce com o quadro marcado e a justificativa preenchida. Cancelar pede a justificativa. A tela da aula continua na agenda do dia.
- **Horários com vaga.** De segunda a sábado, das 7h às 21h, sem 12h e 13h. Serve para oferecer horário a aluno novo ou já cadastrado. Usa a capacidade e o fim real do grupo. Horário vago, categoria com a quantidade de vagas e o professor, categoria com Lotado, horário ocupado por um grupo que começou antes, ou agenda fechada. Copia o quadro em texto, sem nome de aluno.
- **Agenda do dia.** Grupos do dia em ordem de horário, cada um com professor, intervalo e capacidade, e as aulas com aluno, categoria, status e o marcador de experimental ou reposição. Dá para mudar o status na lista. Cancelar pede a justificativa e se gera reposição. A oferta de reposição da falta fica no detalhe da aula. A tela copia a agenda do dia em texto, para colar no WhatsApp. Cada grupo lista os alunos. Confirmada leva ✅, falta leva ❌, e a experimental aparece marcada. Aula cancelada não entra.
- **Detalhe da aula.** Dados da aula e ações de editar, cancelar e mudar status. Status, falta, cancelamento e reposição são da aula. O professor aparece na tela. Professor, limite e alunos do horário fixo ficam em Grupos. Ao marcar Falta, a vaga só nasce com o quadro de criar reposição marcado e a justificativa preenchida. A data da aula de reposição pode ficar para depois. A aula cancelada que gera reposição oferece o agendamento e mostra as reposições disponíveis do aluno. Se a reposição desta aula já está agendada, a tela abre essa aula em vez de oferecer outra. Cancelar abre a justificativa e a pergunta se gera reposição.
- **Grupos.** Item de Gestão no menu lateral, para professor e administrador. Grade de segunda a sábado, sem dia do mês, com o horário à esquerda e o dia em cima. Cada horário de um professor aparece uma vez, com os alunos. A célula vazia oferece Novo grupo: horário, professor, limite e ao menos um aluno. O botão Editar abre o professor, o limite de alunos e a entrada e a saída de alunos. O professor pode ser um integrante Professor ou Sócio. O limite é 4, 5 ou 6 e vale para as próximas sessões daquele horário. A mudança entra no plano semanal: as próximas aulas em Aguardando acompanham a lista, e a aula já confirmada permanece com o professor anterior. A busca filtra por professor ou aluno.
- **Novo agendamento.** Primeiro a escolha entre aula e evento. Professor segue só para aula. Em seguida, o formulário correspondente. No formulário da aula, o horário lista os grupos da data que ainda têm vaga para os alunos escolhidos. Cada opção mostra o início, as vagas e as categorias de quem já ocupa, sem repetir. Horário sem grupo e grupo cheio não aparecem. A aula nasce fora do plano, avulsa ou experimental, e a capacidade e o fim do grupo não mudam nesta tela. Se o aluno escolhido tem reposição disponível, o formulário oferece Usar reposição e a aula consome a vaga mais antiga.
- **Alunos.** Lista com nome, telefone, plano, categoria, gênero, cadastro e ações. Inclui inativos, identificados na lista. Busca por nome, e-mail ou telefone. Formulário de criação e edição, sem o plano semanal. A ficha lista os grupos do aluno, só para consulta. O horário fixo entra e sai em Grupos. Professor consulta a lista e o detalhe, sem gravar. Aluno inativo abre só para consulta. Cadastro antigo sem gênero aparece vazio até ser editado.
- **Equipe.** Visível só para o administrador. Lista com nome, telefone, função, data de nascimento, cadastro e ações. Busca por nome, e-mail ou telefone. O formulário inclui e-mail e senha inicial.

## 7. Arquitetura

Um repositório Git, este diretório, com duas pastas:

- `frontend/`: React, TypeScript, Vite e Tailwind
- `backend/`: NestJS e TypeScript

Uma aplicação na Heroku. O build gera o front e a API. O NestJS serve a API em `/api` e os arquivos do React no mesmo domínio, com fallback do SPA para `index.html`. O banco é Heroku Postgres. O fuso de negócio continua America/Sao_Paulo; o banco guarda instantes com fuso.

O horizonte de 8 semanas é estendido por um agendamento diário na mesma aplicação (Heroku Scheduler).

Produção começa vazia, fora o administrador inicial. Dados de exemplo existem só no ambiente local.

Variáveis previstas na Heroku:

- `DATABASE_URL`
- `BOOTSTRAP_ADMIN_NAME`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- segredo usado para assinar a sessão
- `PUBLIC_BASE_URL`, `GYMPASS_API_TOKEN`, `GYMPASS_GYM_ID`, `GYMPASS_WEBHOOK_SECRET`, `TOTALPASS_PARTNER_API_KEY`, `TOTALPASS_PLACE_API_KEY` e `TOTALPASS_WEBHOOK_TOKEN`, quando a escola for receber check-in

## 8. Critérios de aceite

1. Professor e sócio entram com e-mail e senha. Não existe tela de cadastro aberto nem de esqueci a senha.
2. Com o banco vazio, a primeira subida cria o sócio administrador a partir das variáveis de ambiente.
3. Sócio dá aula e continua com permissão de administrador. Professor não grava aluno, equipe, evento nem aviso.
4. Aluno sem linhas no plano fica cadastrado e não ganha aula. Cada linha traz dia, horário e professor, e linhas diferentes podem ter professores diferentes. O plano gera ocorrências futuras até 8 semanas, cada uma dentro do grupo daquele professor e daquele início, de 1 hora, com a capacidade já escolhida para esse horário ou 4 se ele ainda não existe.
5. O grupo aceita 4, 5 ou 6 alunos. Outro valor é recusado, e reduzir abaixo das vagas ocupadas também. A duração mínima é 1 hora, no mesmo dia. No novo agendamento, a aula avulsa ou experimental entra num grupo que já existe e ainda tem vaga. Horário sem grupo não aparece. Grupos que se cruzam para o mesmo professor, ou qualquer cruzamento para o mesmo aluno, são recusados. Aula cancelada ou com falta não entra na conta da vaga. A falta ou o cancelamento do próprio aluno continua ocupando o horário dele. Sair da falta ou do cancelamento volta a ocupar a vaga. Horários com vaga mostra de segunda a sábado, das 7h às 21h, sem 12h e 13h: horário vago, categoria com as vagas e o professor, categoria com Lotado, horário ocupado pelo intervalo real do grupo, ou agenda fechada. O texto copiado não leva nome de aluno. A agenda da semana, de segunda a domingo, mostra cada grupo no início dele e Horário vago nos inícios sem grupo. Nessa grade, o nome do aluno abre o status sem sair da semana. Ao marcar Falta, a vaga nasce com o quadro marcado e a justificativa preenchida. Cancelar pede a justificativa.
6. Mudar o plano recria só as futuras Aguardando ainda ligadas a ele. Editar o aluno de um dia, ou o professor, o início ou o fim do grupo, deixa essas aulas de fora das próximas recriações.
7. Marcar Falta salva só a falta. A vaga nasce quando o quadro de criar reposição está marcado e a justificativa está preenchida. A aula de reposição pode nascer na hora ou depois, já Aguardando e fora do plano. O cancelamento que gera reposição também concede uma vaga. No novo agendamento, Usar reposição consome a vaga mais antiga do aluno. A segunda reposição da mesma aula é recusada enquanto a primeira não estiver cancelada. O acompanhamento mostra as vagas ainda disponíveis.
8. Qualquer evento recusa aula nova no intervalo, e qualquer aula não cancelada recusa evento novo no mesmo horário. Nada que já estava na agenda é cancelado por isso.
9. Depois do início da aula, o status muda e a data e o horário não mudam.
10. Inativar aluno remove as futuras Aguardando e preserva o histórico. O aluno inativo permanece na lista de Alunos. Reativar devolve o aluno e não recria as aulas que saíram. Inativar integrante corta o login e é recusado enquanto essa pessoa tiver plano ativo ou aula futura não cancelada. O último administrador permanece.
11. Aviso fica no dashboard até o administrador editar ou apagar, do mais recente ao mais antigo.
12. O cookie de sessão dura 7 dias, não fica disponível ao JavaScript da página, e deixa de valer quando a senha muda ou o integrante é inativado.
13. O front e a API abrem no mesmo endereço da Heroku. O ambiente local sobe com dados de exemplo. Produção, fora o administrador inicial, não traz esses dados.
14. O acompanhamento abre no mês corrente de Brasília e também nos meses anteriores. Lista faltas, confirmações, cancelamentos e reposições dos alunos. Aula em Aguardando só entra quando é reposição.
