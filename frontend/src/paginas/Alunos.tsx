import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, mensagemDeErro } from '../api/client'
import type { Aluno } from '../api/types'
import { useGet } from '../api/useGet'
import { useConfirmacao } from '../componentes/confirmacao'
import { notificar, useNotificar } from '../componentes/toast'
import { Botao, Cabecalho, classeBotao, classeBusca, classeIconeAcao, classeTabela, classeThead, cx, IconeLapis, LinkBotao, PainelEstado, SeloCategoria, useTitulo } from '../componentes/ui'
import { useSessao } from '../contexto/Sessao'
import { useBusca } from '../lib/busca'
import { formatarCadastro, formatarTelefone } from '../lib/calendario'
import { rotuloGenero, rotuloPlano } from '../lib/rotulos'

export function Alunos() {
  useTitulo('Alunos')
  const { usuario } = useSessao()
  const admin = usuario?.papel === 'administrador'
  const { busca, texto, setTexto } = useBusca()
  const caminho = busca
    ? `/api/alunos?incluirInativos=1&busca=${encodeURIComponent(busca)}`
    : '/api/alunos?incluirInativos=1'
  const consulta = useGet<Aluno[]>(caminho)
  const lista = Array.isArray(consulta.dados) ? consulta.dados : null
  const [pendente, setPendente] = useState<string | null>(null)
  useNotificar(consulta.dados && !lista ? 'erro' : null, 'A resposta da lista veio em um formato inesperado.')
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
    try {
      await api(`/api/alunos/${aluno.id}/inativar`, { method: 'POST' })
      consulta.recarregar()
    } catch (erro) {
      notificar('erro', mensagemDeErro(erro))
    } finally {
      setPendente(null)
    }
  }

  return (
    <div>
      {dialogo}
      <Cabecalho
        sobretitulo="Relacionamento"
        titulo="Alunos"
        descricao={admin ? 'Cadastro da escola, com alunos ativos e inativos.' : 'Consulta, com alunos ativos e inativos. Só o administrador altera o cadastro.'}
        acoes={admin ? <LinkBotao to="/alunos/novo">+ Novo aluno</LinkBotao> : undefined}
      />
      <form role="search" className="mb-4" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="busca-alunos" className="sr-only">
          Busca
        </label>
        <input
          id="busca-alunos"
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          placeholder="Buscar aluno por nome, e-mail, telefone ou Instagram"
          autoComplete="off"
          className={classeBusca}
        />
      </form>
      {consulta.carregando && !lista ? <PainelEstado status>Carregando…</PainelEstado> : null}
      {consulta.erro && !lista ? (
        <PainelEstado>
          <p className="mb-3 text-clay">{consulta.erro}</p>
          <Botao variante="secundario" onClick={consulta.recarregar}>
            Tentar de novo
          </Botao>
        </PainelEstado>
      ) : null}
      {lista ? (
        <div className={classeTabela}>
          {consulta.carregando ? (
            <p role="status" className="px-3 py-2 text-sm text-muted">
              Atualizando…
            </p>
          ) : null}
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className={classeThead}>
              <tr>
                <th className="px-3 py-3" scope="col">Nome</th>
                <th className="px-3 py-3" scope="col">Telefone</th>
                <th className="px-3 py-3" scope="col">Instagram</th>
                <th className="px-3 py-3" scope="col">Plano</th>
                <th className="px-3 py-3" scope="col">Categoria</th>
                <th className="px-3 py-3" scope="col">Gênero</th>
                <th className="px-3 py-3" scope="col">Cadastro</th>
                <th className="px-3 py-3 text-right" scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-muted">
                    {busca ? 'Nenhum aluno encontrado.' : 'Nenhum aluno cadastrado.'}
                  </td>
                </tr>
              ) : (
                lista.map((aluno) => (
                  <tr key={aluno.id} className={cx('border-t border-line', !aluno.ativo && 'text-muted')}>
                    <td className="px-3 py-3 font-semibold text-ink">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {aluno.nome}
                        {aluno.ativo ? null : (
                          <span className="inline-flex rounded-full bg-[#e7e4de] px-2 py-0.5 text-xs font-semibold text-ink">
                            Inativo
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatarTelefone(aluno.telefone)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {aluno.instagram ? (
                        <a href={`https://instagram.com/${aluno.instagram}`} target="_blank" rel="noreferrer" className="font-semibold text-tide-dark">
                          @{aluno.instagram}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-3">{rotuloPlano(aluno.plano)}</td>
                    <td className="px-3 py-3">
                      <SeloCategoria categoria={aluno.categoria} />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{rotuloGenero(aluno.genero) || '—'}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatarCadastro(aluno.cadastradoEm)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          to={`/alunos/${aluno.id}`}
                          aria-label={admin && aluno.ativo ? `Editar ${aluno.nome}` : `Ver ${aluno.nome}`}
                          title={admin && aluno.ativo ? 'Editar' : 'Ver'}
                          className={admin && aluno.ativo ? cx(classeBotao('secundario'), classeIconeAcao) : 'font-semibold text-tide-dark'}
                        >
                          {admin && aluno.ativo ? <IconeLapis /> : 'Ver'}
                        </Link>
                        {admin && aluno.ativo ? (
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
