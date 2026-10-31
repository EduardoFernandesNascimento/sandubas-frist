// Roteiro de demonstração do PDF (DOC-01 p.13), passos 2 a 7, de ponta a ponta pela API. [REQ-069]
// O passo 1 (o React redireciona para o login) é conferência manual, descrita no README.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app } from './server';

// Cópia temporária do db.json: o original não é alterado.
const dir = mkdtempSync(join(tmpdir(), 'sanduba-roteiro-'));
beforeAll(() => {
  const copia = join(dir, 'db.json');
  copyFileSync(join(import.meta.dirname, 'db.json'), copia);
  process.env.DB_ARQUIVO = copia;
  delete process.env.JWT_EXPIRA_EM;
});
afterAll(() => {
  delete process.env.JWT_EXPIRA_EM;
  rmSync(dir, { recursive: true, force: true });
});

const entrar = async (email: string) => {
  const r = await request(app).post('/auth/login').send({ email, senha: '123456' });
  expect(r.status).toBe(200);
  return r.body.token as string;
};
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// Os passos dependem um do outro (o pedido do passo 3 segue até o 6); no mesmo arquivo o vitest roda em ordem.
describe('Roteiro de demonstração (DOC-01 p.13)', () => {
  let tokenCliente = '';
  let pedidoId = 0;

  it('[REQ-069] passo 2: login do cliente devolve o JWT com sub, nome, perfil e exp no payload', async () => {
    tokenCliente = await entrar('cliente@demo.com');
    const dec = jwt.decode(tokenCliente, { complete: true })!;
    expect(dec.header.alg).toBe('HS256');
    const p = dec.payload as Record<string, unknown>;
    expect(p.sub).toBe(1);
    expect(p.nome).toBe('Cliente Demo');
    expect(p.perfil).toBe('cliente');
    expect(typeof p.exp).toBe('number');
  });

  it('[REQ-069] passo 3: pedido confirmado com Authorization: Bearer (sem o cabeçalho, 401)', async () => {
    const corpo = { itens: [{ produtoId: 1, quantidade: 1 }], enderecoId: 1, formaPagamento: 'pix' };
    expect((await request(app).post('/pedidos').send(corpo)).status).toBe(401);
    const r = await request(app).post('/pedidos').set(bearer(tokenCliente)).send(corpo);
    expect(r.status).toBe(201);
    pedidoId = r.body.id;
    const pago = await request(app).post(`/pedidos/${pedidoId}/pagamento`).set(bearer(tokenCliente)).send({ aprovado: true });
    expect(pago.status).toBe(200);
    expect(pago.body.status).toBe('recebido');
  });

  it('[REQ-069] passo 4: com o token de cliente, GET /pedidos responde 403', async () => {
    const r = await request(app).get('/pedidos').set(bearer(tokenCliente));
    expect(r.status).toBe(403);
    expect(Object.keys(r.body)).toEqual(['mensagem']);
  });

  it('[REQ-069] passo 5: a loja vê o pedido, aceita e muda os status', async () => {
    const loja = await entrar('loja@demo.com');
    const lista = await request(app).get('/pedidos').set(bearer(loja));
    expect(lista.status).toBe(200);
    expect(lista.body.some((p: { id: number }) => p.id === pedidoId)).toBe(true);
    for (const status of ['em_preparo', 'pronto']) {
      const r = await request(app).patch(`/pedidos/${pedidoId}/status`).set(bearer(loja)).send({ status });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe(status);
    }
    const atribuido = await request(app).patch(`/pedidos/${pedidoId}/entregador`).set(bearer(loja)).send({ entregadorId: 3 });
    expect(atribuido.status).toBe(200);
  });

  it('[REQ-069] passo 6: o entregador confirma a entrega e o cliente vê "entregue"', async () => {
    const entregador = await entrar('entregador@demo.com');
    const entregas = await request(app).get('/entregas').set(bearer(entregador));
    expect(entregas.body.some((e: { pedido: { id: number } }) => e.pedido.id === pedidoId)).toBe(true);
    for (const status of ['saiu_para_entrega', 'entregue']) {
      const r = await request(app).patch(`/pedidos/${pedidoId}/status`).set(bearer(entregador)).send({ status });
      expect(r.status).toBe(200);
    }
    const meus = await request(app).get('/pedidos/meus').set(bearer(tokenCliente));
    expect(meus.body.find((p: { id: number }) => p.id === pedidoId).status).toBe('entregue');
  });

  it('[REQ-069] passo 7: depois que o token expira, a próxima chamada devolve 401', async () => {
    process.env.JWT_EXPIRA_EM = '1s';
    const curto = await entrar('cliente@demo.com');
    expect((await request(app).get('/pedidos/meus').set(bearer(curto))).status).toBe(200);
    await new Promise(r => setTimeout(r, 2100));
    const r = await request(app).get('/pedidos/meus').set(bearer(curto));
    expect(r.status).toBe(401);
    expect(Object.keys(r.body)).toEqual(['mensagem']);
  }, 10_000);
});
