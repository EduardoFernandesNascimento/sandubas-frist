import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Perfil, RespostaLogin, Usuario } from '../../../shared/tipos'
import { api, CHAVE_TOKEN, CHAVE_USUARIO } from '../services/api'

// REQ-051: sessão em Context API com login e logout.
interface Sessao {
  token: string | null
  usuario: Usuario | null
  login: (email: string, senha: string) => Promise<Usuario>
  logout: () => void
}

const SessaoContext = createContext<Sessao | null>(null)

function lerUsuario(): Usuario | null {
  const texto = localStorage.getItem(CHAVE_USUARIO)
  if (!texto) return null
  try {
    return JSON.parse(texto) as Usuario
  } catch {
    return null
  }
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(CHAVE_TOKEN))
  const [usuario, setUsuario] = useState<Usuario | null>(lerUsuario)

  async function login(email: string, senha: string): Promise<Usuario> {
    const { data } = await api.post<RespostaLogin>('/auth/login', { email, senha })
    localStorage.setItem(CHAVE_TOKEN, data.token)
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(data.usuario))
    setToken(data.token)
    setUsuario(data.usuario)
    return data.usuario
  }

  // RJ07 (REQ-060): logout limpa token e usuário.
  function logout() {
    localStorage.removeItem(CHAVE_TOKEN)
    localStorage.removeItem(CHAVE_USUARIO)
    setToken(null)
    setUsuario(null)
  }

  return (
    <SessaoContext.Provider value={{ token, usuario, login, logout }}>
      {children}
    </SessaoContext.Provider>
  )
}

export function useSessao(): Sessao {
  const sessao = useContext(SessaoContext)
  if (!sessao) throw new Error('useSessao precisa estar dentro de SessaoProvider')
  return sessao
}

// Página inicial de cada perfil.
export const inicioDoPerfil: Record<Perfil, string> = {
  cliente: '/cliente',
  loja: '/loja',
  entregador: '/entregas',
}
