import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Aluno, Aula } from '../api/types'
import { useGet } from '../api/useGet'
import { useNotificar } from '../componentes/toast'
import {
  Botao,
  Cabecalho,
  classeCartao,
  classeTabela,
  classeThead,
  cx,
  PainelEstado,
  SeloStatus,
  useTitulo,
} from '../componentes/ui'
import { acompanharMes, filtrarVista, totaisDoMes, type VistaAcompanhamento } from '../lib/acompanhamento'
import { deslocarMes, fimDoMes, formatarHora, formatarMes, inicioDoMes, mesAtual, mesValido, partesSP } from '../lib/calendario'

const classeRolagem = 'max-h-80 overflow-y-auto [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-mint'

const VISTAS: { id: Exclude<VistaAcompanhamento, 'todas'>; rotulo: string; vazio: string }[] = [
  { id: 'faltas', rotulo: 'Faltas', vazio: 'Nenhuma falta neste mês.' },
  { id: 'confirmacoes', rotulo: 'Confirmações', vazio: 'Nenhuma confirmação neste mês.' },
  { id: 'cancelamentos', rotulo: 'Cancelamentos', vazio: 'Nenhum cancelamento neste mês.' },
  { id: 'reposicoes', rotulo: 'Reposições', vazio: 'Nenhuma reposição neste mês.' },
]

