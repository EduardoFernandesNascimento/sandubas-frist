import { useEffect, useState } from 'react'
import { CHAVE_TOKEN } from '../services/api'
import { Trilha } from '../components/Trilha'

// RJ08 (REQ-061): mostra o JWT do localStorage decodificado, sem biblioteca.
// base64url -> base64 -> texto UTF-8 -> JSON.
function decodificarParte(parte: string): Record<string, unknown> | null {
  try {
    const base64 = parte.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parte.length / 4) * 4, '=')
    const binario = atob(base64)
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
  } catch {
    return null
  }
}

function dataHora(segundos: unknown): string {
  return typeof segundos === 'number' ? new Date(segundos * 1000).toLocaleString('pt-BR') : '—'
}

function restante(segundos: number): string {
  if (segundos <= 0) return 'expirado'
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${m} min ${String(s).padStart(2, '0')} s`
}

export function MeuToken() {
  const token = localStorage.getItem(CHAVE_TOKEN) ?? ''
  const [agora, setAgora] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    const id = window.setInterval(() => setAgora(Math.floor(Date.now() / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [])

  const partes = token.split('.')
  const header = partes.length === 3 ? decodificarParte(partes[0]) : null
  const payload = partes.length === 3 ? decodificarParte(partes[1]) : null

  if (!header || !payload) {
    return (
      <main className="pagina">
        <h1>Meu token</h1>
        <p className="erro" role="alert">
          Não foi possível ler o token salvo no navegador.
        </p>
      </main>
    )
  }
  const exp = typeof payload.exp === 'number' ? payload.exp : null
  const campos = ['sub', 'nome', 'perfil', 'iat', 'exp'] as const

  return (
    <main className="pagina">
      <Trilha para="/" rotulo="início" atual="Meu token" />
      <h1>Meu token</h1>
      <p className="aviso">
        O navegador só <strong>lê</strong> o conteúdo do token: header e payload são apenas base64url. A{' '}
        <strong>assinatura</strong> (terceira parte) é conferida pela API a cada requisição, com o segredo que só o
        servidor conhece. Por isso ninguém consegue alterar o perfil aqui e ganhar acesso.
      </p>

      <section aria-labelledby="titulo-exp" className="sub-form">
        <h2 id="titulo-exp">Expiração</h2>
        <p>
          Expira em: <strong>{dataHora(exp)}</strong>
        </p>
        {exp !== null && (
          <p className={exp - agora <= 0 ? 'erro' : ''} aria-live="polite" aria-atomic="true">
            Tempo restante: <strong>{restante(exp - agora)}</strong>
          </p>
        )}
      </section>

      <section aria-labelledby="titulo-header">
        <h2 id="titulo-header">Header</h2>
        <pre className="codigo">{JSON.stringify(header, null, 2)}</pre>
      </section>

      <section aria-labelledby="titulo-payload">
        <h2 id="titulo-payload">Payload</h2>
        <dl className="resumo">
          {campos.map((c) => (
            <div key={c} className="linha-resumo">
              <dt>{c}</dt>
              <dd>
                {String(payload[c] ?? '—')}
                {(c === 'iat' || c === 'exp') && typeof payload[c] === 'number' && ` (${dataHora(payload[c])})`}
              </dd>
            </div>
          ))}
        </dl>
        <pre className="codigo">{JSON.stringify(payload, null, 2)}</pre>
      </section>

      <section aria-labelledby="titulo-bruto">
        <h2 id="titulo-bruto">Token como está no localStorage</h2>
        <p className="codigo token-bruto">
          <span className="jwt-h">{partes[0]}</span>.<span className="jwt-p">{partes[1]}</span>.
          <span className="jwt-a">{partes[2]}</span>
        </p>
      </section>
    </main>
  )
}
