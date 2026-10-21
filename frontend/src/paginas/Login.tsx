import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { mensagemDeErro } from '../api/client'
import { useSessao } from '../contexto/Sessao'
import { notificar } from '../componentes/toast'
import { Botao, Campo, CarregandoTela, classeCampo, Marca, useTitulo } from '../componentes/ui'

function destinoSeguro(state: unknown): string {
  const from = state && typeof state === 'object' && 'from' in state ? (state as { from?: unknown }).from : null
  if (typeof from !== 'string') return '/'
  if (!from.startsWith('/') || from.startsWith('//') || from.startsWith('/login')) return '/'
  return from
}

export function Login() {
  const { usuario, carregando, entrar } = useSessao()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  useTitulo('Entrar')

  if (carregando) return <CarregandoTela />
  if (usuario) return <Navigate to={destinoSeguro(location.state)} replace />

  async function aoEnviar(event: FormEvent) {
    event.preventDefault()
    setEnviando(true)
    try {
      await entrar(email.trim(), senha)
      navigate(destinoSeguro(location.state), { replace: true })
    } catch (err) {
      notificar('erro', mensagemDeErro(err))
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Marca />
          <p className="mt-3 text-muted">Painel da equipe. Escola de beach tennis.</p>
        </div>
        <form onSubmit={(event) => void aoEnviar(event)} className="rounded-3xl bg-paper p-6 shadow-[0_16px_40px_rgba(14,60,67,0.08)]" noValidate>
          <h1 className="text-2xl font-bold tracking-tight">Entrar</h1>
          <p className="mt-1 mb-5 text-sm text-muted">Use o e-mail e a senha que o administrador passou.</p>
          <div className="grid gap-4">
            <Campo label="E-mail" htmlFor="email">
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={classeCampo}
              />
            </Campo>
            <Campo label="Senha" htmlFor="senha">
              <input
                id="senha"
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                className={classeCampo}
              />
            </Campo>
            <Botao type="submit" disabled={enviando} className="w-full">
              {enviando ? 'Entrando…' : 'Entrar'}
            </Botao>
          </div>
        </form>
      </div>
    </div>
  )
}
