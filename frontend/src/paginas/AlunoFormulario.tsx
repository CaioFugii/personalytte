import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { api, mensagemDeErro } from '../api/client'
import type { Aluno, Categoria, Genero, Plano } from '../api/types'
import { useGet } from '../api/useGet'
import { useConfirmacao } from '../componentes/confirmacao'
import { notificar } from '../componentes/toast'
import {
  Botao,
  Cabecalho,
  Campo,
  classeCampo,
  LinkBotao,
  PainelEstado,
  useTitulo,
} from '../componentes/ui'
import { useSessao } from '../contexto/Sessao'
import { civilValida, digitosTelefone } from '../lib/calendario'
import { CATEGORIAS, GENEROS, PLANOS } from '../lib/rotulos'

type FormAluno = {
  nome: string
  telefone: string
  email: string
  instagram: string
  dataNascimento: string
  plano: Plano | ''
  categoria: Categoria | ''
  genero: Genero | ''
}

const VAZIO: FormAluno = {
  nome: '',
  telefone: '',
  email: '',
  instagram: '',
  dataNascimento: '',
  plano: '',
  categoria: '',
  genero: '',
}

function doAluno(aluno: Aluno): FormAluno {
  return {
    nome: aluno.nome ?? '',
    telefone: digitosTelefone(aluno.telefone ?? ''),
    email: aluno.email ?? '',
    instagram: aluno.instagram ?? '',
    dataNascimento: aluno.dataNascimento ?? '',
    plano: aluno.plano,
    categoria: aluno.categoria,
    genero: aluno.genero ?? '',
  }
}

