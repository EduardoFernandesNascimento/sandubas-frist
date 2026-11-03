// API do First Sanduba's (DOC-01 p.5): Express num único arquivo, dados em db.json. [REQ-050]
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import jwt, { type SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import type {
  Adicional, Bairro, Endereco, Entrega, Entregador, FormaPagamento, ItemPedido, JwtPayload, Loja, Pedido, Perfil, Produto,
  RespostaLogin, StatusPedido, Usuario,
} from '../shared/tipos';

interface UsuarioDb extends Usuario { senhaHash: string; disponivel?: boolean }
interface Db { loja: Loja; usuarios: UsuarioDb[]; produtos: Produto[]; pedidos: Pedido[]; bairros: Bairro[]; enderecos: Endereco[] }

const pasta = dirname(fileURLToPath(import.meta.url));
// DB_ARQUIVO permite aos testes usar uma cópia temporária.
const caminhoDb = () => process.env.DB_ARQUIVO ?? join(pasta, 'db.json');
const lerDb = (): Db => JSON.parse(readFileSync(caminhoDb(), 'utf8'));
const gravarDb = (db: Db) => writeFileSync(caminhoDb(), JSON.stringify(db, null, 2));

const segredo = () => {
  const s = process.env.JWT_SEGREDO;
  if (!s && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SEGREDO obrigatório em produção');
  }
  return s ?? 'segredo-de-demonstracao';
};
const expiraEm = () => process.env.JWT_EXPIRA_EM ?? '5m'; // HUM-001 [REQ-062]

// Só as chaves do contrato (MEM-001): nunca devolve senhaHash.
const publico = (u: UsuarioDb): Usuario => ({
  id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, ...(u.telefone !== undefined && { telefone: u.telefone }),
});
const erro = (res: Response, status: number, mensagem: string) => res.status(status).json({ mensagem });
const emailValido = (v: unknown): v is string => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const somenteChaves = (corpo: object, chaves: string[]) => Object.keys(corpo).every(k => chaves.includes(k));

// Middlewares exportados para as próximas features. [REQ-056] [REQ-057]
export function autenticar(req: Request, res: Response, next: NextFunction) {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) return erro(res, 401, 'Token ausente');
  try {
    res.locals.usuario = jwt.verify(token, segredo(), { algorithms: ['HS256'] }) as unknown as JwtPayload;
    next();
  } catch {
    erro(res, 401, 'Token inválido ou expirado');
  }
}

export function exigirPerfil(...perfis: Perfil[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const usuario = res.locals.usuario as JwtPayload | undefined;
    if (!usuario) return erro(res, 401, 'Token ausente');
    if (!perfis.includes(usuario.perfil)) return erro(res, 403, 'Perfil sem permissão');
    next();
  };
}

export const app = express();
const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.post('/auth/login', (req, res) => {
  const corpo = req.body ?? {};
  if (!somenteChaves(corpo, ['email', 'senha']) || !emailValido(corpo.email) || typeof corpo.senha !== 'string' || !corpo.senha)
    return erro(res, 400, 'Informe e-mail e senha');
  const usuario = lerDb().usuarios.find(u => u.email === corpo.email.toLowerCase());
  if (!usuario || !bcrypt.compareSync(corpo.senha, usuario.senhaHash)) return erro(res, 401, 'E-mail ou senha incorretos');
  const token = jwt.sign({ sub: usuario.id, nome: usuario.nome, perfil: usuario.perfil }, segredo(), {
    algorithm: 'HS256',
    expiresIn: expiraEm() as SignOptions['expiresIn'],
  });
  const resposta: RespostaLogin = { token, usuario: publico(usuario) };
  res.json(resposta);
});

