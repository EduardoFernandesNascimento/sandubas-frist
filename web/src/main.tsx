import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import App from './App'
import { CarrinhoProvider } from './contexts/CarrinhoContext'
import { SessaoProvider } from './contexts/SessaoContext'
import { setNavigate } from './services/api'
import './index.css'

// Componente interno ao BrowserRouter: registra a navegação SPA para o interceptor da api.
function RegistraNavegacao() {
  const navigate = useNavigate()
  useEffect(() => {
    setNavigate(navigate)
  }, [navigate])
  return null
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <RegistraNavegacao />
      <SessaoProvider>
        <CarrinhoProvider>
          <App />
        </CarrinhoProvider>
      </SessaoProvider>
    </BrowserRouter>
  </StrictMode>,
)