export function AlunoFormulario({ modo }: { modo: 'novo' | 'editar' }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { usuario } = useSessao()
  const admin = usuario?.papel === 'administrador'
  const alunoQ = useGet<Aluno>(modo === 'editar' && id ? `/api/alunos/${id}` : null)
  const aluno = alunoQ.dados
  const inativo = aluno?.ativo === false
  const somenteLeitura = modo === 'editar' && (!admin || inativo)
  useTitulo(modo === 'novo' ? 'Novo aluno' : aluno?.nome || 'Aluno')

  const [chaveVista, setChaveVista] = useState<string | null>(null)
  const [form, setForm] = useState<FormAluno>(VAZIO)
  const [enviando, setEnviando] = useState(false)
  const { pedir, dialogo } = useConfirmacao()

  const chave = modo === 'novo' ? 'novo' : aluno?.id ?? null
  if (chave && chave !== chaveVista) {
    setChaveVista(chave)
    setForm(modo === 'novo' || !aluno ? VAZIO : doAluno(aluno))
  }

  if (modo === 'novo' && usuario && !admin) {
    return <Navigate to="/alunos" replace state={{ aviso: 'Só o administrador cadastra aluno.' }} />
  }

  async function aoEnviar(event: FormEvent) {
    event.preventDefault()
    if (somenteLeitura) return
    if (!form.nome.trim()) {
      notificar('erro', 'Informe o nome.')
      return
    }
    if (form.telefone.length < 10 || form.telefone.length > 11) {
      notificar('erro', 'Informe um telefone com 10 ou 11 dígitos.')
      return
    }
    if (!form.genero) {
      notificar('erro', 'Informe o gênero.')
      return
    }
    if (!form.plano || !form.categoria) {
      notificar('erro', 'Informe o plano e a categoria.')
      return
    }
    if (form.dataNascimento && !civilValida(form.dataNascimento)) {
      notificar('erro', 'A data de nascimento não é válida.')
      return
    }
    const corpo = {
      nome: form.nome.trim(),
      telefone: form.telefone,
      email: form.email.trim() ? form.email.trim() : null,
      instagram: form.instagram.trim() ? form.instagram.trim() : null,
      dataNascimento: form.dataNascimento || null,
      plano: form.plano,
      categoria: form.categoria,
      genero: form.genero,
    }
    setEnviando(true)
    try {
      if (modo === 'novo') {
        await api('/api/alunos', { method: 'POST', body: JSON.stringify(corpo) })
        navigate('/alunos', { state: { sucesso: 'Aluno cadastrado.' } })
        return
      }
      await api(`/api/alunos/${id}`, { method: 'PATCH', body: JSON.stringify(corpo) })
      navigate('/alunos', { state: { sucesso: 'Alterações salvas.' } })
    } catch (err) {
      notificar('erro', mensagemDeErro(err))
    } finally {
      setEnviando(false)
    }
  }

  async function reativar() {
    if (!aluno) return
    const confirma = await pedir({
      titulo: 'Reativar aluno',
      mensagem: `Reativar ${aluno.nome}? As aulas que saíram na inativação não voltam. O plano semanal só gera aula de novo se for alterado.`,
      confirmar: 'Reativar',
    })
    if (!confirma) return
    try {
      await api(`/api/alunos/${aluno.id}/reativar`, { method: 'POST' })
      notificar('ok', 'Aluno reativado.')
      alunoQ.recarregar()
    } catch (err) {
      notificar('erro', mensagemDeErro(err))
    }
  }

  async function inativar() {
    if (!aluno) return
    const confirma = await pedir({
      titulo: 'Inativar aluno',
      mensagem: `Inativar ${aluno.nome}? As aulas futuras ainda em Aguardando saem da agenda.`,
      confirmar: 'Inativar',
      perigo: true,
    })
    if (!confirma) return
    try {
      await api(`/api/alunos/${aluno.id}/inativar`, { method: 'POST' })
      navigate('/alunos')
    } catch (err) {
      notificar('erro', mensagemDeErro(err))
    }
  }

  const carregando = modo === 'editar' && alunoQ.carregando && !aluno

  return (
    <div>
      {dialogo}
      <Cabecalho
        sobretitulo="Relacionamento"
        titulo={modo === 'novo' ? 'Novo aluno' : aluno?.nome || 'Aluno'}
        descricao={
          inativo
            ? 'Aluno inativo. O cadastro permanece só para consulta.'
            : somenteLeitura
              ? 'Consulta. Só o administrador altera o cadastro.'
              : undefined
        }
        acoes={
          <LinkBotao to="/alunos" variante="secundario">
            Voltar à lista
          </LinkBotao>
        }
      />
      {carregando ? <PainelEstado status>Carregando…</PainelEstado> : null}
      {modo === 'editar' && alunoQ.erro && !aluno ? (
        <PainelEstado>
          <p className="mb-3 text-clay">{alunoQ.erro}</p>
          <Botao variante="secundario" onClick={alunoQ.recarregar}>
            Tentar de novo
          </Botao>
        </PainelEstado>
      ) : null}
      {(modo === 'novo' || aluno) && (
        <form onSubmit={(event) => void aoEnviar(event)} className="grid max-w-3xl gap-4 rounded-2xl bg-paper p-5 shadow-[0_10px_28px_rgba(14,60,67,0.06)]" noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo label="Nome" htmlFor="nome">
              <input
                id="nome"
                required
                readOnly={somenteLeitura}
                value={form.nome}
                onChange={(event) => setForm({ ...form, nome: event.target.value })}
                className={classeCampo}
              />
            </Campo>
            <Campo label="Telefone" htmlFor="telefone" dica="10 ou 11 dígitos, com DDD.">
              <input
                id="telefone"
                inputMode="numeric"
                required
                readOnly={somenteLeitura}
                value={form.telefone}
                onChange={(event) => setForm({ ...form, telefone: digitosTelefone(event.target.value) })}
                className={classeCampo}
              />
            </Campo>
            <Campo label="Instagram (opcional)" htmlFor="instagram" dica="Usuário do perfil, para marcação nos stories. Sem o endereço.">
              <input
                id="instagram"
                readOnly={somenteLeitura}
                value={form.instagram}
                onChange={(event) => setForm({ ...form, instagram: event.target.value })}
                className={classeCampo}
                autoComplete="off"
              />
            </Campo>
            <Campo label="Data de nascimento (opcional)" htmlFor="nascimento">
              <input
                id="nascimento"
                type="date"
                readOnly={somenteLeitura}
                value={form.dataNascimento}
                onChange={(event) => setForm({ ...form, dataNascimento: event.target.value })}
                className={classeCampo}
              />
            </Campo>
            <Campo label="E-mail (opcional)" htmlFor="email">
              <input
                id="email"
                type="email"
                readOnly={somenteLeitura}
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className={classeCampo}
              />
            </Campo>
            <Campo label="Gênero" htmlFor="genero">
              <select
                id="genero"
                required
                disabled={somenteLeitura}
                value={form.genero}
                onChange={(event) => setForm({ ...form, genero: event.target.value as Genero | '' })}
                className={classeCampo}
              >
                <option value="">Selecione</option>
                {GENEROS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Plano" htmlFor="plano">
              <select
                id="plano"
                required
                disabled={somenteLeitura}
                value={form.plano}
                onChange={(event) => setForm({ ...form, plano: event.target.value as Plano | '' })}
                className={classeCampo}
              >
                <option value="">Selecione</option>
                {PLANOS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Categoria" htmlFor="categoria">
              <select
                id="categoria"
                required
                disabled={somenteLeitura}
                value={form.categoria}
                onChange={(event) => setForm({ ...form, categoria: event.target.value as Categoria | '' })}
                className={classeCampo}
              >
                <option value="">Selecione</option>
                {CATEGORIAS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          {inativo && admin ? (
            <div className="flex flex-wrap gap-2">
              <Botao type="button" onClick={() => void reativar()}>
                Reativar
              </Botao>
            </div>
          ) : null}
          {!somenteLeitura ? (
            <div className="flex flex-wrap gap-2">
              <Botao type="submit" disabled={enviando}>
                {enviando ? 'Salvando…' : modo === 'novo' ? 'Cadastrar aluno' : 'Salvar alterações'}
              </Botao>
              {modo === 'editar' && admin ? (
                <Botao variante="perigo" onClick={() => void inativar()}>
                  Inativar
                </Botao>
              ) : null}
            </div>
          ) : null}
        </form>
      )}
    </div>
  )
}