app.post('/auth/cadastro', (req, res) => {
  const corpo = req.body ?? {};
  if (!somenteChaves(corpo, ['nome', 'email', 'senha']) || typeof corpo.nome !== 'string' || !corpo.nome.trim()
    || !emailValido(corpo.email) || typeof corpo.senha !== 'string' || corpo.senha.length < 6)
    return erro(res, 400, 'Informe nome, e-mail válido e senha com pelo menos 6 caracteres');
  const db = lerDb();
  const email = corpo.email.toLowerCase();
  if (db.usuarios.some(u => u.email === email)) return erro(res, 409, 'E-mail já cadastrado');
  const novo: UsuarioDb = {
    id: Math.max(0, ...db.usuarios.map(u => u.id)) + 1,
    nome: corpo.nome.trim(),
    email,
    perfil: 'cliente',
    senhaHash: bcrypt.hashSync(corpo.senha, 10), // [REQ-071]
  };
  db.usuarios.push(novo);
  gravarDb(db);
  res.status(201).json(publico(novo));
});

// ---- Contrato v2.0.0 (F-002) ----
// Projeções: só as chaves do contrato (MEM-001).
const centavos = (v: number) => Math.round(v * 100) / 100;
const adicionalPub = (a: Adicional): Adicional => ({ nome: a.nome, preco: a.preco });
const produtoPub = (p: Produto): Produto => ({
  id: p.id, nome: p.nome, categoria: p.categoria, preco: p.preco, ativo: p.ativo,
  descricao: p.descricao, foto: p.foto, ingredientes: [...p.ingredientes], adicionais: p.adicionais.map(adicionalPub),
});
const enderecoPub = (e: Endereco): Endereco => ({
  id: e.id, clienteId: e.clienteId, rua: e.rua, numero: e.numero,
  ...(e.complemento !== undefined && { complemento: e.complemento }), bairroId: e.bairroId,
});
const itemPub = (i: ItemPedido): ItemPedido => ({
  produtoId: i.produtoId, nome: i.nome ?? `Produto ${i.produtoId}`, quantidade: i.quantidade, precoUnitario: i.precoUnitario, // AUD-001: itens antigos sem nome
  ...(i.adicionais && { adicionais: i.adicionais.map(adicionalPub) }),
  ...(i.removidos && { removidos: [...i.removidos] }),
  ...(i.observacao !== undefined && { observacao: i.observacao }),
});
const pedidoPub = (p: Pedido): Pedido => ({
  id: p.id, clienteId: p.clienteId,
  ...(p.entregadorId !== undefined && { entregadorId: p.entregadorId }),
  ...(p.enderecoId !== undefined && { enderecoId: p.enderecoId }),
  itens: p.itens.map(itemPub), taxaEntrega: p.taxaEntrega, total: p.total, formaPagamento: p.formaPagamento,
  ...(p.trocoPara !== undefined && { trocoPara: p.trocoPara }),
  status: p.status, criadoEm: p.criadoEm,
  historico: (p.historico ?? []).map(h => ({ status: h.status, em: h.em })), // [REQ-044] pedidos antigos sem histórico
  ...(p.motivo !== undefined && { motivo: p.motivo }),
  ...(p.estornoRegistrado !== undefined && { estornoRegistrado: p.estornoRegistrado }),
});
// [REQ-044] RN12: toda mudança de status entra no histórico com data e hora.
const mudarStatus = (p: Pedido, status: StatusPedido) => {
  p.status = status;
  p.historico = [...(p.historico ?? []), { status, em: new Date().toISOString() }];
};

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ehInteiro = (v: unknown): v is number => Number.isInteger(v);
const ehTexto = (v: unknown): v is string => typeof v === 'string';
const listaDeTextos = (v: unknown): v is string[] => Array.isArray(v) && v.every(ehTexto);
const proximoId = (lista: { id: number }[]) => Math.max(0, ...lista.map(x => x.id)) + 1;
const usuarioAtual = (res: Response) => res.locals.usuario as JwtPayload;
const soCliente = [autenticar, exigirPerfil('cliente')];

// [REQ-003] [REQ-040] cardápio público só com produtos ativos (RN08).
// [REQ-021] com ?todos=1 exige perfil loja e inclui os inativos.
const lojaSeTodos = (req: Request, res: Response, next: NextFunction) => {
  if (req.query.todos === undefined) return next();
  if (req.query.todos !== '1') return erro(res, 400, 'Parâmetro todos aceita só 1');
  autenticar(req, res, () => exigirPerfil('loja')(req, res, next));
};
app.get('/produtos', lojaSeTodos, (req: Request, res: Response) => {
  const todos = req.query.todos === '1';
  res.json(lerDb().produtos.filter(p => todos || p.ativo).map(produtoPub));
});

