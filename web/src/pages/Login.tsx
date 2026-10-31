import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { inicioDoPerfil, useSessao } from '../contexts/SessaoContext'
import { CHAVE_AVISO, mensagemDeErro } from '../services/api'

// Usuários fictícios da demonstração (DOC-01 p.8).
const usuariosTeste = [
  { email: 'cliente@demo.com', perfil: 'Cliente' },
  { email: 'loja@demo.com', perfil: 'Loja' },
  { email: 'entregador@demo.com', perfil: 'Entregador' },
]

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
    <main className="cartao">
      <h1>Entrar</h1>
      {aviso && <p className="aviso" role="status">{aviso}</p>}
      <form onSubmit={enviar}>
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete="current-password" />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="submit" disabled={enviando}>{enviando ? 'Entrando...' : 'Entrar'}</button>
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
    </main>
  )
}
