import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import type { Produto } from '../../../shared/tipos'
import { inicioDoPerfil, useSessao } from '../contexts/SessaoContext'
import { CHAVE_AVISO, api, mensagemDeErro } from '../services/api'
import { Logo } from '../components/Logo'
import { FotoProduto } from '../components/FotoProduto'
import { moeda } from '../services/formatar'

// Usuários fictícios da demonstração (DOC-01 p.8).
const usuariosTeste = [
  { email: 'cliente@demo.com', perfil: 'Cliente' },
  { email: 'loja@demo.com', perfil: 'Loja' },
  { email: 'entregador@demo.com', perfil: 'Entregador' },
]

const INTERVALO_CARROSSEL_MS = 4000

// Carrossel de destaques (coluna da esquerda): foto real, nome, descrição e preço.
function CarrosselDestaques() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [indice, setIndice] = useState(0)

  useEffect(() => {
    let ativo = true
    api
      .get<Produto[]>('/produtos')
      .then((r) => {
        if (!ativo) return
        setProdutos(r.data.filter((p) => p.ativo).slice(0, 4))
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    if (produtos.length < 2) return
    const id = window.setInterval(() => setIndice((i) => (i + 1) % produtos.length), INTERVALO_CARROSSEL_MS)
    return () => window.clearInterval(id)
  }, [produtos.length])

  if (produtos.length === 0) {
    return (
      <div className="carrossel-item vazio" role="status">
        <span className="icone-vazio" aria-hidden="true">
          🍔
        </span>
        <p>Buscando destaques…</p>
      </div>
    )
  }

  const atual = produtos[indice]
  const anterior = () => setIndice((indice - 1 + produtos.length) % produtos.length)
  const proximo = () => setIndice((indice + 1) % produtos.length)

  return (
    <>
      <div className="carrossel-item">
        <FotoProduto foto={atual.foto} nome={atual.nome} tamanho="grande" />
        <div className="carrossel-info">
          <h3>{atual.nome}</h3>
          <p className="detalhe">{atual.descricao}</p>
          <p className="preco">{moeda(atual.preco)}</p>
        </div>
      </div>
      <div className="carrossel-controles">
        <button type="button" className="carrossel-seta" aria-label="Destaque anterior" onClick={anterior}>
          ←
        </button>
        <div className="carrossel-pontos" role="tablist" aria-label="Escolher destaque">
          {produtos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={i === indice}
              aria-label={`Destaque ${i + 1}: ${p.nome}`}
              className={`ponto${i === indice ? ' ativo' : ''}`}
              onClick={() => setIndice(i)}
            />
          ))}
        </div>
        <button type="button" className="carrossel-seta" aria-label="Próximo destaque" onClick={proximo}>
          →
        </button>
      </div>
    </>
  )
}

export function Login() {
  const { token, usuario, login } = useSessao()
  const navegar = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  // Aviso deixado pelo interceptor depois de um 401 (RJ06).
  const [aviso] = useState(() => {
    const texto = sessionStorage.getItem(CHAVE_AVISO) ?? ''
    sessionStorage.removeItem(CHAVE_AVISO)
    return texto
  })

  if (token && usuario) return <Navigate to={inicioDoPerfil[usuario.perfil]} replace />

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      const u = await login(email, senha)
      navegar(inicioDoPerfil[u.perfil])
    } catch (err) {
      setErro(mensagemDeErro(err, 'E-mail ou senha incorretos'))
    } finally {
      setEnviando(false)
    }
  }

  function preencher(emailTeste: string) {
    setEmail(emailTeste)
    setSenha('123456')
  }

  return (
    <main className="login-page">
      <section className="login-visual" aria-labelledby="titulo-destaques">
        <div className="login-cabeca">
          <h2 id="titulo-destaques">Destaques</h2>
          <span className="selo">🔥 Promoção</span>
        </div>
        <CarrosselDestaques />
      </section>
      <div className="login-form">
        <Logo />
        <h1>Entrar</h1>
        {aviso && (
          <p className="aviso" role="status">
            {aviso}
          </p>
        )}
        <form onSubmit={enviar}>
          <label>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {erro && (
            <p className="erro" role="alert">
              {erro}
            </p>
          )}
          <button type="submit" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p>
          Não tem conta? <Link to="/cadastro">Cadastre-se</Link>
        </p>
        <section className="teste" aria-labelledby="titulo-teste">
          <h2 id="titulo-teste">Usuários de teste (senha 123456)</h2>
          <ul>
            {usuariosTeste.map((u) => (
              <li key={u.email}>
                <button type="button" className="link" onClick={() => preencher(u.email)}>
                  {u.perfil}: {u.email}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}