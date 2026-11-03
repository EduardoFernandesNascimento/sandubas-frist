import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type {
  Bairro,
  Endereco,
  EnderecoEntrada,
  FormaPagamento,
  Loja,
  PagamentoEntrada,
  Pedido,
  PedidoEntrada,
} from '../../../shared/tipos'
import { useCarrinho } from '../contexts/CarrinhoContext'
import { api, mensagemDeErro } from '../services/api'
import { moeda, rotuloPagamento, rotuloStatus } from '../services/formatar'
import { PEDIDO_MINIMO_PADRAO } from './Carrinho'
import { Trilha } from '../components/Trilha'

const FORMAS: FormaPagamento[] = ['pix', 'cartao', 'dinheiro']

// Tela 2 de 3 (REQ-066): endereço, taxa, tempo, pagamento e confirmação.
export function Checkout() {
  const { itens, subtotal, limpar } = useCarrinho()
  const navegar = useNavigate()

  const [loja, setLoja] = useState<Loja | null>(null)
  const [bairros, setBairros] = useState<Bairro[]>([])
  const [enderecos, setEnderecos] = useState<Endereco[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [enderecoId, setEnderecoId] = useState<number | null>(null)
  const [novo, setNovo] = useState(false)
  const [forma, setForma] = useState<FormaPagamento>('pix')
  const [troco, setTroco] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [pedido, setPedido] = useState<Pedido | null>(null)

  useEffect(() => {
    Promise.all([api.get<Loja>('/loja'), api.get<Bairro[]>('/bairros'), api.get<Endereco[]>('/enderecos')])
      .then(([l, b, e]) => {
        setLoja(l.data)
        setBairros(b.data)
        setEnderecos(e.data)
        if (e.data.length > 0) setEnderecoId(e.data[0].id)
        else setNovo(true)
      })
      .catch((e) => setErro(mensagemDeErro(e, 'Não foi possível carregar os dados do checkout')))
      .finally(() => setCarregando(false))
  }, [])

  const endereco = enderecos.find((e) => e.id === enderecoId)
  const bairro = bairros.find((b) => b.id === endereco?.bairroId)
  const taxa = bairro?.taxa ?? 0
  const tempo = loja ? loja.tempoPreparoMin + loja.tempoEntregaMin : null // REQ-009
  const minimo = loja?.pedidoMinimo ?? PEDIDO_MINIMO_PADRAO
  const fechada = loja ? !loja.aberta : false
  const nomeBairro = (id: number) => bairros.find((b) => b.id === id)?.nome ?? 'bairro não atendido'

  function aoCadastrar(e: Endereco) {
    setEnderecos((atual) => [...atual, e])
    setEnderecoId(e.id)
    setNovo(false)
  }

  async function confirmar(ev: FormEvent) {
    ev.preventDefault()
    setErro('')
    if (!enderecoId) return setErro('Escolha ou cadastre um endereço de entrega.')
    let trocoPara: number | undefined
    if (forma === 'dinheiro' && troco.trim() !== '') {
      trocoPara = Number(troco.replace(',', '.'))
      if (!Number.isFinite(trocoPara) || trocoPara <= 0) return setErro('Informe um valor de troco válido.')
      if (trocoPara < subtotal + taxa) return setErro(`O troco precisa ser de pelo menos ${moeda(subtotal + taxa)}.`)
    }
    const corpo: PedidoEntrada = {
      itens: itens.map((i) => ({
        produtoId: i.produto.id,
        quantidade: i.quantidade,
        adicionais: i.adicionais.map((a) => a.nome),
        removidos: i.removidos,
        observacao: i.observacao || undefined,
      })),
      enderecoId,
      formaPagamento: forma,
      trocoPara,
    }
    setEnviando(true)
    try {
      const { data } = await api.post<Pedido>('/pedidos', corpo)
      setPedido(data)
      limpar()
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível criar o pedido'))
    } finally {
      setEnviando(false)
    }
  }

  // REQ-037: pagamento simulado, sem cobrança.
  async function pagar(aprovado: boolean) {
    if (!pedido) return
    setErro('')
    setEnviando(true)
    try {
      const corpo: PagamentoEntrada = { aprovado }
      await api.post<Pedido>(`/pedidos/${pedido.id}/pagamento`, corpo)
      navegar('/cliente/pedidos')
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível simular o pagamento'))
      setEnviando(false)
    }
  }

  if (pedido) {
    return (
      <main className="pagina">
        <Trilha para="/cliente/pedidos" rotulo="meus pedidos" atual={`Pedido nº ${pedido.id}`} />
        <h1>Pedido nº {pedido.id} criado</h1>
        <p>
          Status: <span className={`status status-${pedido.status}`}>{rotuloStatus[pedido.status]}</span>
        </p>
        <dl className="resumo">
          <dt>Taxa de entrega</dt>
          <dd>{moeda(pedido.taxaEntrega)}</dd>
          <dt>Total</dt>
          <dd className="total">{moeda(pedido.total)}</dd>
          <dt>Pagamento</dt>
          <dd>
            {rotuloPagamento[pedido.formaPagamento]}
            {pedido.trocoPara ? ` (troco para ${moeda(pedido.trocoPara)})` : ''}
          </dd>
        </dl>
        <section aria-labelledby="titulo-pagamento" className="simular">
          <h2 id="titulo-pagamento">Simular pagamento</h2>
          <p className="detalhe">Demonstração: nenhuma cobrança é feita.</p>
          {erro && (
            <p className="erro" role="alert">
              {erro}
            </p>
          )}
          <div className="acoes">
            <button type="button" disabled={enviando} onClick={() => pagar(true)}>
              Aprovar pagamento
            </button>
            <button type="button" className="secundario" disabled={enviando} onClick={() => pagar(false)}>
              Recusar pagamento
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (itens.length === 0) {
    return (
      <main className="pagina">
        <Trilha para="/cliente" rotulo="o cardápio" atual="Checkout" />
        <h1>Checkout</h1>
        <div className="vazio" role="status">
          <span className="icone-vazio" aria-hidden="true">
            🛒
          </span>
          <p>
            Seu carrinho está vazio. <Link to="/cliente">Ver o cardápio</Link>
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="pagina">
      <Trilha para="/cliente/carrinho" rotulo="o carrinho" atual="Checkout" />
      <h1>Checkout</h1>
      {carregando && (
        <>
          <p>Carregando…</p>
          <div className="skeleton skeleton-bloco" aria-hidden="true" />
        </>
      )}
      {fechada && (
        <p className="aviso fechado" role="alert">
          <strong>Fechado.</strong> A loja não está aceitando pedidos agora.
        </p>
      )}

      <section aria-labelledby="titulo-endereco">
        <h2 id="titulo-endereco">Endereço de entrega</h2>
        {enderecos.length > 0 && (
          <fieldset>
            <legend>Escolha o endereço</legend>
            {enderecos.map((e) => (
              <label key={e.id} className="opcao">
                <input
                  type="radio"
                  name="endereco"
                  checked={enderecoId === e.id}
                  onChange={() => setEnderecoId(e.id)}
                />
                {e.rua}, {e.numero}
                {e.complemento ? ` (${e.complemento})` : ''} · {nomeBairro(e.bairroId)}
              </label>
            ))}
          </fieldset>
        )}
        {novo ? (
          <NovoEndereco
            bairros={bairros}
            aoCadastrar={aoCadastrar}
            aoCancelar={enderecos.length > 0 ? () => setNovo(false) : undefined}
          />
        ) : (
          <button type="button" className="link" onClick={() => setNovo(true)}>
            Cadastrar outro endereço
          </button>
        )}
      </section>

      <form onSubmit={confirmar}>
        <fieldset>
          <legend>Forma de pagamento</legend>
          {FORMAS.map((f) => (
            <label key={f} className="opcao">
              <input type="radio" name="forma" checked={forma === f} onChange={() => setForma(f)} />
              {rotuloPagamento[f]}
            </label>
          ))}
          {forma === 'dinheiro' && (
            <label>
              Troco para (R$)
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={troco}
                onChange={(e) => setTroco(e.target.value)}
                placeholder="Ex.: 50,00 (deixe vazio se não precisar)"
              />
            </label>
          )}
        </fieldset>

        <dl className="resumo">
          <dt>Subtotal</dt>
          <dd>{moeda(subtotal)}</dd>
          <dt>Taxa de entrega</dt>
          <dd>{bairro ? `${moeda(taxa)} (${bairro.nome})` : 'escolha o endereço'}</dd>
          <dt>Tempo estimado</dt>
          <dd>{tempo !== null ? `${tempo} min` : '…'}</dd>
          <dt>Total estimado</dt>
          <dd className="total">{moeda(subtotal + taxa)}</dd>
        </dl>
        <p className="detalhe">O total final é calculado pela loja ao confirmar.</p>

        {subtotal < minimo && (
          <p className="aviso" role="status">
            O pedido mínimo para entrega é {moeda(minimo)}.
          </p>
        )}
        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
        <div className="acoes">
          <Link to="/cliente/carrinho">Voltar ao carrinho</Link>
          <button type="submit" disabled={enviando || carregando || fechada || !enderecoId || subtotal < minimo}>
            {enviando ? 'Enviando…' : 'Confirmar pedido'}
          </button>
        </div>
      </form>
    </main>
  )
}

// REQ-007 e REQ-035: cadastro de endereço com bairro só da lista.
function NovoEndereco({
  bairros,
  aoCadastrar,
  aoCancelar,
}: {
  bairros: Bairro[]
  aoCadastrar: (e: Endereco) => void
  aoCancelar?: () => void
}) {
  const [rua, setRua] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairroId, setBairroId] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function salvar(ev: FormEvent) {
    ev.preventDefault()
    setErro('')
    if (!rua.trim() || !numero.trim() || !bairroId) return setErro('Preencha rua, número e bairro.')
    const corpo: EnderecoEntrada = {
      rua: rua.trim(),
      numero: numero.trim(),
      complemento: complemento.trim() || undefined,
      bairroId: Number(bairroId),
    }
    setEnviando(true)
    try {
      const { data } = await api.post<Endereco>('/enderecos', corpo)
      aoCadastrar(data)
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível cadastrar o endereço'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="sub-form" aria-label="Novo endereço">
      <label>
        Rua
        <input value={rua} onChange={(e) => setRua(e.target.value)} required />
      </label>
      <label>
        Número
        <input value={numero} onChange={(e) => setNumero(e.target.value)} required />
      </label>
      <label>
        Complemento
        <input value={complemento} onChange={(e) => setComplemento(e.target.value)} />
      </label>
      <label>
        Bairro
        <select value={bairroId} onChange={(e) => setBairroId(e.target.value)} required>
          <option value="">Selecione o bairro</option>
          {bairros.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nome} (taxa {moeda(b.taxa)})
            </option>
          ))}
        </select>
      </label>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      <div className="acoes">
        {aoCancelar && (
          <button type="button" className="secundario" onClick={aoCancelar}>
            Cancelar
          </button>
        )}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar endereço'}
        </button>
      </div>
    </form>
  )
}
