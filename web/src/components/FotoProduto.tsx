// F-004: ilustração do produto. Caminho local ("/img/...") vira <img>; o resto (emoji) vira texto.
export function FotoProduto({ foto, nome, tamanho = 'grande' }: { foto: string; nome: string; tamanho?: 'grande' | 'media' | 'pequena' }) {
  const classe = `foto foto-${tamanho}`
  if (foto && foto.startsWith('/')) return <img className={classe} src={foto} alt={nome} />
  return (
    <span className={classe} role="img" aria-label={nome}>
      {foto || '🍔'}
    </span>
  )
}