export function Acompanhamento() {
  useTitulo('Acompanhamento')
  const [params, setParams] = useSearchParams()
  const [vista, setVista] = useState<VistaAcompanhamento>('todas')
  const bruta = params.get('mes')
  const atual = mesAtual()
  const mes = bruta && mesValido(bruta) && bruta <= atual ? bruta : atual
  const consulta = useGet<Aula[]>(`/api/aulas?de=${inicioDoMes(mes)}&ate=${fimDoMes(mes)}`)
  const saldo = useGet<Aluno[]>('/api/alunos?incluirInativos=1')
  const aulas = Array.isArray(consulta.dados) ? consulta.dados : null
  const alunos = Array.isArray(saldo.dados) ? saldo.dados : null
  const disponiveis = (alunos ?? [])
    .filter((aluno) => aluno.reposicoesDisponiveis > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  useNotificar(consulta.dados && !aulas ? 'erro' : null, 'A resposta da agenda veio em um formato inesperado.')
  useNotificar(saldo.dados && !alunos ? 'erro' : null, 'A resposta da lista veio em um formato inesperado.')

  useEffect(() => {
    if (bruta !== null && (!mesValido(bruta) || bruta > atual)) {
      setParams({ mes: atual }, { replace: true })
    }
  }, [atual, bruta, setParams])

  useEffect(() => {
    setVista('todas')
  }, [mes])

  function ir(proximo: string) {
    setParams({ mes: proximo > atual ? atual : proximo })
  }

  const linhas = aulas ? acompanharMes(aulas) : []
  const totais = totaisDoMes(linhas)
  const visiveis = filtrarVista(linhas, vista)
  const avisoVazio = VISTAS.find((item) => item.id === vista)?.vazio

  return (
    <div>
      <Cabecalho
        sobretitulo="Visão geral"
        titulo="Acompanhamento"
        descricao={`${formatarMes(mes)}. Faltas, confirmações, cancelamentos e reposições. Aula em Aguardando só aparece quando é reposição.`}
        acoes={
          <>
            <Botao variante="secundario" onClick={() => ir(deslocarMes(mes, -1))}>
              Mês anterior
            </Botao>
            <Botao variante="secundario" onClick={() => ir(atual)} disabled={mes === atual}>
              Este mês
            </Botao>
            <Botao variante="secundario" onClick={() => ir(deslocarMes(mes, 1))} disabled={mes === atual}>
              Próximo mês
            </Botao>
          </>
        }
      />

      <section aria-labelledby="reposicoes-disponiveis" className="mb-6">
        <h2 id="reposicoes-disponiveis" className="text-xl font-bold">Reposições disponíveis</h2>
        <p className="mt-1 mb-3 text-sm text-muted">Vagas que ainda não foram agendadas.</p>
        {saldo.carregando && !alunos ? <PainelEstado status>Carregando…</PainelEstado> : null}
        {saldo.erro && !alunos ? (
          <PainelEstado>
            <p className="mb-3 text-clay">{saldo.erro}</p>
            <Botao variante="secundario" onClick={saldo.recarregar}>
              Tentar de novo
            </Botao>
          </PainelEstado>
        ) : null}
        {alunos && disponiveis.length === 0 ? <p className="text-muted">Nenhuma reposição disponível.</p> : null}
        {disponiveis.length > 0 ? (
          <div className={cx(classeTabela, classeRolagem)}>
            <table className="w-full border-collapse text-sm">
              <thead className={classeThead}>
                <tr>
                  <th className="px-3 py-3" scope="col">Aluno</th>
                  <th className="px-3 py-3" scope="col">Disponíveis</th>
                </tr>
              </thead>
              <tbody>
                {disponiveis.map((aluno) => (
                  <tr key={aluno.id} className={cx('border-t border-line', !aluno.ativo && 'text-muted')}>
                    <th className="px-3 py-3 text-left font-semibold text-ink" scope="row">
                      <Link to={`/alunos/${aluno.id}`} className="text-tide-dark">
                        {aluno.nome}
                      </Link>
                      {aluno.ativo ? null : (
                        <span className="ml-2 inline-flex rounded-full bg-[#e7e4de] px-2 py-0.5 text-xs font-semibold text-ink">
                          Inativo
                        </span>
                      )}
                    </th>
                    <td className="px-3 py-3 font-bold tabular-nums">{aluno.reposicoesDisponiveis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {consulta.carregando && !aulas ? <PainelEstado status>Carregando…</PainelEstado> : null}
      {consulta.erro && !aulas ? (
        <PainelEstado>
          <p className="mb-3 text-clay">{consulta.erro}</p>
          <Botao variante="secundario" onClick={consulta.recarregar}>
            Tentar de novo
          </Botao>
        </PainelEstado>
      ) : null}
      {aulas ? (
        <div className="grid gap-4">
          {consulta.carregando ? (
            <p role="status" className="text-sm text-muted">
              Atualizando…
            </p>
          ) : null}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {VISTAS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={vista === item.id}
                onClick={() => setVista((atualVista) => (atualVista === item.id ? 'todas' : item.id))}
                className={cx(classeCartao, 'px-5 py-4 text-left', vista === item.id && 'ring-2 ring-tide')}
              >
                <p className="text-4xl leading-none font-bold tabular-nums">{totais[item.id]}</p>
                <p className="mt-2 text-sm font-semibold text-muted">{item.rotulo}</p>
              </button>
            ))}
          </section>
          {visiveis.length === 0 ? (
            <PainelEstado>
              {vista === 'todas' ? 'Nenhuma falta, confirmação, cancelamento ou reposição neste mês.' : avisoVazio}
            </PainelEstado>
          ) : (
            <div className={cx(classeTabela, classeRolagem)}>
              <table className="w-full min-w-[880px] border-collapse text-sm">
                <thead className={classeThead}>
                  <tr>
                    <th className="px-3 py-3" scope="col">Aluno</th>
                    <th className="px-3 py-3" scope="col">Faltas</th>
                    <th className="px-3 py-3" scope="col">Confirmações</th>
                    <th className="px-3 py-3" scope="col">Cancelamentos</th>
                    <th className="px-3 py-3" scope="col">Reposições</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((linha) => (
                    <tr key={linha.alunoId} className="border-t border-line align-top">
                      <th className="px-3 py-3 text-left font-semibold text-ink" scope="row">
                        {linha.temporario ? (
                          <span>{linha.nome}</span>
                        ) : (
                          <Link to={`/alunos/${linha.alunoId}`} className="text-tide-dark">
                            {linha.nome}
                          </Link>
                        )}
                        {linha.temporario ? <span className="mt-1 block text-xs font-normal text-muted">Temporário</span> : null}
                      </th>
                      <td className="px-3 py-3"><ListaAulas aulas={linha.faltas} /></td>
                      <td className="px-3 py-3"><ListaAulas aulas={linha.confirmacoes} /></td>
                      <td className="px-3 py-3"><ListaAulas aulas={linha.cancelamentos} /></td>
                      <td className="px-3 py-3"><ListaAulas aulas={linha.reposicoes} mostrarStatus /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function ListaAulas({ aulas, mostrarStatus = false }: { aulas: Aula[]; mostrarStatus?: boolean }) {
  if (aulas.length === 0) return <span className="text-muted">—</span>
  return (
    <div>
      <p className="font-bold tabular-nums">{aulas.length}</p>
      <ul className="mt-1 grid gap-1">
        {aulas.map((aula) => {
          const quando = partesSP(aula.inicio)
          const dia = `${quando.data.slice(8, 10)}/${quando.data.slice(5, 7)}`
          return (
            <li key={aula.id}>
              <Link to={`/agenda/aulas/${aula.id}`} className="font-semibold text-tide-dark">
                {dia} {formatarHora(aula.inicio)}
              </Link>
              {mostrarStatus ? (
                <span className="mt-0.5 flex flex-wrap items-center gap-1">
                  <SeloStatus status={aula.status} experimental={aula.experimental} />
                  {aula.experimental ? <span className="text-xs text-muted">Experimental</span> : null}
                </span>
              ) : aula.reposicaoDeAulaId || aula.experimental ? (
                <span className="mt-0.5 block text-xs text-muted">
                  {[aula.reposicaoDeAulaId ? 'Reposição' : '', aula.experimental ? 'Experimental' : ''].filter(Boolean).join(' · ')}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
