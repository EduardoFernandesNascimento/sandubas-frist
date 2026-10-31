// API do Sanduba's Frist (DOC-01 p.5): Express num único arquivo, dados em db.json. [REQ-050]
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import jwt, { type SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import type {
  Adicional, Bairro, Endereco, FormaPagamento, ItemPedido, JwtPayload, Loja, Pedido, Perfil, Produto, RespostaLogin, Usuario,
} from '../shared/tipos';

interface UsuarioDb extends Usuario { senhaHash: string }
interface Db { loja: Loja; usuarios: UsuarioDb[]; produtos: Produto[]; pedidos: Pedido[]; bairros: Bairro[]; enderecos: Endereco[] }

const pasta = dirname(fileURLToPath(import.meta.url));
// DB_ARQUIVO permite aos testes usar uma cópia temporária.
const caminhoDb = () => process.env.DB_ARQUIVO ?? join(pasta, 'db.json');
const lerDb = (): Db => JSON.parse(readFileSync(caminhoDb(), 'utf8'));
const gravarDb = (db: Db) => writeFileSync(caminhoDb(), JSON.stringify(db, null, 2));

const segredo = () => process.env.JWT_SEGREDO ?? 'segredo-de-demonstracao';
const expiraEm = () => process.env.JWT_EXPIRA_EM ?? '5m'; // HUM-001 [REQ-062]

// Só as chaves do contrato (MEM-001): nunca devolve senhaHash.
const publico = (u: UsuarioDb): Usuario => ({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil });
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
app.use(cors({ origin: 'http://localhost:5173' }));
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
  produtoId: i.produtoId, quantidade: i.quantidade, precoUnitario: i.precoUnitario,
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
});

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ehInteiro = (v: unknown): v is number => Number.isInteger(v);
const ehTexto = (v: unknown): v is string => typeof v === 'string';
const listaDeTextos = (v: unknown): v is string[] => Array.isArray(v) && v.every(ehTexto);
const proximoId = (lista: { id: number }[]) => Math.max(0, ...lista.map(x => x.id)) + 1;
const usuarioAtual = (res: Response) => res.locals.usuario as JwtPayload;
const soCliente = [autenticar, exigirPerfil('cliente')];

// [REQ-003] [REQ-040] cardápio público só com produtos ativos (RN08).
app.get('/produtos', (_req, res) => {
  res.json(lerDb().produtos.filter(p => p.ativo).map(produtoPub));
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
      produtoId: produto.id, quantidade, precoUnitario: produto.preco,
      ...(adicionais.length && { adicionais }),
      ...(removidos.length && { removidos }),
      ...(ehTexto(i.observacao) && i.observacao.trim() && { observacao: i.observacao.trim() }),
    });
  }
  subtotal = centavos(subtotal);
  if (subtotal < db.loja.pedidoMinimo) return erro(res, 400, `Pedido mínimo de R$ ${db.loja.pedidoMinimo.toFixed(2).replace('.', ',')}`); // RN02
  const total = centavos(subtotal + bairro.taxa);
  if (c.trocoPara !== undefined && (c.trocoPara as number) < total) return erro(res, 400, 'O troco deve ser para um valor maior ou igual ao total');

  const pedido: Pedido = {
    id: proximoId(db.pedidos), clienteId, enderecoId: endereco.id, itens, taxaEntrega: bairro.taxa, total, formaPagamento,
    ...(c.trocoPara !== undefined && { trocoPara: c.trocoPara as number }),
    status: 'aguardando_pagamento', criadoEm: new Date().toISOString(),
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
  pedido.status = c.aprovado ? 'recebido' : 'cancelado';
  gravarDb(db);
  res.json(pedidoPub(pedido));
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