// [REQ-033] [REQ-009]
app.get('/loja', (_req, res) => {
  const { aberta, pedidoMinimo, tempoPreparoMin, tempoEntregaMin } = lerDb().loja;
  res.json({ aberta, pedidoMinimo, tempoPreparoMin, tempoEntregaMin });
});

// [REQ-035]
app.get('/bairros', (_req, res) => {
  res.json(lerDb().bairros.map(b => ({ id: b.id, nome: b.nome, taxa: b.taxa })));
});

// [REQ-007]
app.get('/enderecos', ...soCliente, (_req: Request, res: Response) => {
  const id = usuarioAtual(res).sub;
  res.json(lerDb().enderecos.filter(e => e.clienteId === id).map(enderecoPub));
});

// [REQ-007] [REQ-035] bairro fora da lista → 400 (RN03).
app.post('/enderecos', ...soCliente, (req: Request, res: Response) => {
  const c: unknown = req.body;
  if (!ehObjeto(c) || !somenteChaves(c, ['rua', 'numero', 'complemento', 'bairroId'])
    || !ehTexto(c.rua) || !c.rua.trim() || !ehTexto(c.numero) || !c.numero.trim()
    || (c.complemento !== undefined && !ehTexto(c.complemento)) || !ehInteiro(c.bairroId))
    return erro(res, 400, 'Informe rua, número e bairro');
  const db = lerDb();
  if (!db.bairros.some(b => b.id === c.bairroId)) return erro(res, 400, 'Bairro fora da área de entrega');
  const novo: Endereco = {
    id: proximoId(db.enderecos), clienteId: usuarioAtual(res).sub, rua: c.rua.trim(), numero: c.numero.trim(),
    ...(ehTexto(c.complemento) && c.complemento.trim() && { complemento: c.complemento.trim() }), bairroId: c.bairroId as number,
  };
  db.enderecos.push(novo);
  gravarDb(db);
  res.status(201).json(enderecoPub(novo));
});

const FORMAS: FormaPagamento[] = ['pix', 'cartao', 'dinheiro'];

