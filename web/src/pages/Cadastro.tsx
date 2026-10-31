import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Usuario } from '../../../shared/tipos'
import { useSessao } from '../contexts/SessaoContext'
import { api, mensagemDeErro } from '../services/api'

// RF01 (REQ-001): cadastro de cliente; depois entra direto.
export function Cadastro() {
  const { login } = useSessao()
  const navegar = useNavigate()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await api.post<Usuario>('/auth/cadastro', { nome, email, senha })
      await login(email, senha)
      navegar('/cliente')
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não foi possível cadastrar'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="cartao">
      <h1>Criar conta</h1>
      <form onSubmit={enviar}>
        <label>
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} required autoComplete="name" />
        </label>
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Senha (mínimo 6 caracteres)
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} autoComplete="new-password" />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="submit" disabled={enviando}>{enviando ? 'Cadastrando...' : 'Cadastrar'}</button>
      </form>
      <p>
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </main>
  )
}
