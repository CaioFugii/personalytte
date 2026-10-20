import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ErroApi, mensagemDeErro } from '../api/client'
import { useSessao } from '../contexto/Sessao'
import { rotuloFuncao } from '../lib/rotulos'
import { Banner, cx, Marca } from './ui'

function classeLink({ isActive }: { isActive: boolean }) {
  return cx(
    'rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap',
    isActive ? 'bg-tide text-white' : 'text-ink hover:bg-sand',
  )
}

export function Layout() {
  const { usuario, sair, definirUsuario } = useSessao()
  const navigate = useNavigate()
  const location = useLocation()
  const [recado, setRecado] = useState<{ texto: string; tom: 'aviso' | 'ok' } | null>(null)
  const [erroSaida, setErroSaida] = useState<string | null>(null)
  const [saindo, setSaindo] = useState(false)

  useEffect(() => {
    const state = location.state as { aviso?: unknown; sucesso?: unknown } | null
    const sucesso = state && typeof state.sucesso === 'string' ? state.sucesso : ''
    const aviso = state && typeof state.aviso === 'string' ? state.aviso : ''
    if (sucesso || aviso) {
      setRecado(sucesso ? { texto: sucesso, tom: 'ok' } : { texto: aviso, tom: 'aviso' })
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
    }
  }, [location, navigate])

  async function aoSair() {
    setErroSaida(null)
    setSaindo(true)
    try {
      await sair()
    } catch (erro) {
      if (!(erro instanceof ErroApi && erro.status === 401)) {
        setErroSaida(mensagemDeErro(erro) || 'Não foi possível encerrar a sessão.')
        setSaindo(false)
        return
      }
      definirUsuario(null)
    }
    navigate('/login', { replace: true })
  }

  const admin = usuario?.papel === 'administrador'

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-paper lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <NavLink to="/" end className="rounded-md">
            <Marca />
          </NavLink>
          <div className="text-right lg:hidden">
            <p className="max-w-40 truncate text-sm font-semibold">{usuario?.nome}</p>
            <button type="button" onClick={() => void aoSair()} className="text-sm font-semibold text-tide-dark" disabled={saindo}>
              Sair
            </button>
          </div>
        </div>
        <nav aria-label="Principal" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col">
          <NavLink to="/" end className={classeLink}>
            Painel
          </NavLink>
          <NavLink to="/agenda" className={classeLink}>
            Agenda
          </NavLink>
          <NavLink to="/alunos" className={classeLink}>
            Alunos
          </NavLink>
          {admin ? (
            <NavLink to="/equipe" className={classeLink}>
              Equipe
            </NavLink>
          ) : null}
        </nav>
        <div className="mt-auto hidden border-t border-line p-4 lg:block">
          <p className="text-xs tracking-wide text-muted uppercase">Escola de beach tennis</p>
          <p className="mt-3 font-semibold">{usuario?.nome}</p>
          <p className="text-sm text-muted">{usuario ? rotuloFuncao(usuario.funcao) : ''}</p>
          <button
            type="button"
            onClick={() => void aoSair()}
            disabled={saindo}
            className="mt-3 text-sm font-semibold text-tide-dark disabled:opacity-50"
          >
            {saindo ? 'Saindo…' : 'Sair'}
          </button>
        </div>
      </aside>
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          {recado ? (
            <Banner tom={recado.tom} onFechar={() => setRecado(null)}>
              {recado.texto}
            </Banner>
          ) : null}
          {erroSaida ? <Banner tom="erro">{erroSaida}</Banner> : null}
          <Outlet />
        </div>
      </main>
    </div>
  )
}
