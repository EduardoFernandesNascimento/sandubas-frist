import { NavLink, useNavigate } from 'react-router-dom'
import type { Perfil } from '../../../shared/tipos'
import { useSessao } from '../contexts/SessaoContext'

// Links do menu conforme o perfil (REQ-058).
const links: Record<Perfil, { para: string; texto: string }[]> = {
  cliente: [{ para: '/cliente', texto: 'Área do cliente' }],
  loja: [{ para: '/loja', texto: 'Painel da loja' }],
  entregador: [{ para: '/entregas', texto: 'Entregas' }],
}

export function Menu() {
  const { usuario, logout } = useSessao()
  const navegar = useNavigate()

  function sair() {
    logout()
    navegar('/login')
  }

  return (
    <header className="topo">
      <span className="marca">Sanduba's Frist</span>
      {usuario && (
        <nav aria-label="Menu principal" className="menu">
          {links[usuario.perfil].map((l) => (
            <NavLink key={l.para} to={l.para}>
              {l.texto}
            </NavLink>
          ))}
          <span className="quem">
            {usuario.nome} ({usuario.perfil})
          </span>
          <button type="button" className="botao-sair" onClick={sair}>
            Sair
          </button>
        </nav>
      )}
    </header>
  )
}
