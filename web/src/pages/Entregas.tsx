import { useState } from 'react'
import type { DisponibilidadeEntrada, Entrega, Entregador, StatusEntrada } from '../../../shared/tipos'
import { Historico } from '../components/Historico'
import { api, mensagemDeErro } from '../services/api'
import { moeda, rotuloPagamento, rotuloStatus } from '../services/formatar'
import { usePolling } from '../services/polling'

// Tela do entregador: REQ-030, REQ-031, REQ-032, REQ-045.
export function Entregas() {
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [disponivel, setDisponivel] = useState<boolean | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function buscar() {
    try {
      const { data } = await api.get<Entrega[]>('/entregas')
      setEntregas([...data].sort((a, b) => b.pedido.id - a.pedido.id))
      setErro('')
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível carregar as entregas'))
    } finally {
      setCarregando(false)
    }
  }

  usePolling(buscar)

  // RF32: PATCH /entregadores/me { disponivel }.
  async function marcar(valor: boolean) {
    setOcupado(true)
    try {
      const corpo: DisponibilidadeEntrada = { disponivel: valor }
      const { data } = await api.patch<Entregador>('/entregadores/me', corpo)
      setDisponivel(data.disponivel)
      setErro('')
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível mudar a disponibilidade'))
    } finally {
      setOcupado(false)
    }
  }

  // RF35: Retirei (pronto → saiu_para_entrega) e Entreguei (→ entregue).
  async function mudar(id: number, status: StatusEntrada['status']) {
    setOcupado(true)
    try {
      const corpo: StatusEntrada = { status }
      await api.patch(`/pedidos/${id}/status`, corpo)
      await buscar()
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível mudar o status'))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <main className="pagina">
      <h1>Entregas</h1>
      <div className="sub-form">
        <p>
          Situação:{' '}
          <strong>{disponivel === null ? 'escolha abaixo' : disponivel ? 'Disponível' : 'Indisponível'}</strong>
        </p>
        <div className="acoes">
          <button type="button" aria-pressed={disponivel === true} disabled={ocupado} onClick={() => marcar(true)}>
            Disponível
          </button>
          <button
            type="button"
            className="secundario"
            aria-pressed={disponivel === false}
            disabled={ocupado}
            onClick={() => marcar(false)}
          >
            Indisponível
          </button>
        </div>
      </div>
      <p className="detalhe">A lista atualiza sozinha a cada 5 segundos.</p>
      {carregando && <p>Carregando…</p>}
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {!carregando && entregas.length === 0 && !erro && <p>Nenhuma entrega atribuída a você.</p>}
      <ul className="lista">
        {entregas.map(({ pedido: p, endereco: e, bairro, clienteNome, clienteTelefone }) => (
          <li key={p.id} className="pedido">
            <div className="pedido-topo">
              <h2>Pedido nº {p.id}</h2>
              <span className={`status status-${p.status}`}>{rotuloStatus[p.status]}</span>
            </div>
            <address>
              {e.rua}, {e.numero}
              {e.complemento ? ` · ${e.complemento}` : ''} · {bairro.nome}
            </address>
            <p>
              Cliente: {clienteNome}
              {clienteTelefone && (
                <>
                  {' '}
                  · <a href={`tel:${clienteTelefone}`}>{clienteTelefone}</a>
                </>
              )}
            </p>
            <p>
              <strong>Cobrar {moeda(p.total)}</strong> · {rotuloPagamento[p.formaPagamento]}
              {p.formaPagamento === 'dinheiro' && p.trocoPara ? ` · troco para ${moeda(p.trocoPara)}` : ''}
            </p>
            <div className="acoes">
              {p.status === 'pronto' && (
                <button type="button" disabled={ocupado} onClick={() => mudar(p.id, 'saiu_para_entrega')}>
                  Retirei
                </button>
              )}
              {p.status === 'saiu_para_entrega' && (
                <button type="button" disabled={ocupado} onClick={() => mudar(p.id, 'entregue')}>
                  Entreguei
                </button>
              )}
            </div>
            <Historico historico={p.historico} />
          </li>
        ))}
      </ul>
    </main>
  )
}