// [REQ-033] [REQ-034] [REQ-036] [REQ-040] [REQ-042] [REQ-005] [REQ-010] [REQ-043]
app.post('/pedidos', ...soCliente, (req: Request, res: Response) => {
  const c: unknown = req.body;
  if (!ehObjeto(c) || !somenteChaves(c, ['itens', 'enderecoId', 'formaPagamento', 'trocoPara'])
    || !Array.isArray(c.itens) || c.itens.length === 0 || !ehInteiro(c.enderecoId)
    || !FORMAS.includes(c.formaPagamento as FormaPagamento)
    || (c.trocoPara !== undefined && typeof c.trocoPara !== 'number'))
    return erro(res, 400, 'Informe itens, endereço e forma de pagamento');
  for (const i of c.itens as unknown[]) {
    if (!ehObjeto(i) || !somenteChaves(i, ['produtoId', 'quantidade', 'adicionais', 'removidos', 'observacao'])
      || !ehInteiro(i.produtoId) || !ehInteiro(i.quantidade) || i.quantidade < 1
      || (i.adicionais !== undefined && !listaDeTextos(i.adicionais))
      || (i.removidos !== undefined && !listaDeTextos(i.removidos))
      || (i.observacao !== undefined && !ehTexto(i.observacao)))
      return erro(res, 400, 'Item do pedido inválido');
  }
  const formaPagamento = c.formaPagamento as FormaPagamento;
  if (c.trocoPara !== undefined && formaPagamento !== 'dinheiro') return erro(res, 400, 'Troco só para pagamento em dinheiro');

  const db = lerDb();
  if (!db.loja.aberta) return erro(res, 400, 'A loja está fechada'); // RN01
  const clienteId = usuarioAtual(res).sub;
  const endereco = db.enderecos.find(e => e.id === c.enderecoId && e.clienteId === clienteId);
  if (!endereco) return erro(res, 400, 'Endereço não encontrado');
  const bairro = db.bairros.find(b => b.id === endereco.bairroId);
  if (!bairro) return erro(res, 400, 'Bairro fora da área de entrega');

  // Preços sempre do cardápio (RN04, RN10): o que o front mandar de preço é ignorado.
  const itens: ItemPedido[] = [];
  let subtotal = 0;
  for (const i of c.itens as Record<string, unknown>[]) {
    const produto = db.produtos.find(p => p.id === i.produtoId);
    if (!produto || !produto.ativo) return erro(res, 400, 'Produto indisponível'); // RN08
    const nomes = (i.adicionais as string[] | undefined) ?? [];
    const adicionais: Adicional[] = [];
    for (const nome of nomes) {
      const a = produto.adicionais.find(x => x.nome === nome);
      if (!a) return erro(res, 400, `Adicional "${nome}" não existe para ${produto.nome}`);
      adicionais.push(adicionalPub(a));
    }
    const removidos = (i.removidos as string[] | undefined) ?? [];
    if (removidos.some(r => !produto.ingredientes.includes(r))) return erro(res, 400, 'Ingrediente removido não existe no produto');
    const quantidade = i.quantidade as number;
    subtotal += (produto.preco + adicionais.reduce((s, a) => s + a.preco, 0)) * quantidade;
    itens.push({
      produtoId: produto.id, nome: produto.nome, quantidade, precoUnitario: produto.preco, // AUD-001
      ...(adicionais.length && { adicionais }),
      ...(removidos.length && { removidos }),
      ...(ehTexto(i.observacao) && i.observacao.trim() && { observacao: i.observacao.trim() }),
    });
  }
  subtotal = centavos(subtotal);
  if (subtotal < db.loja.pedidoMinimo) return erro(res, 400, `Pedido mínimo de R$ ${db.loja.pedidoMinimo.toFixed(2).replace('.', ',')}`); // RN02
  const total = centavos(subtotal + bairro.taxa);
  if (c.trocoPara !== undefined && (c.trocoPara as number) < total) return erro(res, 400, 'O troco deve ser para um valor maior ou igual ao total');

  const criadoEm = new Date().toISOString();
  const pedido: Pedido = {
    id: proximoId(db.pedidos), clienteId, enderecoId: endereco.id, itens, taxaEntrega: bairro.taxa, total, formaPagamento,
    ...(c.trocoPara !== undefined && { trocoPara: c.trocoPara as number }),
    status: 'aguardando_pagamento', criadoEm, historico: [{ status: 'aguardando_pagamento', em: criadoEm }], // [REQ-044]
  };
  db.pedidos.push(pedido);
  gravarDb(db);
  res.status(201).json(pedidoPub(pedido));
});

// [REQ-012]
app.get('/pedidos/meus', ...soCliente, (_req: Request, res: Response) => {
  const id = usuarioAtual(res).sub;
  res.json(lerDb().pedidos.filter(p => p.clienteId === id).map(pedidoPub));
});

// [REQ-037] pagamento simulado (RN05): só o dono do pedido.
app.post('/pedidos/:id/pagamento', ...soCliente, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const c: unknown = req.body;
  if (!ehInteiro(id) || !ehObjeto(c) || !somenteChaves(c, ['aprovado']) || typeof c.aprovado !== 'boolean')
    return erro(res, 400, 'Informe se o pagamento foi aprovado');
  const db = lerDb();
  const pedido = db.pedidos.find(p => p.id === id);
  if (!pedido) return erro(res, 404, 'Pedido não encontrado');
  if (pedido.clienteId !== usuarioAtual(res).sub) return erro(res, 403, 'Pedido de outro cliente');
  if (pedido.status !== 'aguardando_pagamento') return erro(res, 400, 'Pedido não está aguardando pagamento');
  mudarStatus(pedido, c.aprovado ? 'recebido' : 'cancelado'); // [REQ-044]
  gravarDb(db);
  res.json(pedidoPub(pedido));
});

