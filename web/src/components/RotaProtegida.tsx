import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { Perfil } from '../../../shared/tipos'
import { inicioDoPerfil, useSessao } from '../contexts/SessaoContext'

// RJ05 (REQ-058): sem token vai para /login; perfil errado vai para a própria página inicial.
export function RotaProtegida({ perfis, children }: { perfis: Perfil[]; children: ReactNode }) {
  const { token, usuario } = useSessao()
  if (!token || !usuario) return <Navigate to="/login" replace />
  if (!perfis.includes(usuario.perfil)) return <Navigate to={inicioDoPerfil[usuario.perfil]} replace />
  return <>{children}</>
}
