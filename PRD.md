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
- Agenda da semana e agenda do dia
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
| Outros | Professor | Entra com o mesmo acesso do professor. Não entra na lista de Professor do cadastro do aluno nem do novo agendamento. |
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

O plano semanal é uma lista de dias, horários e professores. Cada item tem o próprio horário e o próprio professor: terça às 19h com um professor e quinta às 19h com outro geram aulas diferentes. O mesmo dia pode ter mais de um horário, desde que as aulas de 60 minutos não se cruzem. Cada linha traz o professor. A linha sem professor é recusada. A lista vazia significa aluno cadastrado sem aula gerada. No cadastro do aluno e no novo agendamento, esse campo se chama Professor e lista só integrantes com função Professor.

A categoria fica só no aluno. A agenda mostra a categoria atual dele.

Apagar inativa. O histórico permanece. As aulas futuras ainda em Aguardando saem da agenda. Aulas futuras já Confirmada, Falta ou Cancelada permanecem. Aluno inativo permanece na lista de Alunos, identificado como inativo, e o detalhe abre só para consulta. Não entra em “alunos cadastrados” nem na busca de um agendamento novo. O administrador pode reativar. A reativação não recria as aulas que saíram. O plano semanal continua no cadastro, e o horizonte não gera ocorrência dele enquanto o plano não for alterado. Alterar o plano gera as ocorrências futuras a partir dessa alteração.

A data de cadastro é gravada pelo sistema.

### 5.2 Aula e recorrência

Cada aula tem um aluno, um responsável, início, status e o marcador de experimental. Dura 60 minutos e começa e termina no mesmo dia.

As aulas são dadas em grupos de até 4 alunos. O mesmo responsável pode ter até 4 aulas que ocupam vaga no mesmo início, uma por aluno. Ocupam vaga Aguardando e Confirmada. No novo agendamento, dá para escolher até 4 alunos de uma vez. O sistema recusa a quinta aula, outro horário do mesmo responsável que cruze esse grupo e qualquer horário que cruze outra aula do mesmo aluno. A aula das 7h, a primeira do dia, aceita até 6 alunos com o mesmo responsável, e a sétima é recusada. No novo agendamento, o horário é uma lista dos inícios em que o professor ainda tem vaga para os alunos escolhidos. Horário cheio não aparece. Aula cancelada ou com falta libera a vaga do grupo. A falta ou o cancelamento do próprio aluno continua impedindo outro horário que cruze essa aula. Sair da falta ou do cancelamento volta a ocupar a vaga, e o grupo cheio recusa essa volta. Evento de aniversário ou torneio não ocupa o horário da aula.

Status:

- Aguardando
- Confirmada
- Falta
- Cancelada

Toda aula nova nasce Aguardando. Administrador e professor podem mover o status entre esses quatro. Cancelar aula grava Cancelada e exige a justificativa e a resposta se o cancelamento gera reposição. Quando gera, a reposição pode ser agendada no próprio cancelamento ou depois, no detalhe da aula cancelada. Tirar a aula de Cancelada apaga a justificativa.

Ao marcar Falta, o sistema oferece criar a reposição. A vaga só nasce se esse quadro estiver marcado e a justificativa preenchida. A falta sem isso não concede vaga. Com a vaga, a aula pode ser agendada na hora ou ficar para depois. A reposição é uma aula avulsa, segue o mesmo ciclo de status e aponta para a aula de origem. O cancelamento que gera reposição também concede uma vaga, com a justificativa do cancelamento. Agendar a reposição consome essa vaga. No novo agendamento, quando o aluno tem vaga, a opção Usar reposição agenda a aula e consome a vaga mais antiga. A segunda reposição da mesma aula é recusada enquanto a primeira não estiver cancelada. O acompanhamento mostra quantas vagas ainda estão disponíveis.

Aula experimental é avulsa. Pode usar um aluno já cadastrado ou um cadastro temporário, só com nome e telefone opcional, sem plano, categoria nem gênero. Esse cadastro não entra na lista de alunos nem na contagem de cadastrados. Avulsa, experimental e reposição ficam fora do plano semanal.

Um agendamento novo, de aula ou de evento, não aceita data anterior a hoje, no calendário de Brasília. Hoje continua válido. Editar uma aula que já existe não usa essa trava.

O plano gera ocorrências com início no futuro, até completar 8 semanas a partir de hoje. Todo dia, um agendamento estende esse horizonte. Ocorrência nova que cair em qualquer evento não é criada.

Mudar um horário ou o responsável do plano recria só as ocorrências futuras ainda Aguardando e ainda ligadas ao plano. As demais permanecem.

Mudar aluno, responsável, data ou horário de um dia solta aquela ocorrência do plano. Mudar o status mantém o vínculo.

Depois que a aula começou, o status continua editável. Data e horário permanecem.

“Hoje”, “futura” e “já começou” usam o relógio de Brasília.

### 5.3 Evento

Tipos: Feriado, Agenda fechada, Ausência de professor, Aniversário e Torneio.

Nome, início e fim são obrigatórios. O fim é posterior ao início. O evento pode atravessar dias. Contato é opcional. Ausência aponta um responsável, e esse campo é obrigatório nesse tipo.

Qualquer evento ocupa a agenda inteira no intervalo. Uma aula nova que cruze esse horário é recusada, e um evento novo que cruze uma aula não cancelada também é recusado. Aula já marcada não é cancelada por causa do evento. Ausência continua exigindo o responsável, e o bloqueio vale para a escola toda, não só para essa pessoa. Apagar o evento libera o horário para um agendamento novo. Só o administrador cria, edita e apaga evento.

### 5.4 Aviso