// ---- Contrato v3.0.0 (F-003) ----
const soLoja = [autenticar, exigirPerfil('loja')];
const soEntregador = [autenticar, exigirPerfil('entregador')];
const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const idDaRota = (req: Request) => Number(req.params.id);

// [REQ-029] [REQ-039] painel da loja: todos os pedidos, recebidos primeiro (RN07), depois os mais novos.
app.get('/pedidos', ...soLoja, (_req: Request, res: Response) => {
  const lista = [...lerDb().pedidos].sort((a, b) =>
    Number(b.status === 'recebido') - Number(a.status === 'recebido') || b.criadoEm.localeCompare(a.criadoEm));
  res.json(lista.map(pedidoPub));
});

// Ciclo do pedido (requisitos F-003): quem leva de qual status para qual.
const TRANSICOES: Record<'loja' | 'entregador', Partial<Record<StatusPedido, StatusPedido[]>>> = {
  loja: { recebido: ['em_preparo', 'cancelado'], em_preparo: ['pronto', 'cancelado'], pronto: ['cancelado'] },
  entregador: { pronto: ['saiu_para_entrega'], saiu_para_entrega: ['entregue'] },
};
const STATUS: StatusPedido[] = ['aguardando_pagamento', 'recebido', 'em_preparo', 'pronto', 'saiu_para_entrega', 'entregue', 'cancelado'];

// [REQ-017] [REQ-018] [REQ-038] [REQ-044] [REQ-045]
app.patch('/pedidos/:id/status', autenticar, exigirPerfil('loja', 'entregador'), (req: Request, res: Response) => {
  const id = idDaRota(req);
  const c: unknown = req.body;
  if (!ehInteiro(id) || !ehObjeto(c) || !somenteChaves(c, ['status', 'motivo']) || !STATUS.includes(c.status as StatusPedido)
    || (c.motivo !== undefined && !ehTexto(c.motivo)))
    return erro(res, 400, 'Informe um status válido');
  const novo = c.status as StatusPedido;
  const motivo = ehTexto(c.motivo) ? c.motivo.trim() : '';
  if (novo === 'cancelado' && !motivo) return erro(res, 400, 'Informe o motivo da recusa ou do cancelamento');
  if (novo !== 'cancelado' && c.motivo !== undefined) return erro(res, 400, 'Motivo só para cancelamento');
  const db = lerDb();
  const pedido = db.pedidos.find(p => p.id === id);
  if (!pedido) return erro(res, 404, 'Pedido não encontrado');
  const usuario = usuarioAtual(res);
  const perfil = usuario.perfil as 'loja' | 'entregador';
  if (perfil === 'entregador' && pedido.entregadorId !== usuario.sub) return erro(res, 403, 'Pedido não atribuído a você');
  if (!(TRANSICOES[perfil][pedido.status] ?? []).includes(novo))
    return erro(res, 400, `Não é possível passar de ${pedido.status} para ${novo}`);
  if (novo === 'cancelado') {
    pedido.motivo = motivo;
    // RN06: cancelamento depois do aceite só registra o estorno quando o pagamento foi aprovado.
    if (pedido.status !== 'recebido' && (pedido.historico ?? []).some(h => h.status === 'recebido')) pedido.estornoRegistrado = true;
  }
  mudarStatus(pedido, novo);
  gravarDb(db);
  res.json(pedidoPub(pedido));
});

// [REQ-026] RF27: só entregador disponível; pedido ainda na loja.
app.patch('/pedidos/:id/entregador', ...soLoja, (req: Request, res: Response) => {
  const id = idDaRota(req);
  const c: unknown = req.body;
  if (!ehInteiro(id) || !ehObjeto(c) || !somenteChaves(c, ['entregadorId']) || !ehInteiro(c.entregadorId))
    return erro(res, 400, 'Informe o entregador');
  const db = lerDb();
  const pedido = db.pedidos.find(p => p.id === id);
  if (!pedido) return erro(res, 404, 'Pedido não encontrado');
  if (!['recebido', 'em_preparo', 'pronto'].includes(pedido.status)) return erro(res, 400, 'Pedido não pode receber entregador neste status');
  const entregador = db.usuarios.find(u => u.id === c.entregadorId && u.perfil === 'entregador');
  if (!entregador) return erro(res, 400, 'Entregador não encontrado');
  if (!entregador.disponivel) return erro(res, 400, 'Entregador indisponível');
  pedido.entregadorId = entregador.id;
  gravarDb(db);
  res.json(pedidoPub(pedido));
});

