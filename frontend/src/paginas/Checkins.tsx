import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Checkin, ListaCheckins } from '../api/types'
import { useGet } from '../api/useGet'
import { useNotificar } from '../componentes/toast'
import { Botao, Cabecalho, classeTabela, classeThead, PainelEstado, useTitulo } from '../componentes/ui'
import { addDias, civilValida, formatarDiaLongo, formatarHora, formatarTelefone, hojeSP } from '../lib/calendario'

function rotuloProvedor(provedor: Checkin['provedor']): string {
  return provedor === 'GYMPASS' ? 'Gympass' : 'TotalPass'
}

function contatoDe(checkin: Checkin): string {
  const partes = [checkin.email, checkin.telefone ? formatarTelefone(checkin.telefone) : ''].filter(Boolean)
  return partes.join(' · ') || '—'
}

export function Checkins() {
  useTitulo('Check-ins')
  const [params, setParams] = useSearchParams()
  const bruta = params.get('data')
  const data = bruta && civilValida(bruta) ? bruta : hojeSP()
  const consulta = useGet<ListaCheckins>(`/api/checkins?data=${data}`)
  const lista = consulta.dados && Array.isArray(consulta.dados.itens) ? consulta.dados : null

  useEffect(() => {
    if (bruta !== null && !civilValida(bruta)) setParams({ data: hojeSP() }, { replace: true })
  }, [bruta, setParams])

  useNotificar(consulta.erro ? 'erro' : null, consulta.erro)
  useNotificar(lista && !lista.gympass ? 'aviso' : null, 'Gympass não configurado.')
  useNotificar(lista && !lista.totalpass ? 'aviso' : null, 'TotalPass não configurado.')
  useNotificar(consulta.dados && !lista ? 'erro' : null, 'A resposta da lista veio em um formato inesperado.')

  function ir(proxima: string) {
    setParams({ data: proxima })
  }

  return (
    <div>
      <Cabecalho
        sobretitulo="Visão geral"
        titulo="Check-ins"
        descricao={formatarDiaLongo(data)}
        acoes={
          <>
            <Botao variante="secundario" onClick={() => ir(addDias(data, -1))}>
              Anterior
            </Botao>
            <Botao variante="secundario" onClick={() => ir(hojeSP())}>
              Hoje
            </Botao>
            <Botao variante="secundario" onClick={() => ir(addDias(data, 1))}>
              Próximo
            </Botao>
            <label className="sr-only" htmlFor="data-checkin">
              Data
            </label>
            <input
              id="data-checkin"
              type="date"
              value={data}
              onChange={(event) => {
                if (civilValida(event.target.value)) ir(event.target.value)
              }}
              className="h-10 rounded-full border border-line bg-paper px-3 text-sm"
            />
          </>
        }
      />
            {consulta.carregando && !lista ? <PainelEstado status>Carregando…</PainelEstado> : null}
      {lista && lista.itens.length === 0 ? <p className="text-muted">Nenhum check-in neste dia.</p> : null}
      {lista && lista.itens.length > 0 ? (
        <div className={classeTabela}>
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className={classeThead}>
              <tr>
                <th className="px-3 py-3" scope="col">Horário</th>
                <th className="px-3 py-3" scope="col">Nome</th>
                <th className="px-3 py-3" scope="col">Contato</th>
                <th className="px-3 py-3" scope="col">Provedor</th>
              </tr>
            </thead>
            <tbody>
              {lista.itens.map((checkin) => (
                <tr key={checkin.id} className="border-t border-line">
                  <td className="px-3 py-3 whitespace-nowrap">{formatarHora(checkin.iniciadoEm)}</td>
                  <td className="px-3 py-3">
                    {checkin.alunoId ? (
                      <Link to={`/alunos/${checkin.alunoId}`} className="font-semibold text-tide-dark">
                        {checkin.nome}
                      </Link>
                    ) : (
                      checkin.nome
                    )}
                  </td>
                  <td className="px-3 py-3">{contatoDe(checkin)}</td>
                  <td className="px-3 py-3">{rotuloProvedor(checkin.provedor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
