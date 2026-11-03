import { Link } from 'react-router-dom'

// Trilha de navegação (orientação — Baymard): link "← Voltar"
// + passo atual, garantindo caminho de retorno nas telas internas.
export function Trilha({ para, rotulo, atual }: { para: string; rotulo: string; atual?: string }) {
  return (
    <nav aria-label="Trilha de navegação" className="trilha">
      <Link to={para} className="voltar">
        ← Voltar para {rotulo}
      </Link>
      {atual && (
        <>
          <span className="separador" aria-hidden="true">
            /
          </span>
          <span>{atual}</span>
        </>
      )}
    </nav>
  )
}