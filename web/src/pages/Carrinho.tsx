import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Loja } from '../../../shared/tipos'
import { precoUnitario, useCarrinho } from '../contexts/CarrinhoContext'
import { api } from '../services/api'
import { moeda } from '../services/formatar'
import { FotoProduto } from '../components/FotoProduto'

export const PEDIDO_MINIMO_PADRAO = 10

// REQ-006 e REQ-034: carrinho com subtotal e pedido mínimo (tela 1 de 3 do checkout, REQ-066).
export function Carrinho() {
  const { itens, subtotal, alterarQuantidade, remover } = useCarrinho()
  const [loja, setLoja] = useState<Loja | null>(null)
  const navegar = useNavigate()

  useEffect(() => {
    api
      .get<Loja>('/loja')
      .then((r) => setLoja(r.data))
      .catch(() => setLoja(null))
  }, [])

  const minimo = loja?.pedidoMinimo ?? PEDIDO_MINIMO_PADRAO
  const abaixoDoMinimo = subtotal < minimo
  const fechada = loja ? !loja.aberta : false

  return (
    <main className="pagina">
      <h1>Carrinho</h1>
      {itens.length === 0 ? (
        <p>
          Seu carrinho está vazio. <Link to="/cliente">Ver o cardápio</Link>
        </p>
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
