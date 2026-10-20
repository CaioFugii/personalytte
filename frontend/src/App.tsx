import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, type Location } from 'react-router-dom'
import { Layout } from './componentes/Layout'
import { CarregandoTela, LinkBotao, useTitulo } from './componentes/ui'
import { SessaoProvider, useSessao } from './contexto/Sessao'
import { Login } from './paginas/Login'
import { Painel } from './paginas/Painel'
import { AgendaSemana } from './paginas/AgendaSemana'
import { AgendaDia } from './paginas/AgendaDia'
import { AulaDetalhe } from './paginas/AulaDetalhe'
import { EditarEvento, ModalEscolha, NovoAgendamento } from './paginas/NovoAgendamento'
import { Alunos } from './paginas/Alunos'
import { AlunoFormulario } from './paginas/AlunoFormulario'
import { Equipe } from './paginas/Equipe'
import { IntegranteFormulario } from './paginas/IntegranteFormulario'

function destinoAtual(pathname: string, search: string): string {
  const destino = `${pathname}${search}`
  if (!destino.startsWith('/') || destino.startsWith('//') || destino.startsWith('/login')) return '/'
  return destino
}

function RotaPrivada() {
  const { usuario, carregando } = useSessao()
  const location = useLocation()
  if (carregando) return <CarregandoTela />
  if (!usuario) {
    return <Navigate to="/login" replace state={{ from: destinoAtual(location.pathname, location.search) }} />
  }
  return <Outlet />
}

function RotaAdministrador() {
  const { usuario } = useSessao()
  if (usuario?.papel !== 'administrador') {
    return <Navigate to="/" replace state={{ aviso: 'Essa área é só do administrador.' }} />
  }
  return <Outlet />
}

function PaginaAusente() {
  useTitulo('Página não encontrada')
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Esta página não existe.</h1>
      <p className="mt-2 mb-4 text-muted">O endereço não faz parte do painel.</p>
      <LinkBotao to="/" variante="secundario">
        Voltar ao painel
      </LinkBotao>
    </div>
  )
}

function Rotas() {
  const location = useLocation()
  const { usuario } = useSessao()
  const estado = location.state as { fundo?: Location } | null
  const tipo = new URLSearchParams(location.search).get('tipo')
  const escolha = location.pathname === '/agenda/novo' && tipo !== 'aula' && tipo !== 'evento'
  const fundo =
    estado?.fundo ??
    ({ pathname: '/agenda', search: '', hash: '', state: null, key: 'fundo' } as Location)

  return (
    <>
      <Routes location={escolha ? fundo : location}>
        <Route path="/login" element={<Login />} />
        <Route element={<RotaPrivada />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Painel />} />
            <Route path="/agenda" element={<AgendaSemana />} />
            <Route path="/agenda/dia" element={<AgendaDia />} />
            <Route path="/agenda/aulas/:id" element={<AulaDetalhe />} />
            <Route path="/agenda/novo" element={<NovoAgendamento />} />
            <Route path="/alunos" element={<Alunos />} />
            <Route path="/alunos/novo" element={<AlunoFormulario modo="novo" />} />
            <Route path="/alunos/:id" element={<AlunoFormulario modo="editar" />} />
            <Route element={<RotaAdministrador />}>
              <Route path="/agenda/eventos/:id" element={<EditarEvento />} />
              <Route path="/equipe" element={<Equipe />} />
              <Route path="/equipe/novo" element={<IntegranteFormulario modo="novo" />} />
              <Route path="/equipe/:id" element={<IntegranteFormulario modo="editar" />} />
            </Route>
            <Route path="*" element={<PaginaAusente />} />
          </Route>
        </Route>
      </Routes>
      {escolha && usuario ? <ModalEscolha /> : null}
    </>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <SessaoProvider>
        <Rotas />
      </SessaoProvider>
    </BrowserRouter>
  )
}
