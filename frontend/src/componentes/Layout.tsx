import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ErroApi, mensagemDeErro } from '../api/client'
import { useSessao } from '../contexto/Sessao'
import { rotuloFuncao } from '../lib/rotulos'
import { Banner, cx, Marca } from './ui'

function classeLink({ isActive }: { isActive: boolean }) {
  return cx(
    'rounded-full px-3 py-2 text-sm font-semibold whitespace-nowrap',
    isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10',
  )
}

function inicial(nome: string | undefined) {
  const letra = nome?.trim().charAt(0).toUpperCase()
  return letra || '?'
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
      <aside className="bg-sidebar text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-5">
          <NavLink to="/" end className="rounded-md">
            <Marca clara />
          </NavLink>
          <div className="text-right lg:hidden">
            <p className="max-w-40 truncate text-sm font-semibold">{usuario?.nome}</p>
            <button type="button" onClick={() => void aoSair()} className="text-sm font-semibold text-lime" disabled={saindo}>
              Sair
            </button>
          </div>
        </div>
        <nav aria-label="Principal" className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col">
          <p className="hidden px-3 pt-2 pb-1 text-[11px] font-bold tracking-[0.14em] text-white/45 uppercase lg:block">
            Visão geral
          </p>
          <NavLink to="/" end className={classeLink}>
            Painel
          </NavLink>
          <NavLink to="/agenda" className={classeLink}>
            Agenda
          </NavLink>
          <p className="hidden px-3 pt-4 pb-1 text-[11px] font-bold tracking-[0.14em] text-white/45 uppercase lg:block">
            Gestão
          </p>
          <NavLink to="/alunos" className={classeLink}>
            Alunos
          </NavLink>
          {admin ? (
            <NavLink to="/equipe" className={classeLink}>
              Equipe
            </NavLink>
          ) : null}
        </nav>
        <div className="mt-auto hidden p-4 lg:block">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-lime text-sm font-bold text-sidebar">
              {inicial(usuario?.nome)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{usuario?.nome}</p>
              <p className="truncate text-xs text-white/60">{usuario ? rotuloFuncao(usuario.funcao) : ''}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void aoSair()}
            disabled={saindo}
            className="mt-3 text-sm font-semibold text-lime disabled:opacity-50"
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
