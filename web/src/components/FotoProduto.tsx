// F-004: ilustração do produto. Suporta caminho local ("/img/...") e URL completa (http/https).
// Qualquer outra coisa (emoji) vira texto.
export function FotoProduto({ foto, nome, tamanho = 'grande' }: { foto: string; nome: string; tamanho?: 'grande' | 'media' | 'pequena' }) {
  const classe = `foto foto-${tamanho}`
  const ehUrlCompleta = /^https?:\/\//i.test(foto)
  if (foto && (foto.startsWith('/') || ehUrlCompleta)) {
    return <img className={classe} src={foto} alt={nome} loading="lazy" />
  }
  return (
    <span className={classe} role="img" aria-label={nome}>
      {foto || '🍔'}
    </span>
  )
}