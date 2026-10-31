import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Adicional, Produto } from '../../../shared/tipos'

// REQ-006: carrinho só no front (Context), sem persistir na API.
export interface ItemCarrinho {
  chave: number
  produto: Produto
  quantidade: number
  adicionais: Adicional[] // REQ-005
  removidos: string[]
  observacao: string
}

// Preço de uma unidade do item: produto + adicionais (REQ-005).
export function precoUnitario(item: Pick<ItemCarrinho, 'produto' | 'adicionais'>): number {
  return item.produto.preco + item.adicionais.reduce((soma, a) => soma + a.preco, 0)
}

interface Carrinho {
  itens: ItemCarrinho[]
  subtotal: number
  quantidadeTotal: number
  adicionar: (item: Omit<ItemCarrinho, 'chave'>) => void
  alterarQuantidade: (chave: number, quantidade: number) => void
  remover: (chave: number) => void
  limpar: () => void
}

const CarrinhoContext = createContext<Carrinho | null>(null)

export function CarrinhoProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([])

  function adicionar(item: Omit<ItemCarrinho, 'chave'>) {
    setItens((atual) => [...atual, { ...item, chave: Date.now() + Math.random() }])
  }

  function alterarQuantidade(chave: number, quantidade: number) {
    if (quantidade < 1) return remover(chave)
    setItens((atual) => atual.map((i) => (i.chave === chave ? { ...i, quantidade } : i)))
  }

  function remover(chave: number) {
    setItens((atual) => atual.filter((i) => i.chave !== chave))
  }

  function limpar() {
    setItens([])
  }

  const subtotal = itens.reduce((soma, i) => soma + precoUnitario(i) * i.quantidade, 0)
  const quantidadeTotal = itens.reduce((soma, i) => soma + i.quantidade, 0)

  return (
    <CarrinhoContext.Provider
      value={{ itens, subtotal, quantidadeTotal, adicionar, alterarQuantidade, remover, limpar }}
    >
      {children}
    </CarrinhoContext.Provider>
  )
}

export function useCarrinho(): Carrinho {
  const carrinho = useContext(CarrinhoContext)
  if (!carrinho) throw new Error('useCarrinho precisa estar dentro de CarrinhoProvider')
  return carrinho
}
