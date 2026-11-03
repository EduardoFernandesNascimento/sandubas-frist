// F-004: logo da marca (web/public/logo.png).
export function Logo({ tamanho = 'destaque' }: { tamanho?: 'destaque' | 'pequena' }) {
  return <img className={`logo logo-${tamanho}`} src="/logo.png" alt="First Sanduba's" />
}
