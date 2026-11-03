import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app, autenticar, exigirPerfil } from './server';

// Cópia temporária do db.json: o original não é alterado.
const dir = mkdtempSync(join(tmpdir(), 'sanduba-db-'));
const copia = join(dir, 'db.json');
beforeEach(() => {
  copyFileSync(join(import.meta.dirname, 'db.json'), copia);
  process.env.DB_ARQUIVO = copia;
  delete process.env.JWT_EXPIRA_EM;
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const chaves = (o: object) => Object.keys(o).sort();
const CHAVES_USUARIO = ['email', 'id', 'nome', 'perfil'];
const CHAVES_PRODUTO = ['adicionais', 'ativo', 'categoria', 'descricao', 'foto', 'id', 'ingredientes', 'nome', 'preco'];
const login = (email: string, senha = '123456') => request(app).post('/auth/login').send({ email, senha });

// App de teste com uma rota protegida usando os middlewares exportados.
const protegido = express();
protegido.get('/so-loja', autenticar, exigirPerfil('loja'), (_req, res) => { res.json({ ok: true }); });

describe('POST /auth/login', () => {
  it('[REQ-054] [REQ-052] credencial certa devolve 200 com JWT HS256 e payload sub, nome, perfil, exp', async () => {
    const r = await login('cliente@demo.com');
    expect(r.status).toBe(200);
    expect(chaves(r.body)).toEqual(['token', 'usuario']);
    expect(chaves(r.body.usuario)).toEqual([...CHAVES_USUARIO, 'telefone']); // telefone fictício (v3)
    const dec = jwt.decode(r.body.token, { complete: true })!;
    expect(dec.header.alg).toBe('HS256');
    const p = dec.payload as Record<string, unknown>;
    expect(p.sub).toBe(1);
    expect(p.nome).toBe('Cliente Demo');
    expect(p.perfil).toBe('cliente');
    expect(typeof p.exp).toBe('number');
  });

  it('[REQ-054] credencial errada devolve 401', async () => {
    const r = await login('cliente@demo.com', 'errada');
    expect(r.status).toBe(401);
    expect(chaves(r.body)).toEqual(['mensagem']);
    const r2 = await login('ninguem@demo.com');
    expect(r2.status).toBe(401);
  });

  it('[REQ-064] login de cada usuário de teste devolve o perfil certo', async () => {
    for (const perfil of ['cliente', 'loja', 'entregador']) {
      const r = await login(`${perfil}@demo.com`);
      expect(r.status).toBe(200);
      expect(r.body.usuario.perfil).toBe(perfil);
    }
  });

  it('[REQ-062] exp fica cerca de 5 min depois do iat (padrão) e respeita JWT_EXPIRA_EM', async () => {
    const p = jwt.decode((await login('loja@demo.com')).body.token) as { iat: number; exp: number };
    expect(p.exp - p.iat).toBe(300);
    process.env.JWT_EXPIRA_EM = '10m';
    const p2 = jwt.decode((await login('loja@demo.com')).body.token) as { iat: number; exp: number };
    expect(p2.exp - p2.iat).toBe(600);
  });

  it('[REQ-054] corpo inválido devolve 400 sem stack trace', async () => {
    const r = await request(app).post('/auth/login').set('Content-Type', 'application/json').send('{quebrado');
    expect(r.status).toBe(400);
    expect(chaves(r.body)).toEqual(['mensagem']);
  });
});

describe('POST /auth/cadastro', () => {
  it('[REQ-001] [REQ-071] cadastro devolve 201, perfil cliente e senha em hash; e-mail repetido devolve 409', async () => {
    const novo = { nome: 'Fulano Teste', email: 'fulano@demo.com', senha: 'abcdef' };
    const r = await request(app).post('/auth/cadastro').send(novo);
    expect(r.status).toBe(201);
    expect(chaves(r.body)).toEqual(CHAVES_USUARIO);
    expect(r.body.perfil).toBe('cliente');
    const gravado = readFileSync(copia, 'utf8');
    expect(gravado).toContain('fulano@demo.com');
    expect(gravado).not.toContain('"abcdef"');
    expect((await login('fulano@demo.com', 'abcdef')).status).toBe(200);
    const r2 = await request(app).post('/auth/cadastro').send(novo);
    expect(r2.status).toBe(409);
    expect(chaves(r2.body)).toEqual(['mensagem']);
  });

  it('[REQ-001] senha curta devolve 400', async () => {
    const r = await request(app).post('/auth/cadastro').send({ nome: 'X', email: 'x@demo.com', senha: '123' });
    expect(r.status).toBe(400);
    expect(chaves(r.body)).toEqual(['mensagem']);
  });
});

describe('middlewares', () => {
  it('[REQ-056] token ausente devolve 401', async () => {
    const r = await request(protegido).get('/so-loja');
    expect(r.status).toBe(401);
    expect(chaves(r.body)).toEqual(['mensagem']);
  });

  it('[REQ-056] token inválido devolve 401', async () => {
    const r = await request(protegido).get('/so-loja').set('Authorization', 'Bearer abc.def.ghi');
    expect(r.status).toBe(401);
  });

  it('[REQ-057] perfil errado devolve 403 e perfil certo passa', async () => {
    const tCliente = (await login('cliente@demo.com')).body.token;
    const r = await request(protegido).get('/so-loja').set('Authorization', `Bearer ${tCliente}`);
    expect(r.status).toBe(403);
    expect(chaves(r.body)).toEqual(['mensagem']);
    const tLoja = (await login('loja@demo.com')).body.token;
    expect((await request(protegido).get('/so-loja').set('Authorization', `Bearer ${tLoja}`)).status).toBe(200);
  });
});

describe('GET /produtos', () => {
  it('[REQ-057] [REQ-070] [REQ-003] é público e devolve só as chaves do contrato, com descrição, foto, ingredientes e adicionais', async () => {
    const r = await request(app).get('/produtos');
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThanOrEqual(9);
    for (const p of r.body) {
      expect(chaves(p)).toEqual(CHAVES_PRODUTO);
      for (const a of p.adicionais) expect(chaves(a)).toEqual(['nome', 'preco']);
    }
    const categorias = new Set(r.body.map((p: { categoria: string }) => p.categoria));
    expect(categorias.size).toBe(5);
  });

  it('[REQ-040] produto pausado (ativo: false) não aparece no cardápio', async () => {
    const r = await request(app).get('/produtos');
    expect(r.body.some((p: { id: number }) => p.id === 9)).toBe(false);
    expect(r.body.every((p: { ativo: boolean }) => p.ativo)).toBe(true);
  });
});

// ---- F-002 ----
type Obj = Record<string, unknown>;
// Confere as chaves contra o contrato: obrigatórias presentes e nenhuma fora do schema (MEM-001).
const conforme = (o: Obj, obrigatorias: string[], opcionais: string[] = []) => {
  for (const k of obrigatorias) expect(o).toHaveProperty(k);
  for (const k of Object.keys(o)) expect([...obrigatorias, ...opcionais]).toContain(k);
};
const ENDERECO: [string[], string[]] = [['id', 'clienteId', 'rua', 'numero', 'bairroId'], ['complemento']];
const PEDIDO: [string[], string[]] = [
  ['id', 'clienteId', 'itens', 'taxaEntrega', 'total', 'formaPagamento', 'status', 'criadoEm', 'historico'],
  ['entregadorId', 'enderecoId', 'trocoPara', 'motivo', 'estornoRegistrado'],
];
const ITEM: [string[], string[]] = [['produtoId', 'nome', 'quantidade', 'precoUnitario'], ['adicionais', 'removidos', 'observacao']];
const conformePedido = (p: Obj) => {
  conforme(p, ...PEDIDO);
  for (const i of p.itens as Obj[]) {
    conforme(i, ...ITEM);
    for (const a of (i.adicionais as Obj[] | undefined) ?? []) expect(chaves(a)).toEqual(['nome', 'preco']);
  }
};

const token = async (email = 'cliente@demo.com') => `Bearer ${(await login(email)).body.token}`;
const alterarDb = (f: (db: { loja: Obj; produtos: Obj[] }) => void) => {
  const db = JSON.parse(readFileSync(copia, 'utf8'));
  f(db);
  writeFileSync(copia, JSON.stringify(db));
};
const novoPedido = async (corpo: Obj, email = 'cliente@demo.com') =>
  request(app).post('/pedidos').set('Authorization', await token(email)).send(corpo);
// Endereço 1 do cliente 1 fica no bairro 1 (taxa 5,00).
const BASICO = { itens: [{ produtoId: 1, quantidade: 1 }], enderecoId: 1, formaPagamento: 'pix' };

describe('GET /loja e GET /bairros', () => {
  it('[REQ-033] [REQ-009] /loja é público e devolve só as chaves do contrato', async () => {
    const r = await request(app).get('/loja');
    expect(r.status).toBe(200);
    expect(chaves(r.body)).toEqual(['aberta', 'pedidoMinimo', 'tempoEntregaMin', 'tempoPreparoMin']);
    expect(r.body.pedidoMinimo).toBe(10);
  });

  it('[REQ-035] /bairros é público e devolve id, nome e taxa', async () => {
    const r = await request(app).get('/bairros');
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
    for (const b of r.body) expect(chaves(b)).toEqual(['id', 'nome', 'taxa']);
  });
});

describe('/enderecos', () => {
  it('[REQ-007] sem token devolve 401 e perfil loja devolve 403', async () => {
    expect((await request(app).get('/enderecos')).status).toBe(401);
    const r = await request(app).get('/enderecos').set('Authorization', await token('loja@demo.com'));
    expect(r.status).toBe(403);
    expect(chaves(r.body)).toEqual(['mensagem']);
  });

  it('[REQ-007] cliente cadastra endereço e o vê na lista', async () => {
    const t = await token();
    const r = await request(app).post('/enderecos').set('Authorization', t).send({ rua: 'Rua Nova', numero: '42', bairroId: 2 });
    expect(r.status).toBe(201);
    conforme(r.body, ...ENDERECO);
    expect(r.body.clienteId).toBe(1);
    const lista = await request(app).get('/enderecos').set('Authorization', t);
    expect(lista.status).toBe(200);
    for (const e of lista.body) { conforme(e, ...ENDERECO); expect(e.clienteId).toBe(1); }
    expect(lista.body.some((e: { id: number }) => e.id === r.body.id)).toBe(true);
  });

  it('[REQ-035] endereço com bairro fora da lista devolve 400', async () => {
    const r = await request(app).post('/enderecos').set('Authorization', await token()).send({ rua: 'Rua X', numero: '1', bairroId: 999 });
    expect(r.status).toBe(400);
    expect(chaves(r.body)).toEqual(['mensagem']);
  });

  it('[REQ-007] corpo com chave fora do contrato devolve 400', async () => {
    const r = await request(app).post('/enderecos').set('Authorization', await token()).send({ rua: 'Rua X', numero: '1', bairroId: 1, cep: '0' });
    expect(r.status).toBe(400);
  });
});

describe('POST /pedidos', () => {
  it('[REQ-036] [REQ-042] [REQ-005] total = itens + adicionais + taxa, calculado na API; preço copiado do produto', async () => {
    const r = await novoPedido({
      itens: [{ produtoId: 1, quantidade: 2, adicionais: ['Bacon', 'Ovo'], removidos: ['cebola'], observacao: 'bem passado' }],
      enderecoId: 1, formaPagamento: 'pix',
    });
    expect(r.status).toBe(201);
    conformePedido(r.body);
    expect(r.body.status).toBe('aguardando_pagamento');
    expect(r.body.itens[0].precoUnitario).toBe(22.9);
    expect(r.body.itens[0].adicionais).toEqual([{ nome: 'Bacon', preco: 4 }, { nome: 'Ovo', preco: 2.5 }]);
    expect(r.body.itens[0].removidos).toEqual(['cebola']);
    expect(r.body.taxaEntrega).toBe(5);
    expect(r.body.total).toBe(63.8); // (22,90 + 4,00 + 2,50) x 2 + 5,00
  });

  it('[REQ-036] total ou preço enviados pelo front nunca são usados (chave fora do contrato → 400)', async () => {
    expect((await novoPedido({ ...BASICO, total: 1 })).status).toBe(400);
    expect((await novoPedido({ ...BASICO, itens: [{ produtoId: 1, quantidade: 1, precoUnitario: 0.01 }] })).status).toBe(400);
  });

  it('[REQ-042] preço registrado no pedido não muda quando o cardápio muda', async () => {
    const r = await novoPedido(BASICO);
    alterarDb(db => { (db.produtos.find(p => p.id === 1) as Obj).preco = 99; });
    const meus = await request(app).get('/pedidos/meus').set('Authorization', await token());
    const p = meus.body.find((x: { id: number }) => x.id === r.body.id);
    expect(p.itens[0].precoUnitario).toBe(22.9);
    expect(p.total).toBe(27.9);
  });

  it('[REQ-033] loja fechada devolve 400', async () => {
    alterarDb(db => { db.loja.aberta = false; });
    const r = await novoPedido(BASICO);
    expect(r.status).toBe(400);
    expect(chaves(r.body)).toEqual(['mensagem']);
  });

  it('[REQ-034] abaixo do pedido mínimo de R$ 10,00 devolve 400', async () => {
    const r = await novoPedido({ ...BASICO, itens: [{ produtoId: 6, quantidade: 1 }] }); // 6,00
    expect(r.status).toBe(400);
    expect(chaves(r.body)).toEqual(['mensagem']);
    expect((await novoPedido({ ...BASICO, itens: [{ produtoId: 6, quantidade: 2 }] })).status).toBe(201); // 12,00
  });

  it('[REQ-040] produto inativo devolve 400', async () => {
    const r = await novoPedido({ ...BASICO, itens: [{ produtoId: 9, quantidade: 1 }] });
    expect(r.status).toBe(400);
    expect(chaves(r.body)).toEqual(['mensagem']);
  });

  it('[REQ-005] adicional inexistente devolve 400', async () => {
    expect((await novoPedido({ ...BASICO, itens: [{ produtoId: 1, quantidade: 1, adicionais: ['Caviar'] }] })).status).toBe(400);
  });

  it('[REQ-043] [REQ-010] trocoPara só com dinheiro', async () => {
    const r = await novoPedido({ ...BASICO, formaPagamento: 'dinheiro', trocoPara: 50 });
    expect(r.status).toBe(201);
    conformePedido(r.body);
    expect(r.body.trocoPara).toBe(50);
    expect((await novoPedido({ ...BASICO, formaPagamento: 'pix', trocoPara: 50 })).status).toBe(400);
    expect((await novoPedido({ ...BASICO, formaPagamento: 'boleto' })).status).toBe(400);
  });

  it('[REQ-007] endereço inexistente ou de outro cliente devolve 400', async () => {
    expect((await novoPedido({ ...BASICO, enderecoId: 999 })).status).toBe(400);
  });

  it('[REQ-057] sem token devolve 401 e perfil loja devolve 403', async () => {
    expect((await request(app).post('/pedidos').send(BASICO)).status).toBe(401);
    expect((await novoPedido(BASICO, 'loja@demo.com')).status).toBe(403);
  });
});

describe('GET /pedidos/meus', () => {
  it('[REQ-012] devolve só os pedidos do cliente logado, com as chaves do contrato', async () => {
    const r = await request(app).get('/pedidos/meus').set('Authorization', await token());
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
    for (const p of r.body) { conformePedido(p); expect(p.clienteId).toBe(1); }
    expect((await request(app).get('/pedidos/meus')).status).toBe(401);
  });
});

describe('POST /pedidos/:id/pagamento', () => {
  it('[REQ-037] aprovado → recebido; recusado → cancelado; pedido já pago → 400', async () => {
    const t = await token();
    const a = (await novoPedido(BASICO)).body;
    const r = await request(app).post(`/pedidos/${a.id}/pagamento`).set('Authorization', t).send({ aprovado: true });
    expect(r.status).toBe(200);
    conformePedido(r.body);
    expect(r.body.status).toBe('recebido');
    expect((await request(app).post(`/pedidos/${a.id}/pagamento`).set('Authorization', t).send({ aprovado: true })).status).toBe(400);
    const b = (await novoPedido(BASICO)).body;
    const r2 = await request(app).post(`/pedidos/${b.id}/pagamento`).set('Authorization', t).send({ aprovado: false });
    expect(r2.status).toBe(200);
    expect(r2.body.status).toBe('cancelado');
  });

  it('[REQ-037] pedido de outro cliente → 403; inexistente → 404; corpo inválido → 400', async () => {
    const a = (await novoPedido(BASICO)).body;
    await request(app).post('/auth/cadastro').send({ nome: 'Outro', email: 'outro@demo.com', senha: '123456' });
    const outro = await token('outro@demo.com');
    const r = await request(app).post(`/pedidos/${a.id}/pagamento`).set('Authorization', outro).send({ aprovado: true });
    expect(r.status).toBe(403);
    expect(chaves(r.body)).toEqual(['mensagem']);
    const r2 = await request(app).post('/pedidos/9999/pagamento').set('Authorization', outro).send({ aprovado: true });
    expect(r2.status).toBe(404);
    expect(chaves(r2.body)).toEqual(['mensagem']);
    const t = await token();
    expect((await request(app).post(`/pedidos/${a.id}/pagamento`).set('Authorization', t).send({ aprovado: 'sim' })).status).toBe(400);
  });

  it('[REQ-044] pagamento acrescenta o status ao histórico', async () => {
    const a = (await novoPedido(BASICO)).body;
    expect(a.historico.map((h: Obj) => h.status)).toEqual(['aguardando_pagamento']);
    const r = await request(app).post(`/pedidos/${a.id}/pagamento`).set('Authorization', await token()).send({ aprovado: true });
    expect(r.body.historico.map((h: Obj) => h.status)).toEqual(['aguardando_pagamento', 'recebido']);
    for (const h of r.body.historico) { expect(chaves(h)).toEqual(['em', 'status']); expect(Number.isNaN(Date.parse(h.em))).toBe(false); }
  });
});

// ---- F-003 ----
const ENTREGADOR: [string[], string[]] = [['id', 'nome', 'disponivel'], ['telefone']];
const ENTREGA: [string[], string[]] = [['pedido', 'endereco', 'bairro', 'clienteNome'], ['clienteTelefone']];
const PRODUTO_NOVO = { nome: 'Sanduba Teste', categoria: 'lanches', preco: 19.9, ingredientes: ['pão'], adicionais: [{ nome: 'Ovo', preco: 2 }] };
const comToken = async (email: string) => {
  const t = await token(email);
  return {
    get: (url: string) => request(app).get(url).set('Authorization', t),
    post: (url: string, corpo: object) => request(app).post(url).set('Authorization', t).send(corpo),
    put: (url: string, corpo: object) => request(app).put(url).set('Authorization', t).send(corpo),
    patch: (url: string, corpo: object) => request(app).patch(url).set('Authorization', t).send(corpo),
  };
};
// Pedido novo do cliente 1, já pago (status recebido).
const pedidoPago = async () => {
  const p = (await novoPedido(BASICO)).body;
  await request(app).post(`/pedidos/${p.id}/pagamento`).set('Authorization', await token()).send({ aprovado: true });
  return p.id as number;
};

describe('GET /pedidos (loja)', () => {
  it('[REQ-029] cliente recebe 403, entregador 403 e sem token 401', async () => {
    const r = await request(app).get('/pedidos').set('Authorization', await token());
    expect(r.status).toBe(403);
    expect(chaves(r.body)).toEqual(['mensagem']);
    expect((await request(app).get('/pedidos').set('Authorization', await token('entregador@demo.com'))).status).toBe(403);
    expect((await request(app).get('/pedidos')).status).toBe(401);
  });

  it('[REQ-039] [REQ-029] loja vê todos os pedidos com as chaves do contrato e os recebidos no topo', async () => {
    await novoPedido(BASICO); // aguardando_pagamento, mais novo
    const r = await (await comToken('loja@demo.com')).get('/pedidos');
    expect(r.status).toBe(200);
    for (const p of r.body) conformePedido(p);
    const status = r.body.map((p: Obj) => p.status);
    const ultimoRecebido = status.lastIndexOf('recebido');
    expect(ultimoRecebido).toBeGreaterThanOrEqual(0);
    expect(status.slice(0, ultimoRecebido + 1).every((s: string) => s === 'recebido')).toBe(true);
  });
});

describe('PATCH /pedidos/:id/status', () => {
  it('[REQ-017] loja aceita (em_preparo) e o histórico ganha o status', async () => {
    const id = await pedidoPago();
    const r = await (await comToken('loja@demo.com')).patch(`/pedidos/${id}/status`, { status: 'em_preparo' });
    expect(r.status).toBe(200);
    conformePedido(r.body);
    expect(r.body.status).toBe('em_preparo');
    expect(r.body.historico.map((h: Obj) => h.status)).toEqual(['aguardando_pagamento', 'recebido', 'em_preparo']);
  });

  it('[REQ-017] recusa sem motivo devolve 400; com motivo cancela sem estorno', async () => {
    const id = await pedidoPago();
    const loja = await comToken('loja@demo.com');
    const r = await loja.patch(`/pedidos/${id}/status`, { status: 'cancelado' });
    expect(r.status).toBe(400);
    expect(chaves(r.body)).toEqual(['mensagem']);
    expect((await loja.patch(`/pedidos/${id}/status`, { status: 'cancelado', motivo: '  ' })).status).toBe(400);
    const r2 = await loja.patch(`/pedidos/${id}/status`, { status: 'cancelado', motivo: 'Sem pão' });
    expect(r2.status).toBe(200);
    conformePedido(r2.body);
    expect(r2.body.status).toBe('cancelado');
    expect(r2.body.motivo).toBe('Sem pão');
    expect(r2.body.estornoRegistrado).toBeUndefined();
  });

  it('[REQ-038] cancelamento da loja depois do aceite com pagamento aprovado grava estornoRegistrado', async () => {
    const id = await pedidoPago();
    const loja = await comToken('loja@demo.com');
    await loja.patch(`/pedidos/${id}/status`, { status: 'em_preparo' });
    const r = await loja.patch(`/pedidos/${id}/status`, { status: 'cancelado', motivo: 'Faltou ingrediente' });
    expect(r.status).toBe(200);
    conformePedido(r.body);
    expect(r.body.estornoRegistrado).toBe(true);
    expect(r.body.historico.at(-1).status).toBe('cancelado');
  });

  it('[REQ-018] transição fora do ciclo devolve 400', async () => {
    const loja = await comToken('loja@demo.com');
    const novo = (await novoPedido(BASICO)).body; // aguardando_pagamento
    expect((await loja.patch(`/pedidos/${novo.id}/status`, { status: 'em_preparo' })).status).toBe(400);
    const id = await pedidoPago();
    expect((await loja.patch(`/pedidos/${id}/status`, { status: 'pronto' })).status).toBe(400); // pula em_preparo
    expect((await loja.patch(`/pedidos/${id}/status`, { status: 'entregue' })).status).toBe(400);
    expect((await loja.patch(`/pedidos/${id}/status`, { status: 'inventado' })).status).toBe(400);
    expect((await loja.patch(`/pedidos/${id}/status`, { status: 'em_preparo', motivo: 'x' })).status).toBe(400);
    expect((await loja.patch('/pedidos/9999/status', { status: 'em_preparo' })).status).toBe(404);
  });

  it('[REQ-018] loja não muda para saiu_para_entrega; entregador não aceita pedido; cliente recebe 403', async () => {
    const id = await pedidoPago();
    const loja = await comToken('loja@demo.com');
    await loja.patch(`/pedidos/${id}/status`, { status: 'em_preparo' });
    await loja.patch(`/pedidos/${id}/status`, { status: 'pronto' });
    await loja.patch(`/pedidos/${id}/entregador`, { entregadorId: 3 });
    expect((await loja.patch(`/pedidos/${id}/status`, { status: 'saiu_para_entrega' })).status).toBe(400);
    const outro = await pedidoPago();
    await loja.patch(`/pedidos/${outro}/entregador`, { entregadorId: 3 });
    const ent = await comToken('entregador@demo.com');
    expect((await ent.patch(`/pedidos/${outro}/status`, { status: 'em_preparo' })).status).toBe(400);
    expect((await (await comToken('cliente@demo.com')).patch(`/pedidos/${id}/status`, { status: 'entregue' })).status).toBe(403);
  });

  it('[REQ-018] entregador só muda pedidos atribuídos a ele', async () => {
    const id = await pedidoPago();
    const loja = await comToken('loja@demo.com');
    await loja.patch(`/pedidos/${id}/status`, { status: 'em_preparo' });
    await loja.patch(`/pedidos/${id}/status`, { status: 'pronto' });
    await loja.patch(`/pedidos/${id}/entregador`, { entregadorId: 4 });
    const r = await (await comToken('entregador@demo.com')).patch(`/pedidos/${id}/status`, { status: 'saiu_para_entrega' });
    expect(r.status).toBe(403);
    expect(chaves(r.body)).toEqual(['mensagem']);
    expect((await (await comToken('entregador2@demo.com')).patch(`/pedidos/${id}/status`, { status: 'saiu_para_entrega' })).status).toBe(200);
  });
});

describe('PATCH /pedidos/:id/entregador', () => {
  it('[REQ-026] loja atribui entregador disponível; indisponível ou inexistente devolve 400', async () => {
    const id = await pedidoPago();
    const loja = await comToken('loja@demo.com');
    const r = await loja.patch(`/pedidos/${id}/entregador`, { entregadorId: 3 });
    expect(r.status).toBe(200);
    conformePedido(r.body);
    expect(r.body.entregadorId).toBe(3);
    await (await comToken('entregador2@demo.com')).patch('/entregadores/me', { disponivel: false });
    const r2 = await loja.patch(`/pedidos/${id}/entregador`, { entregadorId: 4 });
    expect(r2.status).toBe(400);
    expect(chaves(r2.body)).toEqual(['mensagem']);
    expect((await loja.patch(`/pedidos/${id}/entregador`, { entregadorId: 1 })).status).toBe(400); // cliente
    expect((await loja.patch('/pedidos/9999/entregador', { entregadorId: 3 })).status).toBe(404);
    expect((await (await comToken('cliente@demo.com')).patch(`/pedidos/${id}/entregador`, { entregadorId: 3 })).status).toBe(403);
  });
});

describe('produtos da loja', () => {
  it('[REQ-021] GET /produtos?todos=1 exige loja e inclui os inativos', async () => {
    expect((await request(app).get('/produtos?todos=1')).status).toBe(401);
    expect((await (await comToken('cliente@demo.com')).get('/produtos?todos=1')).status).toBe(403);
    const r = await (await comToken('loja@demo.com')).get('/produtos?todos=1');
    expect(r.status).toBe(200);
    for (const p of r.body) expect(chaves(p)).toEqual(CHAVES_PRODUTO);
    expect(r.body.some((p: Obj) => p.id === 9 && p.ativo === false)).toBe(true);
    expect((await request(app).get('/produtos?todos=2')).status).toBe(400);
  });

  it('[REQ-021] loja cadastra e edita produto; dados inválidos devolvem 400', async () => {
    const loja = await comToken('loja@demo.com');
    const r = await loja.post('/produtos', PRODUTO_NOVO);
    expect(r.status).toBe(201);
    expect(chaves(r.body)).toEqual(CHAVES_PRODUTO);
    expect(r.body.ativo).toBe(true);
    expect((await request(app).get('/produtos')).body.some((p: Obj) => p.id === r.body.id)).toBe(true);
    const r2 = await loja.put(`/produtos/${r.body.id}`, { ...PRODUTO_NOVO, preco: 21.5, descricao: 'Nova descrição' });
    expect(r2.status).toBe(200);
    expect(chaves(r2.body)).toEqual(CHAVES_PRODUTO);
    expect(r2.body.preco).toBe(21.5);
    expect(r2.body.descricao).toBe('Nova descrição');
    expect((await loja.post('/produtos', { ...PRODUTO_NOVO, preco: 0 })).status).toBe(400);
    expect((await loja.post('/produtos', { ...PRODUTO_NOVO, id: 50 })).status).toBe(400);
    expect((await loja.put('/produtos/9999', PRODUTO_NOVO)).status).toBe(404);
    expect((await (await comToken('cliente@demo.com')).post('/produtos', PRODUTO_NOVO)).status).toBe(403);
  });

  it('[REQ-022] [REQ-040] produto pausado some do cardápio do cliente e não pode ser pedido', async () => {
    const loja = await comToken('loja@demo.com');
    const r = await loja.patch('/produtos/1', { ativo: false });
    expect(r.status).toBe(200);
    expect(chaves(r.body)).toEqual(CHAVES_PRODUTO);
    expect(r.body.ativo).toBe(false);
    expect((await request(app).get('/produtos')).body.some((p: Obj) => p.id === 1)).toBe(false);
    expect((await novoPedido(BASICO)).status).toBe(400);
    expect((await loja.patch('/produtos/1', { ativo: 'nao' })).status).toBe(400);
    expect((await loja.patch('/produtos/9999', { ativo: true })).status).toBe(404);
  });

  it('[REQ-022] AUD-001: o nome continua no item do pedido depois de pausar o produto', async () => {
    const p = (await novoPedido(BASICO)).body;
    expect(p.itens[0].nome).toBe('X-Burguer First');
    await (await comToken('loja@demo.com')).patch('/produtos/1', { ativo: false });
    const meus = await request(app).get('/pedidos/meus').set('Authorization', await token());
    const item = meus.body.find((x: Obj) => x.id === p.id).itens[0];
    expect(item.nome).toBe('X-Burguer First');
  });
});

describe('bairros da loja', () => {
  it('[REQ-024] loja cadastra e edita bairro; cliente recebe 403; inválido 400; inexistente 404', async () => {
    const loja = await comToken('loja@demo.com');
    const r = await loja.post('/bairros', { nome: 'Vila Nova Demo', taxa: 9 });
    expect(r.status).toBe(201);
    expect(chaves(r.body)).toEqual(['id', 'nome', 'taxa']);
    const r2 = await loja.put(`/bairros/${r.body.id}`, { nome: 'Vila Nova Demo', taxa: 9.5 });
    expect(r2.status).toBe(200);
    expect(chaves(r2.body)).toEqual(['id', 'nome', 'taxa']);
    expect((await request(app).get('/bairros')).body.find((b: Obj) => b.id === r.body.id).taxa).toBe(9.5);
    expect((await loja.post('/bairros', { nome: 'X', taxa: -1 })).status).toBe(400);
    expect((await loja.put('/bairros/9999', { nome: 'X', taxa: 1 })).status).toBe(404);
    expect((await (await comToken('cliente@demo.com')).post('/bairros', { nome: 'X', taxa: 1 })).status).toBe(403);
  });
});

describe('entregadores', () => {
  it('[REQ-026] GET /entregadores só para a loja, com as chaves do contrato', async () => {
    const r = await (await comToken('loja@demo.com')).get('/entregadores');
    expect(r.status).toBe(200);
    expect(r.body.length).toBe(2);
    for (const e of r.body) conforme(e, ...ENTREGADOR);
    expect((await (await comToken('entregador@demo.com')).get('/entregadores')).status).toBe(403);
  });

  it('[REQ-030] entregador marca-se indisponível e disponível', async () => {
    const ent = await comToken('entregador@demo.com');
    const r = await ent.patch('/entregadores/me', { disponivel: false });
    expect(r.status).toBe(200);
    conforme(r.body, ...ENTREGADOR);
    expect(r.body.disponivel).toBe(false);
    const lista = (await (await comToken('loja@demo.com')).get('/entregadores')).body;
    expect(lista.find((e: Obj) => e.id === 3).disponivel).toBe(false);
    expect((await ent.patch('/entregadores/me', { disponivel: true })).body.disponivel).toBe(true);
    expect((await ent.patch('/entregadores/me', { disponivel: 'sim' })).status).toBe(400);
    expect((await (await comToken('loja@demo.com')).patch('/entregadores/me', { disponivel: true })).status).toBe(403);
  });
});

describe('GET /entregas', () => {
  it('[REQ-031] [REQ-032] entregador vê só as entregas dele, com endereço completo, bairro e telefone do cliente', async () => {
    const id = await pedidoPago();
    await (await comToken('loja@demo.com')).patch(`/pedidos/${id}/entregador`, { entregadorId: 4 });
    const r = await (await comToken('entregador@demo.com')).get('/entregas');
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
    for (const e of r.body) {
      conforme(e, ...ENTREGA);
      conformePedido(e.pedido);
      conforme(e.endereco, ...ENDERECO);
      expect(chaves(e.bairro)).toEqual(['id', 'nome', 'taxa']);
      expect(e.pedido.entregadorId).toBe(3);
    }
    const e1 = r.body.find((e: Obj) => (e.pedido as Obj).id === 1);
    expect(e1.endereco).toMatchObject({ rua: 'Rua das Demonstrações', numero: '100', complemento: 'Apto 12' });
    expect(e1.bairro.nome).toBe('Vila Fictícia');
    expect(e1.clienteNome).toBe('Cliente Demo');
    expect(e1.clienteTelefone).toBe('(11) 90000-0001');
    expect(r.body.some((e: Obj) => (e.pedido as Obj).id === id)).toBe(false);
    expect((await request(app).get('/entregas').set('Authorization', await token())).status).toBe(403);
  });
});

describe('ciclo completo', () => {
  it('[REQ-045] [REQ-044] [REQ-018] cliente pede, paga, loja aceita e prepara, atribui, entregador retira e entrega; cliente vê entregue', async () => {
    const id = await pedidoPago();
    const loja = await comToken('loja@demo.com');
    const ent = await comToken('entregador@demo.com');
    expect((await loja.patch(`/pedidos/${id}/status`, { status: 'em_preparo' })).status).toBe(200);
    expect((await loja.patch(`/pedidos/${id}/status`, { status: 'pronto' })).status).toBe(200);
    expect((await loja.patch(`/pedidos/${id}/entregador`, { entregadorId: 3 })).status).toBe(200);
    expect((await ent.get('/entregas')).body.some((e: Obj) => (e.pedido as Obj).id === id)).toBe(true);
    expect((await ent.patch(`/pedidos/${id}/status`, { status: 'saiu_para_entrega' })).status).toBe(200);
    const fim = await ent.patch(`/pedidos/${id}/status`, { status: 'entregue' });
    expect(fim.status).toBe(200);
    conformePedido(fim.body);
    const meus = await request(app).get('/pedidos/meus').set('Authorization', await token());
    const p = meus.body.find((x: Obj) => x.id === id);
    conformePedido(p);
    expect(p.status).toBe('entregue');
    expect(p.historico.map((h: Obj) => h.status)).toEqual(
      ['aguardando_pagamento', 'recebido', 'em_preparo', 'pronto', 'saiu_para_entrega', 'entregue']);
    const datas = p.historico.map((h: Obj) => Date.parse(h.em as string));
    expect(datas.every((d: number, i: number) => i === 0 || d >= datas[i - 1])).toBe(true);
    expect((await ent.patch(`/pedidos/${id}/status`, { status: 'entregue' })).status).toBe(400);
  });
});

