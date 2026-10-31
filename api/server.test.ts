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
    expect(chaves(r.body.usuario)).toEqual(CHAVES_USUARIO);
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
  ['id', 'clienteId', 'itens', 'taxaEntrega', 'total', 'formaPagamento', 'status', 'criadoEm'],
  ['entregadorId', 'enderecoId', 'trocoPara'],
];
const ITEM: [string[], string[]] = [['produtoId', 'quantidade', 'precoUnitario'], ['adicionais', 'removidos', 'observacao']];
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
});

