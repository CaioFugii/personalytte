import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, mensagemDeErro } from '../api/client'
import type { Integrante } from '../api/types'
import { useGet } from '../api/useGet'
import { Banner, Botao, Cabecalho, classeCampo, LinkBotao, PainelEstado, useTitulo } from '../componentes/ui'
import { useBusca } from '../lib/busca'
import { formatarCadastro, formatarDataCivil, formatarTelefone } from '../lib/calendario'
import { rotuloFuncao } from '../lib/rotulos'

export function Equipe() {
  useTitulo('Equipe')
  const { busca, texto, setTexto } = useBusca()
  const caminho = busca ? `/api/integrantes?busca=${encodeURIComponent(busca)}` : '/api/integrantes'
  const consulta = useGet<Integrante[]>(caminho)
  const lista = Array.isArray(consulta.dados) ? consulta.dados : null
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [pendente, setPendente] = useState<string | null>(null)

  async function inativar(pessoa: Integrante) {
    if (!window.confirm(`Inativar ${pessoa.nome}? O login deixa de funcionar na hora.`)) return
    setPendente(pessoa.id)
    setErroAcao(null)
    try {
      await api(`/api/integrantes/${pessoa.id}/inativar`, { method: 'POST' })
      consulta.recarregar()
    } catch (erro) {
      setErroAcao(mensagemDeErro(erro))
    } finally {
      setPendente(null)
    }
  }

  return (
    <div>
      <Cabecalho
        titulo="Equipe"
        descricao="Integrantes ativos. Só o administrador vê esta tela."
        acoes={<LinkBotao to="/equipe/novo">Novo integrante</LinkBotao>}
      />
      <form role="search" className="mb-4" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="busca-equipe" className="mb-1 block text-sm font-semibold">
          Busca
        </label>
        <input
          id="busca-equipe"
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
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead className="bg-sand/80 text-left text-muted">
              <tr>
                <th className="px-3 py-2 font-medium" scope="col">Nome</th>
                <th className="px-3 py-2 font-medium" scope="col">Telefone</th>
                <th className="px-3 py-2 font-medium" scope="col">Função</th>
                <th className="px-3 py-2 font-medium" scope="col">Data de nascimento</th>
                <th className="px-3 py-2 font-medium" scope="col">Cadastro</th>
                <th className="px-3 py-2 font-medium" scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-muted">
                    {busca ? 'Nenhum integrante encontrado.' : 'Nenhum integrante cadastrado.'}
                  </td>
                </tr>
              ) : (
                lista.map((pessoa) => (
                  <tr key={pessoa.id} className="border-t border-line">
                    <td className="px-3 py-3 font-semibold">{pessoa.nome}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatarTelefone(pessoa.telefone)}</td>
                    <td className="px-3 py-3">{rotuloFuncao(pessoa.funcao)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {pessoa.dataNascimento ? formatarDataCivil(pessoa.dataNascimento) : '—'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatarCadastro(pessoa.cadastradoEm)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link to={`/equipe/${pessoa.id}`} className="font-semibold text-tide-dark">
                          Editar
                        </Link>
                        <button
                          type="button"
                          className="font-semibold text-clay disabled:opacity-50"
                          disabled={pendente === pessoa.id}
                          onClick={() => void inativar(pessoa)}
                        >
                          Inativar
                        </button>
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
