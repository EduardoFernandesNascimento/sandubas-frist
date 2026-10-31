import type { HistoricoStatus } from '../../../shared/tipos'
import { rotuloStatus } from '../services/formatar'

// REQ-044 (RN12): cada mudança de status com data e hora.
export function Historico({ historico }: { historico?: HistoricoStatus[] }) {
  if (!historico || historico.length === 0) return null
  return (
    <details className="historico">
      <summary>Histórico de status</summary>
      <ol>
        {historico.map((h, n) => (
          <li key={n}>
            <time dateTime={h.em}>{new Date(h.em).toLocaleString('pt-BR')}</time> · {rotuloStatus[h.status]}
          </li>
        ))}
      </ol>
    </details>
  )
}
