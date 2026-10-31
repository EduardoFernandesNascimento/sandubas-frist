// Tipos compartilhados entre a API e o front (DOC-01 p.6). [REQ-053]

export type Perfil = 'cliente' | 'loja' | 'entregador';

export type StatusPedido =
  | 'aguardando_pagamento'
  | 'recebido'
  | 'em_preparo'
  | 'pronto'
  | 'saiu_para_entrega'
  | 'entregue'
  | 'cancelado';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
}

export interface Produto {
  id: number;
  nome: string;
  categoria: string;
  preco: number;
  ativo: boolean;
}

export interface ItemPedido {
  produtoId: number;
  quantidade: number;
  precoUnitario: number;
  observacao?: string;
}

export interface Pedido {
  id: number;
  clienteId: number;
  entregadorId?: number;
  itens: ItemPedido[];
  taxaEntrega: number;
  total: number;
  formaPagamento: 'pix' | 'cartao' | 'dinheiro';
  status: StatusPedido;
  criadoEm: string;
}

export interface JwtPayload {
  sub: number;
  nome: string;
  perfil: Perfil;
  exp: number;
}

export interface RespostaLogin {
  token: string;
  usuario: Usuario;
}
