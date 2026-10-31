import { Navigate, Route, Routes } from 'react-router-dom'
import { Menu } from './components/Menu'
import { RotaProtegida } from './components/RotaProtegida'
import { inicioDoPerfil, useSessao } from './contexts/SessaoContext'
import { Cadastro } from './pages/Cadastro'
import { InicioCliente, InicioEntregador, InicioLoja } from './pages/Inicio'
import { Login } from './pages/Login'

function Raiz() {
  const { usuario } = useSessao()
  return <Navigate to={usuario ? inicioDoPerfil[usuario.perfil] : '/login'} replace />
}

export default function App() {
  return (
    <>
      <Menu />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/cliente" element={<RotaProtegida perfis={['cliente']}><InicioCliente /></RotaProtegida>} />
        <Route path="/loja" element={<RotaProtegida perfis={['loja']}><InicioLoja /></RotaProtegida>} />
        <Route path="/entregas" element={<RotaProtegida perfis={['entregador']}><InicioEntregador /></RotaProtegida>} />
        <Route path="*" element={<Raiz />} />
      </Routes>
    </>
  )
}
