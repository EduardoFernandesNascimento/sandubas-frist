import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Adicional, Loja, Produto } from '../../../shared/tipos'
import { precoUnitario, useCarrinho } from '../contexts/CarrinhoContext'
import { api, mensagemDeErro } from '../services/api'
import { moeda } from '../services/formatar'
import { FotoProduto } from '../components/FotoProduto'
import { Logo } from '../components/Logo'

// REQ-003: categorias do cardápio, nesta ordem.
const CATEGORIAS: { chave: string; titulo: string }[] = [
  { chave: 'lanches', titulo: 'Lanches' },
  { chave: 'porções', titulo: 'Porções' },
  { chave: 'bebidas', titulo: 'Bebidas' },
  { chave: 'combos', titulo: 'Combos' },
  { chave: 'sobremesas', titulo: 'Sobremesas' },
]

export function Cardapio() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loja, setLoja] = useState<Loja | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [escolhido, setEscolhido] = useState<Produto | null>(null)
  const [aviso, setAviso] = useState('')
  const [busca, setBusca] = useState('')
  const { quantidadeTotal } = useCarrinho()

  useEffect(() => {
    Promise.all([api.get<Produto[]>('/produtos'), api.get<Loja>('/loja')])
      .then(([p, l]) => {
        setProdutos(p.data.filter((x) => x.ativo !== false)) // REQ-040
        setLoja(l.data)
      })
      .catch((e) => setErro(mensagemDeErro(e, 'Não foi possível carregar o cardápio')))
      .finally(() => setCarregando(false))
  }, [])

  const fechada = loja ? !loja.aberta : false // REQ-033

  // Categorias conhecidas primeiro; qualquer outra aparece no fim.
  const extras = [...new Set(produtos.map((p) => p.categoria))].filter(
    (c) => !CATEGORIAS.some((k) => k.chave === c),
  )
  const grupos = [...CATEGORIAS, ...extras.map((c) => ({ chave: c, titulo: c }))]
    .map((g) => ({ ...g, itens: produtos.filter((p) => p.categoria === g.chave) }))
    .filter((g) => g.itens.length > 0)

  // Busca por nome, descrição ou categoria (rubrica: busca com filter).
  const termo = busca.trim().toLowerCase()
  const visiveis = produtos.filter(
    (p) =>
      !termo ||
      p.nome.toLowerCase().includes(termo) ||
      p.descricao.toLowerCase().includes(termo) ||
      p.categoria.toLowerCase().includes(termo),
  )
  const gruposVisiveis = grupos
    .map((g) => ({ ...g, itens: g.itens.filter((p) => visiveis.includes(p)) }))
    .filter((g) => g.itens.length > 0)

  return (
    <main className="pagina larga">
      <div className="cabeca-pagina">
        <Logo />
        <h1>Cardápio</h1>
      </div>
      {fechada && (
        <p className="aviso fechado" role="alert">
          <strong>Fechado.</strong> A loja não está aceitando pedidos agora.
        </p>
      )}
      {aviso && (
        <p className="aviso ok" role="status">
          {aviso} <Link to="/cliente/carrinho">Ver carrinho ({quantidadeTotal})</Link>
        </p>
      )}
      <label className="busca">
        Buscar
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Por nome, descrição ou categoria…"
        />
      </label>
      {carregando && <p>Carregando…</p>}
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {!carregando && !erro && grupos.length === 0 && <p>Nenhum produto disponível.</p>}
      {!carregando && !erro && grupos.length > 0 && gruposVisiveis.length === 0 && (
        <p>Nenhum produto encontrado.</p>
      )}

      {gruposVisiveis.map((g, n) => (
        <section key={g.chave} aria-labelledby={`cat-${n}`}>
          <h2 id={`cat-${n}`} className="categoria">
            {g.titulo}
          </h2>
          <ul className="grade">
            {g.itens.map((p) => (
              <li key={p.id} className="produto">
                <FotoProduto foto={p.foto} nome={p.nome} />
                <div className="produto-info">
                  <h3>{p.nome}</h3>
                  <p className="descricao">{p.descricao}</p>
                  <p className="preco">{moeda(p.preco)}</p>
                </div>
                <button
                  type="button"
                  disabled={fechada}
                  onClick={() => {
                    setAviso('')
                    setEscolhido(p)
                  }}
                >
                  {fechada ? 'Fechado' : 'Escolher'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {escolhido && !fechada && (
        <Personalizar
          produto={escolhido}
          aoFechar={() => setEscolhido(null)}
          aoAdicionar={(nome) => {
            setEscolhido(null)
            setAviso(`${nome} adicionado ao carrinho.`)
          }}
        />
      )}
    </main>
  )
}

// REQ-005: adicionais pagos, ingredientes a remover e observação.
function Personalizar({
  produto,
  aoFechar,
  aoAdicionar,
}: {
  produto: Produto
  aoFechar: () => void
  aoAdicionar: (nome: string) => void
}) {
  const { adicionar } = useCarrinho()
  const [adicionais, setAdicionais] = useState<Adicional[]>([])
  const [removidos, setRemovidos] = useState<string[]>([])
  const [observacao, setObservacao] = useState('')
  const [quantidade, setQuantidade] = useState(1)

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') aoFechar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aoFechar])

  function alternarAdicional(a: Adicional) {
    setAdicionais((atual) =>
      atual.some((x) => x.nome === a.nome) ? atual.filter((x) => x.nome !== a.nome) : [...atual, a],
    )
  }

  function alternarIngrediente(nome: string) {
    setRemovidos((atual) => (atual.includes(nome) ? atual.filter((x) => x !== nome) : [...atual, nome]))
  }

  const listaAdicionais = produto.adicionais ?? []
  const listaIngredientes = produto.ingredientes ?? []
  const unitario = precoUnitario({ produto, adicionais })

  function confirmar(e: FormEvent) {
    e.preventDefault()
    adicionar({ produto, quantidade, adicionais, removidos, observacao: observacao.trim() })
    aoAdicionar(produto.nome)
  }

  return (
    <div className="fundo-modal" onClick={aoFechar}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-personalizar"
        onClick={(e) => e.stopPropagation()}
      >
        <FotoProduto foto={produto.foto} nome={produto.nome} tamanho="media" />
        <h2 id="titulo-personalizar">{produto.nome}</h2>
        <p className="descricao">{produto.descricao}</p>
        <form onSubmit={confirmar}>
          {listaAdicionais.length > 0 && (
            <fieldset>
              <legend>Adicionais</legend>
              {listaAdicionais.map((a) => (
                <label key={a.nome} className="opcao">
                  <input
                    type="checkbox"
                    checked={adicionais.some((x) => x.nome === a.nome)}
                    onChange={() => alternarAdicional(a)}
                  />
                  {a.nome} (+ {moeda(a.preco)})
                </label>
              ))}
            </fieldset>
          )}
          {listaIngredientes.length > 0 && (
            <fieldset>
              <legend>Ingredientes (desmarque para remover)</legend>
              {listaIngredientes.map((i) => (
                <label key={i} className="opcao">
                  <input type="checkbox" checked={!removidos.includes(i)} onChange={() => alternarIngrediente(i)} />
                  {i}
                </label>
              ))}
            </fieldset>
          )}
          <label>
            Observação
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="Ex.: ponto da carne, sem sal…"
            />
          </label>
          <label>
            Quantidade
            <input
              type="number"
              min={1}
              max={99}
              value={quantidade}
              onChange={(e) => setQuantidade(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
            />
          </label>
          <p className="preco">
            Preço do item: {moeda(unitario)}
            {quantidade > 1 && <> · Total: {moeda(unitario * quantidade)}</>}
          </p>
          <div className="acoes">
            <button type="button" className="secundario" onClick={aoFechar}>
              Cancelar
            </button>
            <button type="submit" autoFocus>
              Adicionar ao carrinho
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
