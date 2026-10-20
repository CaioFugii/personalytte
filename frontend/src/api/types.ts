export type Funcao = 'PROFESSOR' | 'SOCIO'
export type Papel = 'professor' | 'administrador'
export type Plano = 'PARTICULAR' | 'GYMPASS' | 'MENSAL'
export type Categoria = 'D' | 'C' | 'B' | 'A'
export type DiaSemana = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom'
export type StatusAula = 'AGUARDANDO' | 'CONFIRMADA' | 'FALTA' | 'CANCELADA'
export type TipoEvento = 'FERIADO' | 'AGENDA_FECHADA' | 'AUSENCIA' | 'ANIVERSARIO' | 'TORNEIO'

export type IntegranteAtual = {
  id: string
  nome: string
  email: string
  funcao: Funcao
  papel: Papel
  ativo: boolean
}

export type Integrante = {
  id: string
  nome: string
  email?: string
  telefone?: string | null
  funcao: Funcao
  papel?: Papel
  dataNascimento?: string | null
  cadastradoEm?: string
  ativo?: boolean
}

export type Responsavel = {
  id: string
  nome: string
  funcao: Funcao
}

export type Aluno = {
  id: string
  nome: string
  telefone: string
  email: string | null
  plano: Plano
  categoria: Categoria
  diasSemana: DiaSemana[] | null
  horarioInicio: string | null
  responsavelId: string | null
  ativo: boolean
  cadastradoEm: string
}

export type Aula = {
  id: string
  aluno: { id: string; nome: string; categoria: Categoria | null; telefone: string | null; temporario: boolean }
  responsavel: { id: string; nome: string }
  inicio: string
  fim: string
  status: StatusAula
  experimental: boolean
  reposicaoDeAulaId: string | null
  ligadaAoPlano: boolean
}

export type Evento = {
  id?: string
  tipo: TipoEvento
  nome: string
  inicio: string
  fim: string
  contato?: string | null
  bloqueiaAulas?: boolean
  responsavelId?: string | null
  responsavel?: { id: string; nome: string } | null
}

export type Aviso = {
  id?: string
  titulo: string
  mensagem: string
}

export type Dashboard = {
  aulasHoje: number
  confirmadas: number
  alunosCadastrados: number
  alunosDoDia: number
  proximoHorario: Aula | null
  eventosDaSemana: Evento[]
  avisos: Aviso[]
}
