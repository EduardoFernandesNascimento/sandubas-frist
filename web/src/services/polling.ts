import { useEffect, useRef } from 'react'

// Chama `buscar` agora e a cada `ms` milissegundos enquanto o componente estiver montado.
export function usePolling(buscar: () => Promise<void> | void, ms = 5000) {
  const ref = useRef(buscar)
  ref.current = buscar
  useEffect(() => {
    ref.current()
    const id = window.setInterval(() => ref.current(), ms)
    return () => window.clearInterval(id)
  }, [ms])
}
