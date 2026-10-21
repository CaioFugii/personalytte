import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { api, mensagemDeErro } from '../api/client'
import type { Aluno, Categoria, DiaSemana, Plano, Responsavel } from '../api/types'
import { useGet } from '../api/useGet'
import { useConfirmacao } from '../componentes/confirmacao'
import { notificar, useNotificar } from '../componentes/toast'
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
import { digitosTelefone, horaCurta } from '../lib/calendario'
import { CATEGORIAS, DIAS, ordenarDias, PLANOS } from '../lib/rotulos'

type FormAluno = {
  nome: string
  telefone: string
  email: string
  instagram: string
  plano: Plano | ''
  categoria: Categoria | ''
  dias: DiaSemana[]
  horarioInicio: string
  responsavelId: string
}

const VAZIO: FormAluno = {
  nome: '',
  telefone: '',
  email: '',
  instagram: '',
  plano: '',
  categoria: '',
  dias: [],
  horarioInicio: '',
  responsavelId: '',
}

function doAluno(aluno: Aluno): FormAluno {
  return {
    nome: aluno.nome ?? '',
    telefone: digitosTelefone(aluno.telefone ?? ''),
    email: aluno.email ?? '',
    instagram: aluno.instagram ?? '',
    plano: aluno.plano,
    categoria: aluno.categoria,
    dias: ordenarDias(aluno.diasSemana ?? []),
    horarioInicio: horaCurta(aluno.horarioInicio),
    responsavelId: aluno.responsavelId ?? '',
  }
}

export function AlunoFormulario({ modo }: { modo: 'novo' | 'editar' }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { usuario } = useSessao()
  const admin = usuario?.papel === 'administrador'
  const somenteLeitura = modo === 'editar' && !admin
  const alunoQ = useGet<Aluno>(modo === 'editar' && id ? `/api/alunos/${id}` : null)
  const respQ = useGet<Responsavel[]>(modo === 'novo' && !admin ? null : '/api/integrantes/responsaveis')
  const aluno = alunoQ.dados
  useTitulo(modo === 'novo' ? 'Novo aluno' : aluno?.nome || 'Aluno')

  const [chaveVista, setChaveVista] = useState<string | null>(null)
  const [form, setForm] = useState<FormAluno>(VAZIO)
  const [enviando, setEnviando] = useState(false)
  const { pedir, dialogo } = useConfirmacao()
  useNotificar(respQ.erro ? 'erro' : null, respQ.erro)

  const chave = modo === 'novo' ? 'novo' : aluno?.id ?? null
  if (chave && chave !== chaveVista) {
    setChaveVista(chave)
    setForm(modo === 'novo' || !aluno ? VAZIO : doAluno(aluno))
  }

  if (modo === 'novo' && usuario && !admin) {
    return <Navigate to="/alunos" replace state={{ aviso: 'Só o administrador cadastra aluno.' }} />
  }

  const responsaveis = Array.isArray(respQ.dados) ? respQ.dados : []
  const opcoes = responsaveis.filter((pessoa) => pessoa.funcao === 'PROFESSOR')
  if (aluno?.responsavelId && !opcoes.some((item) => item.id === aluno.responsavelId)) {
    opcoes.unshift({ id: aluno.responsavelId, nome: 'Professor atual', funcao: 'PROFESSOR' })
  }
  opcoes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  function alternarDia(dia: DiaSemana) {
    setForm((atual) => ({
      ...atual,
      dias: atual.dias.includes(dia) ? atual.dias.filter((item) => item !== dia) : [...atual.dias, dia],
    }))
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
    if (!form.plano || !form.categoria) {
      notificar('erro', 'Informe o plano e a categoria.')
      return
    }
    const dias = ordenarDias(form.dias)
    const algum = dias.length > 0 || form.horarioInicio !== '' || form.responsavelId !== ''
    const todos = dias.length > 0 && form.horarioInicio !== '' && form.responsavelId !== ''
    if (algum && !todos) {
      notificar('erro', 'Preencha dias, horário e professor, ou deixe os três vazios.')
      return
    }
    const corpo = {
      nome: form.nome.trim(),
      telefone: form.telefone,
      email: form.email.trim() ? form.email.trim() : null,
      instagram: form.instagram.trim() ? form.instagram.trim() : null,
      plano: form.plano,
      categoria: form.categoria,
      diasSemana: todos ? dias : [],
      horarioInicio: todos ? form.horarioInicio : null,
      responsavelId: todos ? form.responsavelId : null,
    }
    setEnviando(true)
    try {
      if (modo === 'novo') {
        await api('/api/alunos', { method: 'POST', body: JSON.stringify(corpo) })
        navigate('/alunos', { state: { sucesso: 'Aluno cadastrado.' } })
        return
      }
      await api(`/api/alunos/${id}`, { method: 'PATCH', body: JSON.stringify(corpo) })
      notificar('ok', 'Alterações salvas.')
      alunoQ.recarregar()
    } catch (err) {
      notificar('erro', mensagemDeErro(err))
    } finally {
      setEnviando(false)
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
        descricao={somenteLeitura ? 'Consulta. Só o administrador altera o cadastro.' : undefined}
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
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <fieldset className="rounded-lg border border-line p-4" disabled={somenteLeitura}>
            <legend className="px-1 font-semibold">Plano semanal</legend>
            <p className="mb-3 text-sm text-muted">
              Dias, horário e professor entram os três juntos, ou ficam os três vazios. Vazio cadastra o aluno sem
              aula. Preenchido gera ocorrências por 8 semanas, sempre com 60 minutos.
            </p>
            <div className="mb-4 flex flex-wrap gap-3">
              {DIAS.map((dia) => (
                <label key={dia.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.dias.includes(dia.value)}
                    onChange={() => alternarDia(dia.value)}
                    className="accent-tide"
                  />
                  {dia.label}
                </label>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Campo label="Horário de início" htmlFor="horario" dica="Horário de Brasília">
                <input
                  id="horario"
                  type="time"
                  value={form.horarioInicio}
                  onChange={(event) => setForm({ ...form, horarioInicio: event.target.value })}
                  className={classeCampo}
                />
              </Campo>
              <Campo label="Professor" htmlFor="responsavel-plano">
                <select
                  id="responsavel-plano"
                  value={form.responsavelId}
                  onChange={(event) => setForm({ ...form, responsavelId: event.target.value })}
                  className={classeCampo}
                >
                  <option value="">Nenhum</option>
                  {opcoes.map((pessoa) => (
                    <option key={pessoa.id} value={pessoa.id}>
                      {pessoa.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
          </fieldset>
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
