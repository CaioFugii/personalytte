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
- Relatórios, configurações e módulos separados de treinos, turmas e professores
- Quadra como recurso da agenda
- Importação de planilha
- Envio de e-mail e “esqueci minha senha”
- Domínio próprio (a primeira versão usa o endereço padrão da Heroku)

O plano do aluno (Particular, Gympass ou Mensal) é um dado cadastral. Ele não gera cobrança.

## 4. Papéis

Há dois logins. A função do integrante define o papel.

| Função | Papel | O que faz |
| --- | --- | --- |
| Professor(a) | Professor | Vê o dashboard, a agenda inteira e a lista de alunos, com telefone. Cria, edita, cancela e muda o status das aulas. |
| Sócio | Administrador | Faz o que o professor faz. Também cria, edita e inativa alunos e integrantes, cria e edita eventos, e cria, edita e apaga avisos. |

O sócio pode ser o responsável por uma aula ou por um plano semanal. O login dele continua de administrador.

O professor não abre a tela de equipe, não grava aluno, não grava evento e não grava aviso. Aviso ele apenas lê, no dashboard.

Não há cadastro público. O administrador cria cada conta e define a senha, com no mínimo 8 caracteres. A senha é entregue pessoalmente. A troca de senha também é feita por ele.

## 5. Regras de domínio

### 5.1 Aluno

Obrigatórios: nome, telefone, plano e categoria.

- Telefone brasileiro, com 10 ou 11 dígitos.
- Plano: Particular, Gympass ou Mensal.
- Categoria: D, C, B ou A.

E-mail é opcional. A busca encontra nome, e-mail ou telefone.

Dias da semana, horário de início e responsável entram os três juntos, ou ficam os três vazios. Vazio significa aluno cadastrado sem aula gerada. Preenchido forma o plano semanal: um horário só, o mesmo para todos os dias marcados, e um responsável.

A categoria fica só no aluno. A agenda mostra a categoria atual dele.

Apagar inativa. O histórico permanece. As aulas futuras ainda em Aguardando saem da agenda. Aulas futuras já Confirmada, Falta ou Cancelada permanecem. Aluno inativo não aparece em “alunos cadastrados” nem na busca de um agendamento novo.

A data de cadastro é gravada pelo sistema.

### 5.2 Aula e recorrência

Cada aula tem um aluno, um responsável, início, status e o marcador de experimental. Dura 60 minutos e começa e termina no mesmo dia.

O sistema recusa outro horário que cruze o mesmo responsável ou o mesmo aluno. Aula cancelada libera o horário. Evento de aniversário ou torneio não ocupa o horário da aula.

Status:

- Aguardando
- Confirmada
- Falta
- Cancelada

Toda aula nova nasce Aguardando. Administrador e professor podem mover o status entre esses quatro. Cancelar aula grava Cancelada.

Ao marcar Falta, o sistema oferece criar outra aula, ligada a essa, já identificada como reposição. A falta também pode ser salva sozinha. A reposição é uma aula avulsa, segue o mesmo ciclo de status e aponta para a aula de origem. Uma falta pode originar mais de uma reposição.

Aula experimental é avulsa. Pode usar um aluno já cadastrado ou um cadastro temporário, só com nome e telefone opcional, sem plano nem categoria. Esse cadastro não entra na lista de alunos nem na contagem de cadastrados. Avulsa, experimental e reposição ficam fora do plano semanal.

Um agendamento novo, de aula ou de evento, não aceita data anterior a hoje, no calendário de Brasília. Hoje continua válido. Editar uma aula que já existe não usa essa trava.

O plano gera ocorrências com início no futuro, até completar 8 semanas a partir de hoje. Todo dia, um agendamento estende esse horizonte. Ocorrência nova que cair em qualquer evento não é criada.

Mudar dias, horário ou responsável do plano recria só as ocorrências futuras ainda Aguardando e ainda ligadas ao plano. As demais permanecem.

Mudar aluno, responsável, data ou horário de um dia solta aquela ocorrência do plano. Mudar o status mantém o vínculo.

Depois que a aula começou, o status continua editável. Data e horário permanecem.

“Hoje”, “futura” e “já começou” usam o relógio de Brasília.

### 5.3 Evento

Tipos: Feriado, Agenda fechada, Ausência de professor, Aniversário e Torneio.

Nome, início e fim são obrigatórios. O fim é posterior ao início. O evento pode atravessar dias. Contato é opcional. Ausência aponta um responsável, e esse campo é obrigatório nesse tipo.

Qualquer evento ocupa a agenda inteira no intervalo. Uma aula nova que cruze esse horário é recusada, e um evento novo que cruze uma aula não cancelada também é recusado. Aula já marcada não é cancelada por causa do evento. Ausência continua exigindo o responsável, e o bloqueio vale para a escola toda, não só para essa pessoa. Apagar o evento libera o horário para um agendamento novo. Só o administrador cria, edita e apaga evento.