// [REQ-021] [REQ-022] cadastro de produtos pela loja.
const adicionalValido = (v: unknown) => ehObjeto(v) && somenteChaves(v, ['nome', 'preco'])
  && ehTexto(v.nome) && !!v.nome.trim() && ehNumero(v.preco) && v.preco >= 0;
const produtoEntradaValida = (c: unknown): c is Record<string, unknown> => ehObjeto(c)
  && somenteChaves(c, ['nome', 'categoria', 'preco', 'ativo', 'descricao', 'foto', 'ingredientes', 'adicionais'])
  && ehTexto(c.nome) && !!c.nome.trim() && ehTexto(c.categoria) && !!c.categoria.trim() && ehNumero(c.preco) && c.preco > 0
  && (c.ativo === undefined || typeof c.ativo === 'boolean')
  && (c.descricao === undefined || ehTexto(c.descricao)) && (c.foto === undefined || ehTexto(c.foto))
  && (c.ingredientes === undefined || listaDeTextos(c.ingredientes))
  && (c.adicionais === undefined || (Array.isArray(c.adicionais) && c.adicionais.every(adicionalValido)));
const MSG_PRODUTO = 'Informe nome, categoria e preço maior que zero';
// Campos opcionais ausentes ficam com o valor de base (padrão na criação, o atual na edição).
const montarProduto = (c: Record<string, unknown>, base: Produto): Produto => ({
  id: base.id, nome: (c.nome as string).trim(), categoria: (c.categoria as string).trim(), preco: centavos(c.preco as number),
  ativo: (c.ativo as boolean | undefined) ?? base.ativo,
  descricao: (c.descricao as string | undefined) ?? base.descricao,
  foto: (c.foto as string | undefined) ?? base.foto,
  ingredientes: [...((c.ingredientes as string[] | undefined) ?? base.ingredientes)],
  adicionais: ((c.adicionais as Adicional[] | undefined) ?? base.adicionais).map(a => ({ nome: a.nome.trim(), preco: a.preco })),
});

app.post('/produtos', ...soLoja, (req: Request, res: Response) => {
  const c: unknown = req.body;
  if (!produtoEntradaValida(c)) return erro(res, 400, MSG_PRODUTO);
  const db = lerDb();
  const produto = montarProduto(c, {
    id: proximoId(db.produtos), nome: '', categoria: '', preco: 0, ativo: true, descricao: '', foto: '🍽️', ingredientes: [], adicionais: [],
  });
  db.produtos.push(produto);
  gravarDb(db);
  res.status(201).json(produtoPub(produto));
});

app.put('/produtos/:id', ...soLoja, (req: Request, res: Response) => {
  const id = idDaRota(req);
  const c: unknown = req.body;
  if (!ehInteiro(id) || !produtoEntradaValida(c)) return erro(res, 400, MSG_PRODUTO);
  const db = lerDb();
  const i = db.produtos.findIndex(p => p.id === id);
  if (i < 0) return erro(res, 404, 'Produto não encontrado');
  db.produtos[i] = montarProduto(c, db.produtos[i]);
  gravarDb(db);
  res.json(produtoPub(db.produtos[i]));
});

// [REQ-022] RF23: pausar sem excluir; some do cardápio do cliente (RN08).
app.patch('/produtos/:id', ...soLoja, (req: Request, res: Response) => {
  const id = idDaRota(req);
  const c: unknown = req.body;
  if (!ehInteiro(id) || !ehObjeto(c) || !somenteChaves(c, ['ativo']) || typeof c.ativo !== 'boolean')
    return erro(res, 400, 'Informe ativo como true ou false');
  const db = lerDb();
  const produto = db.produtos.find(p => p.id === id);
  if (!produto) return erro(res, 404, 'Produto não encontrado');
  produto.ativo = c.ativo;
  gravarDb(db);
  res.json(produtoPub(produto));
});

