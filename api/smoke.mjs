// Smoke de RNF03 [REQ-050]: sobe a API com `npm start`, chama GET /produtos e encerra.
// Uso: npm run smoke (porta via SMOKE_PORTA, padrão 3999). Só lê; não altera o db.json.
import { spawn, spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pasta = dirname(fileURLToPath(import.meta.url));
const porta = Number(process.env.SMOKE_PORTA ?? 3999);
const base = `http://127.0.0.1:${porta}`;
const windows = process.platform === 'win32';

const filho = spawn(windows ? 'npm start' : 'npm', windows ? [] : ['start'], {
  cwd: pasta,
  env: { ...process.env, PORTA: String(porta) },
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: windows,
  detached: !windows,
});
let saidaFilho = '';
filho.stdout.on('data', d => { saidaFilho += d; });
filho.stderr.on('data', d => { saidaFilho += d; });
let filhoSaiu = false;
filho.on('exit', () => { filhoSaiu = true; });

function encerrar() {
  if (filhoSaiu || !filho.pid) return;
  try {
    if (windows) spawnSync('taskkill', ['/pid', String(filho.pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-filho.pid, 'SIGTERM');
  } catch { /* já encerrado */ }
}
process.on('exit', encerrar);
for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => { encerrar(); process.exit(1); });

const espera = ms => new Promise(r => setTimeout(r, ms));

async function aguardarPronta(limiteMs = 30000) {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    if (filhoSaiu) throw new Error(`a API encerrou antes de ficar pronta\n${saidaFilho}`);
    try {
      return await fetch(`${base}/produtos`);
    } catch { await espera(300); }
  }
  throw new Error(`a API não respondeu em ${limiteMs} ms\n${saidaFilho}`);
}

let codigo = 1;
try {
  const resp = await aguardarPronta();
  const corpo = await resp.json().catch(() => null);
  if (resp.status !== 200) throw new Error(`status ${resp.status} em GET /produtos`);
  if (!Array.isArray(corpo) || corpo.length === 0) throw new Error('GET /produtos não devolveu uma lista não vazia');
  console.log(`smoke ok: ${resp.status}, ${corpo.length} produtos`);
  codigo = 0;
} catch (erro) {
  console.error(`smoke falhou: ${erro.message}`);
} finally {
  encerrar();
}
process.exit(codigo);
