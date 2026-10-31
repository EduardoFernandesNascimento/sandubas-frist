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

export type FormaPagamento = 'pix' | 'cartao' | 'dinheiro';

export interface Adicional {
  nome: string;
  preco: number;
}

export interface Produto {
  id: number;
  nome: string;
  categoria: string;
  preco: number;
  ativo: boolean;
  descricao: string; // [REQ-003]
  foto: string; // URL local ou emoji (placeholder)
  ingredientes: string[]; // [REQ-005]
  adicionais: Adicional[];
}

export interface ItemPedido {
  produtoId: number;
  quantidade: number;
  precoUnitario: number; // copiado do produto no POST /pedidos [REQ-042]
  adicionais?: Adicional[]; // preço copiado no pedido [REQ-005]
  removidos?: string[];
  observacao?: string;
}

export interface Pedido {
  id: number;
  clienteId: number;
  entregadorId?: number;
  enderecoId?: number;
  itens: ItemPedido[];
  taxaEntrega: number;
  total: number; // calculado na API [REQ-036]
  formaPagamento: FormaPagamento;
  trocoPara?: number; // [REQ-043]
  status: StatusPedido;
  criadoEm: string;
}

export interface Endereco {
  id: number;
  clienteId: number;
  rua: string;
  numero: string;
  complemento?: string;
  bairroId: number;
}

export interface Bairro {
  id: number;
  nome: string;
  taxa: number;
}

export interface Loja {
  aberta: boolean;
  pedidoMinimo: number;
  tempoPreparoMin: number;
  tempoEntregaMin: number;
}

// Corpos de requisição (contrato v2.0.0).
export interface EnderecoEntrada {
  rua: string;
  numero: string;
  complemento?: string;
  bairroId: number;
}

export interface ItemPedidoEntrada {
  produtoId: number;
  quantidade: number;
  adicionais?: string[]; // nomes dos adicionais do produto
  removidos?: string[];
  observacao?: string;
}

export interface PedidoEntrada {
  itens: ItemPedidoEntrada[];
  enderecoId: number;
  formaPagamento: FormaPagamento;
  trocoPara?: number;
}

export interface PagamentoEntrada {
  aprovado: boolean;
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