// [REQ-024] RF25: bairros e taxa de entrega.
const bairroEntradaValida = (c: unknown): c is { nome: string; taxa: number } => ehObjeto(c) && somenteChaves(c, ['nome', 'taxa'])
  && ehTexto(c.nome) && !!c.nome.trim() && ehNumero(c.taxa) && c.taxa >= 0;
const MSG_BAIRRO = 'Informe nome e taxa maior ou igual a zero';

app.post('/bairros', ...soLoja, (req: Request, res: Response) => {
  const c: unknown = req.body;
  if (!bairroEntradaValida(c)) return erro(res, 400, MSG_BAIRRO);
  const db = lerDb();
  const bairro: Bairro = { id: proximoId(db.bairros), nome: c.nome.trim(), taxa: centavos(c.taxa) };
  db.bairros.push(bairro);
  gravarDb(db);
  res.status(201).json(bairro);
});

app.put('/bairros/:id', ...soLoja, (req: Request, res: Response) => {
  const id = idDaRota(req);
  const c: unknown = req.body;
  if (!ehInteiro(id) || !bairroEntradaValida(c)) return erro(res, 400, MSG_BAIRRO);
  const db = lerDb();
  const bairro = db.bairros.find(b => b.id === id);
  if (!bairro) return erro(res, 404, 'Bairro não encontrado');
  bairro.nome = c.nome.trim();
  bairro.taxa = centavos(c.taxa);
  gravarDb(db);
  res.json({ id: bairro.id, nome: bairro.nome, taxa: bairro.taxa });
});

// [REQ-026] [REQ-030] entregadores e disponibilidade.
const entregadorPub = (u: UsuarioDb): Entregador => ({
  id: u.id, nome: u.nome, ...(u.telefone !== undefined && { telefone: u.telefone }), disponivel: u.disponivel ?? false,
});

app.get('/entregadores', ...soLoja, (_req: Request, res: Response) => {
  res.json(lerDb().usuarios.filter(u => u.perfil === 'entregador').map(entregadorPub));
});

app.patch('/entregadores/me', ...soEntregador, (req: Request, res: Response) => {
  const c: unknown = req.body;
  if (!ehObjeto(c) || !somenteChaves(c, ['disponivel']) || typeof c.disponivel !== 'boolean')
    return erro(res, 400, 'Informe disponivel como true ou false');
  const db = lerDb();
  const eu = db.usuarios.find(u => u.id === usuarioAtual(res).sub && u.perfil === 'entregador');
  if (!eu) return erro(res, 401, 'Usuário não encontrado');
  eu.disponivel = c.disponivel;
  gravarDb(db);
  res.json(entregadorPub(eu));
});

// [REQ-031] [REQ-032] só as entregas do entregador logado, com endereço completo e contato do cliente.
app.get('/entregas', ...soEntregador, (_req: Request, res: Response) => {
  const db = lerDb();
  const eu = usuarioAtual(res).sub;
  const entregas: Entrega[] = [];
  for (const p of db.pedidos.filter(x => x.entregadorId === eu).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))) {
    const endereco = db.enderecos.find(e => e.id === p.enderecoId);
    const bairro = endereco && db.bairros.find(b => b.id === endereco.bairroId);
    const cliente = db.usuarios.find(u => u.id === p.clienteId);
    if (!endereco || !bairro || !cliente) continue;
    entregas.push({
      pedido: pedidoPub(p), endereco: enderecoPub(endereco), bairro: { id: bairro.id, nome: bairro.nome, taxa: bairro.taxa },
      clienteNome: cliente.nome, ...(cliente.telefone !== undefined && { clienteTelefone: cliente.telefone }),
    });
  }
  res.json(entregas);
});

// Erros sem stack trace (JSON malformado vira 400).
app.use((err: { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  if (err.status === 400) return erro(res, 400, 'JSON inválido');
  erro(res, 500, 'Erro interno');
});

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const porta = Number(process.env.PORTA ?? 3000);
  app.listen(porta, () => console.log(`API em http://localhost:${porta}`));
}
