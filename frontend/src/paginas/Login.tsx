import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { mensagemDeErro } from '../api/client'
import { useSessao } from '../contexto/Sessao'
import { notificar } from '../componentes/toast'
import { Botao, Campo, CarregandoTela, classeCampo, useTitulo } from '../componentes/ui'

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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-end px-6 py-12 sm:px-12">
        <p className="font-display max-w-[10ch] text-6xl leading-none font-bold text-tide sm:text-7xl">Personalytte</p>
        <p className="mt-4 max-w-[28ch] text-lg leading-snug">Painel da equipe. Escola de beach tennis.</p>
      </div>
      <div className="flex items-center border-line bg-paper px-6 py-12 sm:px-12 lg:border-l">
        <form onSubmit={(event) => void aoEnviar(event)} className="w-full max-w-sm" noValidate>
          <h1 className="text-4xl font-bold">Entrar</h1>
          <p className="mt-2 mb-6 max-w-[36ch] text-sm leading-relaxed text-muted">Use o e-mail e a senha que o administrador passou.</p>
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
