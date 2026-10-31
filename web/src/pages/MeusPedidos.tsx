import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PagamentoEntrada, Pedido, StatusPedido } from '../../../shared/tipos'
import { Historico } from '../components/Historico'
import { api, mensagemDeErro } from '../services/api'
import { moeda, rotuloPagamento, rotuloStatus } from '../services/formatar'

const INTERVALO_MS = 5000
const DESTAQUE_MS = 6000

// REQ-012: acompanhamento por polling, com destaque quando o status muda (tela 3 de 3, REQ-066).
export function MeusPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [destaques, setDestaques] = useState<number[]>([])
  const [banner, setBanner] = useState('')
  const anteriores = useRef<Map<number, StatusPedido> | null>(null)

  useEffect(() => {
    let ativo = true
    const timers: number[] = []

    async function buscar() {
      try {
        const { data } = await api.get<Pedido[]>('/pedidos/meus')
        if (!ativo) return
        const mudaram: Pedido[] = []
        if (anteriores.current) {
          for (const p of data) {
            const antes = anteriores.current.get(p.id)
            if (antes && antes !== p.status) mudaram.push(p)
          }
        }
        anteriores.current = new Map(data.map((p) => [p.id, p.status]))
        setPedidos([...data].sort((a, b) => b.id - a.id))
        setErro('')
        if (mudaram.length > 0) {
          const ids = mudaram.map((p) => p.id)
          setDestaques((atual) => [...new Set([...atual, ...ids])])
          setBanner(mudaram.map((p) => `Pedido nº ${p.id}: ${rotuloStatus[p.status]}`).join(' · '))
          timers.push(
            window.setTimeout(() => {
              setDestaques((atual) => atual.filter((id) => !ids.includes(id)))
              setBanner('')
            }, DESTAQUE_MS),
          )
        }
      } catch (e) {
        if (ativo) setErro(mensagemDeErro(e, 'Não foi possível atualizar os pedidos'))
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    buscar()
    const intervalo = window.setInterval(buscar, INTERVALO_MS)
    return () => {
      ativo = false
      window.clearInterval(intervalo)
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [])

  // REQ-037: pedido que ficou sem pagamento ainda pode ser pago aqui; o polling mostra o novo status.
  async function pagar(id: number, aprovado: boolean) {
    try {
      const corpo: PagamentoEntrada = { aprovado }
      const { data } = await api.post<Pedido>(`/pedidos/${id}/pagamento`, corpo)
      setPedidos((atual) => atual.map((p) => (p.id === id ? data : p)))
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível simular o pagamento'))
    }
  }

  return (
    <main className="pagina">
      <h1>Meus pedidos</h1>
      <p className="detalhe">Atualiza sozinho a cada 5 segundos.</p>
      <div aria-live="polite">{banner && <p className="banner-status">Status atualizado! {banner}</p>}</div>
      {carregando && <p>Carregando…</p>}
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {!carregando && pedidos.length === 0 && !erro && (
        <p>
          Você ainda não fez pedidos. <Link to="/cliente">Ver o cardápio</Link>
        </p>
      )}
      <ul className="lista">
        {pedidos.map((p) => (
          <li key={p.id} className={`pedido${destaques.includes(p.id) ? ' destaque' : ''}`}>
            <div className="pedido-topo">
              <h2>Pedido nº {p.id}</h2>
              <span className={`status status-${p.status}`}>{rotuloStatus[p.status]}</span>
            </div>
            <p className="detalhe">{new Date(p.criadoEm).toLocaleString('pt-BR')}</p>
            <ul className="itens">
              {p.itens.map((i, n) => (
                <li key={n}>
                  {i.quantidade}× {i.nome || `Produto ${i.produtoId}`}
                  {i.adicionais && i.adicionais.length > 0 && ` + ${i.adicionais.map((a) => a.nome).join(', ')}`}
                  {i.removidos && i.removidos.length > 0 && ` (sem ${i.removidos.join(', ')})`}
                </li>
              ))}
            </ul>
            <p>
              Taxa {moeda(p.taxaEntrega)} · <strong>Total {moeda(p.total)}</strong> ·{' '}
              {rotuloPagamento[p.formaPagamento]}
              {p.trocoPara ? ` (troco para ${moeda(p.trocoPara)})` : ''}
            </p>
            {p.status === 'aguardando_pagamento' && (
              <div className="acoes">
                <button type="button" onClick={() => pagar(p.id, true)}>
                  Simular pagamento: aprovar
                </button>
                <button type="button" className="secundario" onClick={() => pagar(p.id, false)}>
                  Recusar
                </button>
              </div>
            )}
            {p.motivo && <p className="detalhe">Motivo: {p.motivo}</p>}
            {p.estornoRegistrado && <p className="detalhe">Estorno registrado</p>}
            <Historico historico={p.historico} />
          </li>
        ))}
      </ul>
    </main>
  )
}
