import { useSessao } from '../contexts/SessaoContext'

// Placeholders das páginas iniciais de cada perfil (o conteúdo vem nas próximas features).
function Placeholder({ titulo, texto }: { titulo: string; texto: string }) {
  const { usuario } = useSessao()
  return (
    <main className="pagina">
      <h1>{titulo}</h1>
      <p>Olá, {usuario?.nome}!</p>
      <p>{texto}</p>
    </main>
  )
}

export function InicioLoja() {
  return <Placeholder titulo="Painel da loja" texto="Em breve: pedidos recebidos e cardápio." />
}

export function InicioEntregador() {
  return <Placeholder titulo="Entregas" texto="Em breve: entregas atribuídas a você." />
}
