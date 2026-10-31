import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { CarrinhoProvider } from './contexts/CarrinhoContext'
import { SessaoProvider } from './contexts/SessaoContext'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessaoProvider>
        <CarrinhoProvider>
          <App />
        </CarrinhoProvider>
      </SessaoProvider>
    </BrowserRouter>
  </StrictMode>,
)
