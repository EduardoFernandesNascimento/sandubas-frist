import { Navigate, Route, Routes } from 'react-router-dom'
import { Menu } from './components/Menu'
import { RotaProtegida } from './components/RotaProtegida'
import { inicioDoPerfil, useSessao } from './contexts/SessaoContext'
import { Cadastro } from './pages/Cadastro'
import { Cardapio } from './pages/Cardapio'
import { Carrinho } from './pages/Carrinho'
import { Checkout } from './pages/Checkout'
import { InicioEntregador, InicioLoja } from './pages/Inicio'
import { Login } from './pages/Login'
import { MeusPedidos } from './pages/MeusPedidos'

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
        <Route path="/cliente" element={<RotaProtegida perfis={['cliente']}><Cardapio /></RotaProtegida>} />
        <Route path="/cliente/carrinho" element={<RotaProtegida perfis={['cliente']}><Carrinho /></RotaProtegida>} />
        <Route path="/cliente/checkout" element={<RotaProtegida perfis={['cliente']}><Checkout /></RotaProtegida>} />
        <Route path="/cliente/pedidos" element={<RotaProtegida perfis={['cliente']}><MeusPedidos /></RotaProtegida>} />
        <Route path="/loja" element={<RotaProtegida perfis={['loja']}><InicioLoja /></RotaProtegida>} />
        <Route path="/entregas" element={<RotaProtegida perfis={['entregador']}><InicioEntregador /></RotaProtegida>} />
        <Route path="*" element={<Raiz />} />
      </Routes>
    </>
  )
}
