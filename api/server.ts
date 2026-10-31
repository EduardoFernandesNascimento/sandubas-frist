// API do Sanduba's Frist (DOC-01 p.5): Express num único arquivo, dados em db.json. [REQ-050]
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import jwt, { type SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import type { JwtPayload, Perfil, Produto, RespostaLogin, Usuario } from '../shared/tipos';

interface UsuarioDb extends Usuario { senhaHash: string }
interface Db { usuarios: UsuarioDb[]; produtos: Produto[]; pedidos: unknown[]; bairros: unknown[] }

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

app.get('/produtos', (_req, res) => {
  const produtos: Produto[] = lerDb().produtos.map(p => ({ id: p.id, nome: p.nome, categoria: p.categoria, preco: p.preco, ativo: p.ativo }));
  res.json(produtos);
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