Título e mensagem são obrigatórios. Os dois papéis veem a lista no dashboard, do mais recente para o mais antigo. O aviso permanece até o administrador editar ou apagar. Não tem data de validade e não é enviado ao aluno.

Na primeira leitura do painel ou da lista de avisos em cada semana, o sistema cria um aviso com os alunos ativos que fazem aniversário de segunda a domingo, se ainda não existir o daquela semana. Sem aniversariante, o aviso informa que não há aniversariantes na semana. Não usa agendamento: a criação acontece nessa leitura, para funcionar com o dyno da Heroku em sleep. O administrador pode editar ou apagar como os demais.

### 5.5 Equipe e sessão

Obrigatórios: nome, e-mail e função. Telefone e data de nascimento são opcionais. O e-mail de login é único.

Criar integrante já cria o login. Professor(a) e Outros entram como professor. Sócio entra como administrador. Outros não aparece na lista de Professor do cadastro do aluno nem do novo agendamento.

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
- **Agenda da semana.** Grade de segunda a domingo, com aulas e eventos. O grupo do horário mostra as categorias presentes. Dá para ir à semana anterior, à seguinte e a hoje.
- **Agenda do dia.** Aulas do dia em ordem de horário, com aluno, responsável, categoria, status e o marcador de experimental ou reposição. Dá para mudar o status na lista. Cancelar pede a justificativa e se gera reposição. A oferta de reposição da falta fica no detalhe da aula. A tela copia a agenda do dia em texto, para colar no WhatsApp. Cada horário lista os alunos. Confirmada leva ✅, falta leva ❌, e a experimental aparece marcada. Aula cancelada não entra.
- **Detalhe da aula.** Dados da aula e ações de editar, cancelar e mudar status. Ao marcar Falta, a vaga só nasce com o quadro de criar reposição marcado e a justificativa preenchida. A data da aula de reposição pode ficar para depois. A aula cancelada que gera reposição oferece o agendamento e mostra as reposições disponíveis do aluno. Se a reposição desta aula já está agendada, a tela abre essa aula em vez de oferecer outra. Cancelar abre a justificativa e a pergunta se gera reposição.
- **Novo agendamento.** Primeiro a escolha entre aula e evento. Professor segue só para aula. Em seguida, o formulário correspondente. No formulário da aula, o horário é uma lista dos inícios livres para o professor na data escolhida. Cada opção mostra as vagas e as categorias de quem já está no horário, sem repetir. Horário sem aluno indica isso. Horário com 4 alunos, ou com 6 às 7h, não aparece. Se o aluno escolhido tem reposição disponível, o formulário oferece Usar reposição e a aula consome a vaga mais antiga.
- **Alunos.** Lista com nome, telefone, plano, categoria, gênero, cadastro e ações. Inclui inativos, identificados na lista. Busca por nome, e-mail ou telefone. Formulário de criação e edição. Professor consulta a lista e o detalhe, sem gravar. Aluno inativo abre só para consulta. Cadastro antigo sem gênero aparece vazio até ser editado.
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
4. Aluno sem linhas no plano fica cadastrado e não ganha aula. Cada linha traz dia, horário e professor, e linhas diferentes podem ter professores diferentes. O plano gera ocorrências futuras até 8 semanas, sempre de 60 minutos.
5. O mesmo responsável aceita até 4 alunos no mesmo início, e a quinta aula é recusada. Às 7h o limite é 6, e a sétima é recusada. No novo agendamento, a lista de horário só mostra inícios com vaga para os alunos escolhidos. Horários que se cruzam com outro início para o mesmo responsável, ou qualquer cruzamento para o mesmo aluno, são recusados. Aula cancelada ou com falta não entra nessa conta. A falta ou o cancelamento do próprio aluno continua ocupando o horário dele. Sair da falta ou do cancelamento volta a ocupar a vaga.
6. Mudar o plano recria só as futuras Aguardando ainda ligadas a ele. Editar aluno, responsável, data ou horário de um dia deixa essa ocorrência de fora das próximas recriações.
7. Marcar Falta salva só a falta. A vaga nasce quando o quadro de criar reposição está marcado e a justificativa está preenchida. A aula de reposição pode nascer na hora ou depois, já Aguardando e fora do plano. O cancelamento que gera reposição também concede uma vaga. No novo agendamento, Usar reposição consome a vaga mais antiga do aluno. A segunda reposição da mesma aula é recusada enquanto a primeira não estiver cancelada. O acompanhamento mostra as vagas ainda disponíveis.
8. Qualquer evento recusa aula nova no intervalo, e qualquer aula não cancelada recusa evento novo no mesmo horário. Nada que já estava na agenda é cancelado por isso.
9. Depois do início da aula, o status muda e a data e o horário não mudam.
10. Inativar aluno remove as futuras Aguardando e preserva o histórico. O aluno inativo permanece na lista de Alunos. Reativar devolve o aluno e não recria as aulas que saíram. Inativar integrante corta o login e é recusado enquanto essa pessoa tiver plano ativo ou aula futura não cancelada. O último administrador permanece.
11. Aviso fica no dashboard até o administrador editar ou apagar, do mais recente ao mais antigo.
12. O cookie de sessão dura 7 dias, não fica disponível ao JavaScript da página, e deixa de valer quando a senha muda ou o integrante é inativado.
13. O front e a API abrem no mesmo endereço da Heroku. O ambiente local sobe com dados de exemplo. Produção, fora o administrador inicial, não traz esses dados.
14. O acompanhamento abre no mês corrente de Brasília e também nos meses anteriores. Lista faltas, confirmações, cancelamentos e reposições dos alunos. Aula em Aguardando só entra quando é reposição.
