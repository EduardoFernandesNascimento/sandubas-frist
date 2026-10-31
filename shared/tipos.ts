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
  telefone?: string; // fictício [REQ-031]
}

// Contrato v3.0.0 (F-003). [REQ-026] [REQ-030]
export interface Entregador {
  id: number;
  nome: string;
  telefone?: string;
  disponivel: boolean;
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
  nome: string; // copiado do produto no POST /pedidos (AUD-001)
  quantidade: number;
  precoUnitario: number; // copiado do produto no POST /pedidos [REQ-042]
  adicionais?: Adicional[]; // preço copiado no pedido [REQ-005]
  removidos?: string[];
  observacao?: string;
}

// [REQ-044] RN12
export interface HistoricoStatus {
  status: StatusPedido;
  em: string;
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
  historico: HistoricoStatus[]; // [REQ-044]
  motivo?: string; // recusa ou cancelamento da loja [REQ-017]
  estornoRegistrado?: boolean; // [REQ-038] RN06
}

// [REQ-031] [REQ-032] entrega do entregador logado (GET /entregas).
export interface Entrega {
  pedido: Pedido; // traz total e formaPagamento
  endereco: Endereco;
  bairro: Bairro;
  clienteNome: string;
  clienteTelefone?: string;
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

// Corpos de requisição (contrato v2.0.0, mantidos na v3.0.0).
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

// Corpos de requisição (contrato v3.0.0).
export interface StatusEntrada {
  status: StatusPedido;
  motivo?: string; // obrigatório quando status = cancelado
}

export interface AtribuicaoEntrada {
  entregadorId: number;
}

export interface DisponibilidadeEntrada {
  disponivel: boolean;
}

export interface ProdutoEntrada {
  nome: string;
  categoria: string;
  preco: number;
  ativo?: boolean; // padrão true na criação
  descricao?: string;
  foto?: string;
  ingredientes?: string[];
  adicionais?: Adicional[];
}

export interface ProdutoAtivoEntrada {
  ativo: boolean;
}

export interface BairroEntrada {
  nome: string;
  taxa: number;
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