### 5.4 Aviso

Título e mensagem são obrigatórios. Os dois papéis veem a lista no dashboard, do mais recente para o mais antigo. O aviso permanece até o administrador editar ou apagar. Não tem data de validade e não é enviado ao aluno.

### 5.5 Equipe e sessão

Obrigatórios: nome, e-mail e função. Telefone e data de nascimento são opcionais. O e-mail de login é único.

Criar integrante já cria o login. Professor(a) entra como professor. Sócio entra como administrador.

Apagar inativa e corta o login na hora. A API recusa inativar quem ainda é responsável por um plano semanal de aluno ativo, ou por uma aula futura que não esteja cancelada. O administrador troca essa pessoa antes. O último administrador ativo também não pode ser inativado.

A sessão viaja num cookie httpOnly, Secure em produção, SameSite Lax, por 7 dias. O navegador envia o cookie sozinho. Trocar a senha ou inativar o integrante encerra a sessão antiga. Cada requisição autenticada confere se o integrante segue ativo.

O primeiro administrador nasce na subida da API, quando ainda não existe usuário. Nome, e-mail e senha vêm das variáveis de ambiente. A função dele é Sócio.

### 5.6 Dashboard

Os números usam o dia corrente em Brasília. Aula cancelada fica de fora das contagens de aula.

- **Aulas hoje:** aulas cujo início cai hoje.
- **Confirmadas:** aulas de hoje com status Confirmada.
- **Alunos cadastrados:** alunos ativos.
- **Alunos do dia:** alunos distintos com aula não cancelada hoje.
- **Próximo horário:** a aula não cancelada que ainda não terminou, a de início mais cedo. Se uma está em andamento, ela é a escolhida. Mostra aluno, categoria atual e responsável.
- **Eventos da semana:** eventos que cruzam a semana corrente, de segunda a domingo.
- **Avisos:** a lista descrita em 5.4.

## 6. Telas

A referência visual é o Canva. O comportamento abaixo é o contrato.

- **Login.** E-mail e senha. Sem botão de criar conta e sem recuperação de senha.
- **Dashboard.** Saudação da equipe, os números de 5.6, próximo horário, eventos da semana e avisos. Atalho para novo agendamento. O administrador também cria aviso daqui.
- **Agenda da semana.** Grade de segunda a domingo, com aulas e eventos. Dá para ir à semana anterior, à seguinte e a hoje.
- **Agenda do dia.** Aulas do dia em ordem de horário, com aluno, responsável, categoria, status e o marcador de experimental ou reposição.
- **Detalhe da aula.** Dados da aula e ações de editar, cancelar e mudar status. A oferta de reposição aparece ao marcar Falta.
- **Novo agendamento.** Primeiro a escolha entre aula e evento. Professor segue só para aula. Em seguida, o formulário correspondente.
- **Alunos.** Lista com nome, telefone, plano, categoria, cadastro e ações. Busca por nome, e-mail ou telefone. Formulário de criação e edição. Professor consulta a lista e o detalhe, sem gravar.
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

## 8. Critérios de aceite

1. Professor e sócio entram com e-mail e senha. Não existe tela de cadastro aberto nem de esqueci a senha.
2. Com o banco vazio, a primeira subida cria o sócio administrador a partir das variáveis de ambiente.
3. Sócio dá aula e continua com permissão de administrador. Professor não grava aluno, equipe, evento nem aviso.
4. Aluno sem dias, horário e responsável fica cadastrado e não ganha aula. Com os três preenchidos, surgem ocorrências futuras até 8 semanas, sempre às 60 minutos, no mesmo dia.
5. Dois horários que se cruzam para o mesmo responsável, ou para o mesmo aluno, são recusados. Aula cancelada não entra nessa conta.
6. Mudar o plano recria só as futuras Aguardando ainda ligadas a ele. Editar aluno, responsável, data ou horário de um dia deixa essa ocorrência de fora das próximas recriações.
7. Marcar Falta permite salvar só a falta, ou criar uma aula nova ligada a ela. A nova nasce Aguardando, fora do plano.
8. Qualquer evento recusa aula nova no intervalo, e qualquer aula não cancelada recusa evento novo no mesmo horário. Nada que já estava na agenda é cancelado por isso.
9. Depois do início da aula, o status muda e a data e o horário não mudam.
10. Inativar aluno remove as futuras Aguardando e preserva o histórico. Inativar integrante corta o login e é recusado enquanto essa pessoa tiver plano ativo ou aula futura não cancelada. O último administrador permanece.
11. Aviso fica no dashboard até o administrador editar ou apagar, do mais recente ao mais antigo.
12. O cookie de sessão dura 7 dias, não fica disponível ao JavaScript da página, e deixa de valer quando a senha muda ou o integrante é inativado.
13. O front e a API abrem no mesmo endereço da Heroku. O ambiente local sobe com dados de exemplo. Produção, fora o administrador inicial, não traz esses dados.
