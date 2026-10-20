import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ErroApi, mensagemDeErro } from '../api/client'
import type { Funcao, Integrante } from '../api/types'
import { useGet } from '../api/useGet'
import { useConfirmacao } from '../componentes/confirmacao'
import { Banner, Botao, Cabecalho, Campo, classeCampo, LinkBotao, PainelEstado, useTitulo } from '../componentes/ui'
import { useSessao } from '../contexto/Sessao'
import { civilValida, digitosTelefone } from '../lib/calendario'
import { FUNCOES } from '../lib/rotulos'

type FormIntegrante = {
  nome: string
  email: string
  senha: string
  funcao: Funcao | ''
  telefone: string
  dataNascimento: string
}

const VAZIO: FormIntegrante = {
  nome: '',
  email: '',
  senha: '',
  funcao: '',
  telefone: '',
  dataNascimento: '',
}

function doIntegrante(pessoa: Integrante): FormIntegrante {
  return {
    nome: pessoa.nome ?? '',
    email: pessoa.email ?? '',
    senha: '',
    funcao: pessoa.funcao,
    telefone: digitosTelefone(pessoa.telefone ?? ''),
    dataNascimento: pessoa.dataNascimento ?? '',
  }
}

export function IntegranteFormulario({ modo }: { modo: 'novo' | 'editar' }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { usuario, definirUsuario } = useSessao()
  const listaQ = useGet<Integrante[]>(modo === 'editar' ? '/api/integrantes' : null)
  const lista = Array.isArray(listaQ.dados) ? listaQ.dados : null
  const integrante = lista?.find((pessoa) => pessoa.id === id) ?? null
  const naoEncontrado = Boolean(lista) && !integrante
  useTitulo(modo === 'novo' ? 'Novo integrante' : integrante?.nome || 'Integrante')

  const [chaveVista, setChaveVista] = useState<string | null>(null)
  const [form, setForm] = useState<FormIntegrante>(VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const { pedir, dialogo } = useConfirmacao()

  const chave = modo === 'novo' ? 'novo' : integrante?.id ?? null
  if (chave && chave !== chaveVista) {
    setChaveVista(chave)
    setForm(modo === 'novo' || !integrante ? VAZIO : doIntegrante(integrante))
  }

  const semEmail = modo === 'editar' && Boolean(integrante) && !integrante?.email

  async function aoEnviar(event: FormEvent) {
    event.preventDefault()
    if (semEmail) return
    setOk(null)
    if (!form.nome.trim() || !form.email.trim()) {
      setErro('Informe nome e e-mail.')
      return
    }
    if (!form.email.includes('@')) {
      setErro('Informe um e-mail válido.')
      return
    }
    if (!form.funcao) {
      setErro('Informe a função.')
      return
    }
    if (form.telefone && (form.telefone.length < 10 || form.telefone.length > 11)) {
      setErro('O telefone, se informado, precisa ter 10 ou 11 dígitos.')
      return
    }
    if (form.dataNascimento && !civilValida(form.dataNascimento)) {
      setErro('A data de nascimento não é válida.')
      return
    }
    if (modo === 'novo' && form.senha.length < 8) {
      setErro('A senha precisa ter no mínimo 8 caracteres.')
      return
    }
    if (modo === 'editar' && form.senha && form.senha.length < 8) {
      setErro('A senha precisa ter no mínimo 8 caracteres.')
      return
    }

    const corpo: Record<string, unknown> = {
      nome: form.nome.trim(),
      email: form.email.trim(),
      funcao: form.funcao,
      telefone: form.telefone ? form.telefone : null,
      dataNascimento: form.dataNascimento || null,
    }
    if (modo === 'novo' || form.senha) corpo.senha = form.senha

    setErro(null)
    setEnviando(true)
    try {
      if (modo === 'novo') {
        await api('/api/integrantes', { method: 'POST', body: JSON.stringify(corpo) })
        navigate('/equipe')
        return
      }
      await api(`/api/integrantes/${id}`, { method: 'PATCH', body: JSON.stringify(corpo) })
      if (form.senha && id === usuario?.id) {
        definirUsuario(null)
        navigate('/login', { replace: true })
        return
      }
      setForm((atual) => ({ ...atual, senha: '' }))
      setOk('Alterações salvas.')
      listaQ.recarregar()
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setEnviando(false)
    }
  }

  async function inativar() {
    if (!integrante) return
    const confirma = await pedir({
      titulo: 'Inativar integrante',
      mensagem: `Inativar ${integrante.nome}? O login deixa de funcionar na hora.`,
      confirmar: 'Inativar',
      perigo: true,
    })
    if (!confirma) return
    setErro(null)
    try {
      await api(`/api/integrantes/${integrante.id}/inativar`, { method: 'POST' })
      if (integrante.id === usuario?.id) {
        definirUsuario(null)
        navigate('/login', { replace: true })
        return
      }
      navigate('/equipe')
    } catch (err) {
      if (err instanceof ErroApi) setErro(err.mensagem)
      else setErro(mensagemDeErro(err))
    }
  }

  return (
    <div>
      {dialogo}
      <Cabecalho
        titulo={modo === 'novo' ? 'Novo integrante' : integrante?.nome || 'Integrante'}
        acoes={
          <LinkBotao to="/equipe" variante="secundario">
            Voltar à lista
          </LinkBotao>
        }
      />
      {modo === 'editar' && listaQ.carregando && !lista ? <PainelEstado status>Carregando…</PainelEstado> : null}
      {modo === 'editar' && listaQ.erro && !lista ? (
        <PainelEstado>
          <p className="mb-3 text-clay">{listaQ.erro}</p>
          <Botao variante="secundario" onClick={listaQ.recarregar}>
            Tentar de novo
          </Botao>
        </PainelEstado>
      ) : null}
      {naoEncontrado ? <Banner tom="erro">Integrante não encontrado.</Banner> : null}
      {listaQ.dados && !lista ? <Banner tom="erro">A resposta da lista veio em um formato inesperado.</Banner> : null}

      {(modo === 'novo' || integrante) && (
        <form onSubmit={(event) => void aoEnviar(event)} className="grid max-w-3xl gap-4 rounded-lg border border-line bg-paper p-4" noValidate>
          {erro ? <Banner tom="erro">{erro}</Banner> : null}
          {ok ? <Banner tom="ok">{ok}</Banner> : null}
          {semEmail ? (
            <Banner tom="erro">
              A lista não trouxe o e-mail deste integrante. A edição não é salva para não apagar o login.
            </Banner>
          ) : null}
          <p className="text-sm text-muted">Professor(a) entra como professor. Sócio entra como administrador.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo label="Nome" htmlFor="nome-equipe">
              <input
                id="nome-equipe"
                required
                value={form.nome}
                onChange={(event) => setForm({ ...form, nome: event.target.value })}
                className={classeCampo}
              />
            </Campo>
            <Campo label="E-mail" htmlFor="email-equipe">
              <input
                id="email-equipe"
                type="email"
                autoComplete="off"
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className={classeCampo}
              />
            </Campo>
            <Campo
              label={modo === 'novo' ? 'Senha inicial' : 'Senha (opcional)'}
              htmlFor="senha-equipe"
              dica={
                modo === 'novo'
                  ? 'Mínimo de 8 caracteres. A senha é entregue pessoalmente.'
                  : 'Deixe em branco para manter a senha. Se preencher, a sessão dessa pessoa termina.'
              }
            >
              <input
                id="senha-equipe"
                type="password"
                autoComplete="new-password"
                value={form.senha}
                onChange={(event) => setForm({ ...form, senha: event.target.value })}
                className={classeCampo}
              />
            </Campo>
            <Campo label="Função" htmlFor="funcao">
              <select
                id="funcao"
                required
                value={form.funcao}
                onChange={(event) => setForm({ ...form, funcao: event.target.value as Funcao | '' })}
                className={classeCampo}
              >
                <option value="">Selecione</option>
                {FUNCOES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Telefone (opcional)" htmlFor="telefone-equipe" dica="10 ou 11 dígitos, com DDD.">
              <input
                id="telefone-equipe"
                inputMode="numeric"
                value={form.telefone}
                onChange={(event) => setForm({ ...form, telefone: digitosTelefone(event.target.value) })}
                className={classeCampo}
              />
            </Campo>
            <Campo label="Data de nascimento (opcional)" htmlFor="nascimento">
              <input
                id="nascimento"
                type="date"
                value={form.dataNascimento}
                onChange={(event) => setForm({ ...form, dataNascimento: event.target.value })}
                className={classeCampo}
              />
            </Campo>
          </div>
          <div className="flex flex-wrap gap-2">
            <Botao type="submit" disabled={enviando || semEmail}>
              {enviando ? 'Salvando…' : modo === 'novo' ? 'Cadastrar integrante' : 'Salvar alterações'}
            </Botao>
            {modo === 'editar' ? (
              <Botao variante="perigo" onClick={() => void inativar()}>
                Inativar
              </Botao>
            ) : null}
          </div>
        </form>
      )}
    </div>
  )
}
