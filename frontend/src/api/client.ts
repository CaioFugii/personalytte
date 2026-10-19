// O cookie httpOnly vai sozinho. Nada de sessão fica em localStorage ou sessionStorage.

type OpcoesApi = Omit<RequestInit, 'credentials'> & {
  redirectOn401?: boolean
}

export class ErroApi extends Error {
  readonly status: number
  readonly codigo: string
  readonly mensagem: string

  constructor(status: number, codigo: string, mensagem: string) {
    super(mensagem)
    this.name = 'ErroApi'
    this.status = status
    this.codigo = codigo
    this.mensagem = mensagem
  }
}

export function abortou(erro: unknown): boolean {
  return erro instanceof Error && erro.name === 'AbortError'
}

export function mensagemDeErro(erro: unknown): string {
  if (abortou(erro)) return ''
  if (erro instanceof ErroApi) return erro.mensagem
  return 'Não foi possível falar com o servidor.'
}

export function temId(valor: unknown): valor is { id: string } {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    'id' in valor &&
    typeof valor.id === 'string' &&
    valor.id.length > 0
  )
}

export async function api<T>(caminho: string, opcoes: OpcoesApi = {}): Promise<T> {
  const { redirectOn401 = true, ...init } = opcoes
  const headers = new Headers(init.headers)
  if (init.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let resposta: Response
  try {
    resposta = await fetch(caminho, {
      ...init,
      headers,
      credentials: 'include',
    })
  } catch (erro) {
    if (abortou(erro)) throw erro
    throw new ErroApi(0, 'REDE', 'Não foi possível falar com o servidor.')
  }

  if (resposta.status === 204 || resposta.status === 205) {
    return undefined as T
  }

  const texto = await resposta.text()
  let corpo: unknown = null
  if (texto) {
    try {
      corpo = JSON.parse(texto) as unknown
    } catch {
      corpo = null
    }
  }

  if (!resposta.ok) {
    const registro =
      corpo && typeof corpo === 'object'
        ? (corpo as { codigo?: unknown; mensagem?: unknown })
        : {}
    const mensagem =
      typeof registro.mensagem === 'string' && registro.mensagem.trim()
        ? registro.mensagem
        : 'Não foi possível concluir a operação.'
    const codigo = typeof registro.codigo === 'string' ? registro.codigo : 'ERRO'
    const metodo = (init.method ?? 'GET').toUpperCase()
    const ehLogin = caminho === '/api/sessao' && metodo === 'POST'
    if (resposta.status === 401 && redirectOn401 && !ehLogin && window.location.pathname !== '/login') {
      window.location.assign('/login')
      return new Promise(() => {})
    }
    throw new ErroApi(resposta.status, codigo, mensagem)
  }

  return corpo as T
}
