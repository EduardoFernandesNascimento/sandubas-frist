import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Bairro, Loja } from '../../../shared/tipos'
import { precoUnitario, useCarrinho } from '../contexts/CarrinhoContext'
import { api } from '../services/api'
import { moeda } from '../services/formatar'
import { FotoProduto } from '../components/FotoProduto'
import { Trilha } from '../components/Trilha'

export const PEDIDO_MINIMO_PADRAO = 10

// REQ-006 e REQ-034: carrinho com subtotal e pedido mínimo (tela 1 de 3 do checkout, REQ-066).
export function Carrinho() {
  const { itens, subtotal, alterarQuantidade, remover } = useCarrinho()
  const [loja, setLoja] = useState<Loja | null>(null)
  const [bairros, setBairros] = useState<Bairro[]>([])
  const navegar = useNavigate()

  useEffect(() => {
    Promise.all([api.get<Loja>('/loja'), api.get<Bairro[]>('/bairros')])
      .then(([l, b]) => {
        setLoja(l.data)
        setBairros(b.data)
      })
      .catch(() => {
        setLoja(null)
        setBairros([])
      })
  }, [])

  const minimo = loja?.pedidoMinimo ?? PEDIDO_MINIMO_PADRAO
  const abaixoDoMinimo = subtotal < minimo
  const fechada = loja ? !loja.aberta : false

  return (
    <main className="pagina">
      <Trilha para="/cliente" rotulo="o cardápio" atual="Carrinho" />
      <h1>Carrinho</h1>
      {itens.length === 0 ? (
        <div className="vazio" role="status">
          <span className="icone-vazio" aria-hidden="true">
            🛒
          </span>
          <p>
            Seu carrinho está vazio. <Link to="/cliente">Ver o cardápio</Link>
          </p>
        </div>
      ) : (
        <>
          <ul className="lista">
            {itens.map((i) => (
              <li key={i.chave} className="item-carrinho">
                <FotoProduto foto={i.produto.foto} nome={i.produto.nome} tamanho="pequena" />
                <div className="item-texto">
                  <strong>{i.produto.nome}</strong>
                  {i.adicionais.length > 0 && (
                    <p className="detalhe">Adicionais: {i.adicionais.map((a) => a.nome).join(', ')}</p>
                  )}
                  {i.removidos.length > 0 && <p className="detalhe">Sem: {i.removidos.join(', ')}</p>}
                  {i.observacao && <p className="detalhe">Obs.: {i.observacao}</p>}
                  <p className="detalhe">{moeda(precoUnitario(i))} cada</p>
                </div>
                <div className="quantidade">
                  <button
                    type="button"
                    aria-label={`Diminuir quantidade de ${i.produto.nome}`}
                    onClick={() => alterarQuantidade(i.chave, i.quantidade - 1)}
                  >
                    −
                  </button>
                  <span aria-label={`Quantidade de ${i.produto.nome}`}>{i.quantidade}</span>
                  <button
                    type="button"
                    aria-label={`Aumentar quantidade de ${i.produto.nome}`}
                    onClick={() => alterarQuantidade(i.chave, i.quantidade + 1)}
                  >
                    +
                  </button>
                </div>
                <strong>{moeda(precoUnitario(i) * i.quantidade)}</strong>
                <button type="button" className="link" onClick={() => remover(i.chave)}>
                  Remover
                </button>
              </li>
            ))}
          </ul>
          <p className="total" aria-live="polite">
            Subtotal: {moeda(subtotal)}
          </p>
          {abaixoDoMinimo && (
            <p className="aviso" role="status">
              O pedido mínimo para entrega é {moeda(minimo)}. Faltam {moeda(minimo - subtotal)}.
            </p>
          )}
          {fechada && (
            <p className="aviso fechado" role="alert">
              <strong>Fechado.</strong> A loja não está aceitando pedidos agora.
            </p>
          )}
          {bairros.length > 0 && (
            <section aria-labelledby="titulo-taxas" className="sub-form">
              <h2 id="titulo-taxas">Taxas de entrega por bairro</h2>
              <dl className="resumo">
                {bairros.map((b) => (
                  <div key={b.id} className="linha-resumo">
                    <dt>{b.nome}</dt>
                    <dd>{moeda(b.taxa)}</dd>
                  </div>
                ))}
              </dl>
              <p className="detalhe">A taxa é aplicada conforme o bairro do endereço escolhido no checkout.</p>
            </section>
          )}
          <div className="acoes">
            <Link to="/cliente">Continuar comprando</Link>
            <button type="button" disabled={abaixoDoMinimo || fechada} onClick={() => navegar('/cliente/checkout')}>
              Ir para o checkout
            </button>
          </div>
        </>
      )}
    </main>
  )
}
