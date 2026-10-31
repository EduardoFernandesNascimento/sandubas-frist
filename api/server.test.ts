import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
const CHAVES_PRODUTO = ['ativo', 'categoria', 'id', 'nome', 'preco'];
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
  it('[REQ-057] [REQ-070] é público e devolve só as chaves do contrato', async () => {
    const r = await request(app).get('/produtos');
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThanOrEqual(10);
    for (const p of r.body) expect(chaves(p)).toEqual(CHAVES_PRODUTO);
    const categorias = new Set(r.body.map((p: { categoria: string }) => p.categoria));
    expect(categorias.size).toBe(5);
  });
});
