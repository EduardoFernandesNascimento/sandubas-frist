import { useRef, useState } from 'react'
import type { AtribuicaoEntrada, Entregador, Pedido, StatusEntrada } from '../../../shared/tipos'
import { Historico } from '../components/Historico'
import { api, mensagemDeErro } from '../services/api'
import { moeda, rotuloPagamento, rotuloStatus } from '../services/formatar'
import { usePolling } from '../services/polling'

const DESTAQUE_MS = 8000

// RN07 (REQ-039): recebido no topo; o resto do mais novo para o mais antigo.
function ordenar(lista: Pedido[]): Pedido[] {
  return [...lista].sort((a, b) => {
    const ra = a.status === 'recebido' ? 0 : 1
    const rb = b.status === 'recebido' ? 0 : 1
    return ra - rb || b.id - a.id
  })
}

// Painel da loja: REQ-016, REQ-017, REQ-018, REQ-026, REQ-038, REQ-039, REQ-044.
export function PainelLoja() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [entregadores, setEntregadores] = useState<Entregador[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [novos, setNovos] = useState<number[]>([])
  const [cancelando, setCancelando] = useState<number | null>(null)
  const [motivo, setMotivo] = useState('')
  const [escolha, setEscolha] = useState<Record<number, string>>({})
  const [ocupado, setOcupado] = useState(false)
  const vistos = useRef<Set<number> | null>(null)

  async function buscar() {
    try {
      const [rp, re] = await Promise.all([api.get<Pedido[]>('/pedidos'), api.get<Entregador[]>('/entregadores')])
      // RF17 (REQ-016): pedido recebido que não estava na lista anterior ganha destaque.
      if (vistos.current) {
        const chegaram = rp.data.filter((p) => p.status === 'recebido' && !vistos.current!.has(p.id)).map((p) => p.id)
        if (chegaram.length > 0) {
          setNovos((atual) => [...new Set([...atual, ...chegaram])])
          window.setTimeout(() => setNovos((atual) => atual.filter((id) => !chegaram.includes(id))), DESTAQUE_MS)
        }
      }
      vistos.current = new Set(rp.data.filter((p) => p.status !== 'aguardando_pagamento').map((p) => p.id))
      setPedidos(ordenar(rp.data))
      setEntregadores(re.data)
      setErro('')
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível carregar os pedidos'))
    } finally {
      setCarregando(false)
    }
  }

  usePolling(buscar)

  function trocar(atualizado: Pedido) {
    setPedidos((atual) => ordenar(atual.map((p) => (p.id === atualizado.id ? atualizado : p))))
  }

  async function mudarStatus(id: number, corpo: StatusEntrada) {
    setOcupado(true)
    try {
      const { data } = await api.patch<Pedido>(`/pedidos/${id}/status`, corpo)
      trocar(data)
      setCancelando(null)
      setMotivo('')
      setErro('')
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível mudar o status'))
    } finally {
      setOcupado(false)
    }
  }

  async function atribuir(id: number) {
    const entregadorId = Number(escolha[id])
    if (!entregadorId) return setErro('Escolha um entregador')
    setOcupado(true)
    try {
      const corpo: AtribuicaoEntrada = { entregadorId }
      const { data } = await api.patch<Pedido>(`/pedidos/${id}/entregador`, corpo)
      trocar(data)
      setErro('')
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível atribuir o entregador'))
    } finally {
      setOcupado(false)
    }
  }

  const disponiveis = entregadores.filter((e) => e.disponivel)
  const nomeEntregador = (id?: number) => entregadores.find((e) => e.id === id)?.nome ?? `nº ${id}`

  return (
    <main className="pagina larga">
      <h1>Pedidos da loja</h1>
      <p className="detalhe">Atualiza sozinho a cada 5 segundos.</p>
      <div aria-live="assertive">
        {novos.length > 0 && <p className="banner-status piscar">Pedido novo! nº {novos.join(', nº ')}</p>}
      </div>
      {carregando && <p>Carregando…</p>}
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {!carregando && pedidos.length === 0 && !erro && <p>Nenhum pedido por enquanto.</p>}
      <ul className="lista">
        {pedidos.map((p) => (
          <li key={p.id} className={`pedido${novos.includes(p.id) ? ' destaque piscar' : ''}`}>
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
                  {i.observacao && ` · obs.: ${i.observacao}`}
                </li>
              ))}
            </ul>
            <p>
              <strong>Total {moeda(p.total)}</strong> · {rotuloPagamento[p.formaPagamento]}
              {p.trocoPara ? ` (troco para ${moeda(p.trocoPara)})` : ''}
            </p>
            {p.motivo && <p className="detalhe">Motivo: {p.motivo}</p>}
            {p.estornoRegistrado && <p className="aviso">Estorno registrado</p>}
            {p.entregadorId && <p className="detalhe">Entregador: {nomeEntregador(p.entregadorId)}</p>}

            <div className="acoes">
              {p.status === 'recebido' && (
                <button type="button" disabled={ocupado} onClick={() => mudarStatus(p.id, { status: 'em_preparo' })}>
                  Aceitar
                </button>
              )}
              {p.status === 'em_preparo' && (
                <button type="button" disabled={ocupado} onClick={() => mudarStatus(p.id, { status: 'pronto' })}>
                  Marcar pronto
                </button>
              )}
              {['recebido', 'em_preparo', 'pronto'].includes(p.status) && cancelando !== p.id && (
                <button
                  type="button"
                  className="secundario"
                  onClick={() => {
                    setCancelando(p.id)
                    setMotivo('')
                  }}
                >
                  {p.status === 'recebido' ? 'Recusar' : 'Cancelar'}
                </button>
              )}
            </div>

            {cancelando === p.id && (
              <form
                className="sub-form"
                onSubmit={(ev) => {
                  ev.preventDefault()
                  mudarStatus(p.id, { status: 'cancelado', motivo: motivo.trim() })
                }}
              >
                <label>
                  Motivo {p.status === 'recebido' ? 'da recusa' : 'do cancelamento'}
                  <input value={motivo} onChange={(ev) => setMotivo(ev.target.value)} required />
                </label>
                <div className="acoes">
                  <button type="button" className="secundario" onClick={() => setCancelando(null)}>
                    Voltar
                  </button>
                  <button type="submit" disabled={ocupado || !motivo.trim()}>
                    Confirmar
                  </button>
                </div>
              </form>
            )}

            {p.status === 'pronto' && !p.entregadorId && (
              <div className="sub-form">
                {disponiveis.length === 0 ? (
                  <p className="detalhe">Nenhum entregador disponível agora.</p>
                ) : (
                  <div className="acoes">
                    <label>
                      Entregador
                      <select
                        value={escolha[p.id] ?? ''}
                        onChange={(ev) => setEscolha((atual) => ({ ...atual, [p.id]: ev.target.value }))}
                      >
                        <option value="">Escolha…</option>
                        {disponiveis.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="button" disabled={ocupado || !escolha[p.id]} onClick={() => atribuir(p.id)}>
                      Atribuir
                    </button>
                  </div>
                )}
              </div>
            )}
            <Historico historico={p.historico} />
          </li>
        ))}
      </ul>
    </main>
  )
}
