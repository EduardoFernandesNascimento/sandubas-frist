import type { FormaPagamento, StatusPedido } from '../../../shared/tipos'

// REQ-076: valores em R$ no formato pt-BR.
const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function moeda(valor: number): string {
  return formatoMoeda.format(valor)
}

// REQ-012: status do pedido em português.
export const rotuloStatus: Record<StatusPedido, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  recebido: 'Recebido',
  em_preparo: 'Em preparo',
  pronto: 'Pronto',
  saiu_para_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

export const rotuloPagamento: Record<FormaPagamento, string> = {
  pix: 'Pix',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
}

// Foto do produto: URL (http ou caminho local) vira <img>; o resto (emoji) vira texto.
export function ehUrl(foto: string): boolean {
  return /^(https?:\/\/|\/|\.\/)/.test(foto)
}
