import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, mensagemDeErro } from '../api/client'
import type { Aluno } from '../api/types'
import { useGet } from '../api/useGet'
import { useConfirmacao } from '../componentes/confirmacao'
import { Banner, Botao, Cabecalho, classeCampo, LinkBotao, PainelEstado, SeloCategoria, useTitulo } from '../componentes/ui'
import { useSessao } from '../contexto/Sessao'
import { useBusca } from '../lib/busca'
import { formatarCadastro, formatarTelefone } from '../lib/calendario'
import { rotuloPlano } from '../lib/rotulos'

export function Alunos() {
  useTitulo('Alunos')
  const { usuario } = useSessao()
  const admin = usuario?.papel === 'administrador'
  const { busca, texto, setTexto } = useBusca()
  const caminho = busca ? `/api/alunos?busca=${encodeURIComponent(busca)}` : '/api/alunos'
  const consulta = useGet<Aluno[]>(caminho)
  const lista = Array.isArray(consulta.dados) ? consulta.dados : null
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [pendente, setPendente] = useState<string | null>(null)
  const { pedir, dialogo } = useConfirmacao()

  async function inativar(aluno: Aluno) {
    const confirma = await pedir({
      titulo: 'Inativar aluno',
      mensagem: `Inativar ${aluno.nome}? As aulas futuras ainda em Aguardando saem da agenda.`,
      confirmar: 'Inativar',
      perigo: true,
    })
    if (!confirma) return
    setPendente(aluno.id)
    setErroAcao(null)
    try {
      await api(`/api/alunos/${aluno.id}/inativar`, { method: 'POST' })
      consulta.recarregar()
    } catch (erro) {
      setErroAcao(mensagemDeErro(erro))
    } finally {
      setPendente(null)
    }
  }

  return (
    <div>
      {dialogo}
      <Cabecalho
        titulo="Alunos"
        descricao={admin ? 'Cadastro ativo da escola.' : 'Consulta. Só o administrador altera o cadastro.'}
        acoes={admin ? <LinkBotao to="/alunos/novo">Novo aluno</LinkBotao> : undefined}
      />
      <form role="search" className="mb-4" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="busca-alunos" className="mb-1 block text-sm font-semibold">
          Busca
        </label>
        <input
          id="busca-alunos"
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          placeholder="Nome, e-mail ou telefone"
          autoComplete="off"
          className={classeCampo}
        />
      </form>
      {erroAcao ? <Banner tom="erro">{erroAcao}</Banner> : null}
      {consulta.carregando && !lista ? <PainelEstado status>Carregando…</PainelEstado> : null}
      {consulta.erro && !lista ? (
        <PainelEstado>
          <p className="mb-3 text-clay">{consulta.erro}</p>
          <Botao variante="secundario" onClick={consulta.recarregar}>
            Tentar de novo
          </Botao>
        </PainelEstado>
      ) : null}
      {consulta.dados && !lista ? <Banner tom="erro">A resposta da lista veio em um formato inesperado.</Banner> : null}
      {lista ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-paper">
          {consulta.carregando ? (
            <p role="status" className="px-3 py-2 text-sm text-muted">
              Atualizando…
            </p>
          ) : null}
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-sand/80 text-left text-muted">
              <tr>
                <th className="px-3 py-2 font-medium" scope="col">Nome</th>
                <th className="px-3 py-2 font-medium" scope="col">Telefone</th>
                <th className="px-3 py-2 font-medium" scope="col">Plano</th>
                <th className="px-3 py-2 font-medium" scope="col">Categoria</th>
                <th className="px-3 py-2 font-medium" scope="col">Cadastro</th>
                <th className="px-3 py-2 font-medium" scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-muted">
                    {busca ? 'Nenhum aluno encontrado.' : 'Nenhum aluno cadastrado.'}
                  </td>
                </tr>
              ) : (
                lista.map((aluno) => (
                  <tr key={aluno.id} className="border-t border-line">
                    <td className="px-3 py-3 font-semibold">{aluno.nome}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatarTelefone(aluno.telefone)}</td>
                    <td className="px-3 py-3">{rotuloPlano(aluno.plano)}</td>
                    <td className="px-3 py-3">
                      <SeloCategoria categoria={aluno.categoria} />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatarCadastro(aluno.cadastradoEm)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link to={`/alunos/${aluno.id}`} className="font-semibold text-tide-dark">
                          {admin ? 'Editar' : 'Ver'}
                        </Link>
                        {admin ? (
                          <button
                            type="button"
                            className="font-semibold text-clay disabled:opacity-50"
                            disabled={pendente === aluno.id}
                            onClick={() => void inativar(aluno)}
                          >
                            Inativar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
