import { useEffect, useState, type FormEvent } from 'react'
import type { Adicional, Produto, ProdutoAtivoEntrada, ProdutoEntrada } from '../../../shared/tipos'
import { api, mensagemDeErro } from '../services/api'
import { ehUrl, moeda } from '../services/formatar'

interface Form {
  nome: string
  categoria: string
  descricao: string
  foto: string
  preco: string
  ingredientes: string // separados por vírgula
  adicionais: string // "Bacon: 4,50; Ovo: 2"
}

const vazio: Form = { nome: '', categoria: '', descricao: '', foto: '🍔', preco: '', ingredientes: '', adicionais: '' }

function numero(texto: string): number {
  return Number(texto.replace(',', '.'))
}

function lerAdicionais(texto: string): Adicional[] {
  return texto
    .split(';')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const [nome, preco = '0'] = t.split(':')
      return { nome: nome.trim(), preco: numero(preco.trim()) }
    })
}

function paraForm(p: Produto): Form {
  return {
    nome: p.nome,
    categoria: p.categoria,
    descricao: p.descricao,
    foto: p.foto,
    preco: String(p.preco).replace('.', ','),
    ingredientes: p.ingredientes.join(', '),
    adicionais: p.adicionais.map((a) => `${a.nome}: ${String(a.preco).replace('.', ',')}`).join('; '),
  }
}

// Cardápio da loja: REQ-021 (criar e editar) e REQ-022 (pausar sem excluir).
export function CardapioLoja() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState<Form | null>(null)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    api
      .get<Produto[]>('/produtos', { params: { todos: 1 } })
      .then((r) => setProdutos(r.data))
      .catch((e) => setErro(mensagemDeErro(e, 'Não foi possível carregar o cardápio')))
      .finally(() => setCarregando(false))
  }, [])

  function abrir(p: Produto | null) {
    setEditando(p)
    setForm(p ? paraForm(p) : { ...vazio })
    setErro('')
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault()
    if (!form) return
    const corpo: ProdutoEntrada = {
      nome: form.nome.trim(),
      categoria: form.categoria.trim(),
      preco: numero(form.preco),
      descricao: form.descricao.trim(),
      foto: form.foto.trim(),
      ingredientes: form.ingredientes.split(',').map((t) => t.trim()).filter(Boolean),
      adicionais: lerAdicionais(form.adicionais),
    }
    if (editando) corpo.ativo = editando.ativo
    setOcupado(true)
    try {
      if (editando) {
        const { data } = await api.put<Produto>(`/produtos/${editando.id}`, corpo)
        setProdutos((atual) => atual.map((p) => (p.id === data.id ? data : p)))
      } else {
        const { data } = await api.post<Produto>('/produtos', corpo)
        setProdutos((atual) => [...atual, data])
      }
      setForm(null)
      setEditando(null)
      setErro('')
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível salvar o produto'))
    } finally {
      setOcupado(false)
    }
  }

  async function alternar(p: Produto) {
    try {
      const corpo: ProdutoAtivoEntrada = { ativo: !p.ativo }
      const { data } = await api.patch<Produto>(`/produtos/${p.id}`, corpo)
      setProdutos((atual) => atual.map((x) => (x.id === data.id ? data : x)))
      setErro('')
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível pausar ou ativar o produto'))
    }
  }

  const campo = (chave: keyof Form) => ({
    value: form ? form[chave] : '',
    onChange: (ev: { target: { value: string } }) => setForm((f) => (f ? { ...f, [chave]: ev.target.value } : f)),
  })

  return (
    <main className="pagina larga">
      <h1>Cardápio da loja</h1>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {!form && (
        <div className="acoes">
          <button type="button" onClick={() => abrir(null)}>
            Novo produto
          </button>
        </div>
      )}
      {form && (
        <form className="sub-form" onSubmit={salvar}>
          <h2>{editando ? `Editar ${editando.nome}` : 'Novo produto'}</h2>
          <label>
            Nome
            <input {...campo('nome')} required />
          </label>
          <label>
            Categoria
            <input {...campo('categoria')} required placeholder="Lanches, Bebidas…" />
          </label>
          <label>
            Descrição
            <textarea {...campo('descricao')} rows={2} />
          </label>
          <label>
            Foto (emoji)
            <input {...campo('foto')} />
          </label>
          <label>
            Preço (R$)
            <input {...campo('preco')} required inputMode="decimal" placeholder="25,90" />
          </label>
          <label>
            Ingredientes (separados por vírgula)
            <input {...campo('ingredientes')} placeholder="Pão, carne, queijo" />
          </label>
          <label>
            Adicionais (nome: preço; separados por ponto e vírgula)
            <input {...campo('adicionais')} placeholder="Bacon: 4,50; Ovo: 2" />
          </label>
          <div className="acoes">
            <button type="button" className="secundario" onClick={() => setForm(null)}>
              Cancelar
            </button>
            <button type="submit" disabled={ocupado}>
              Salvar
            </button>
          </div>
        </form>
      )}
      {carregando && <p>Carregando…</p>}
      {!carregando && produtos.length === 0 && !erro && <p>Nenhum produto cadastrado.</p>}
      <ul className="lista">
        {produtos.map((p) => (
          <li key={p.id} className={`item-carrinho${p.ativo ? '' : ' pausado'}`}>
            {ehUrl(p.foto) ? (
              <img src={p.foto} alt="" width={40} height={40} />
            ) : (
              <span aria-hidden="true" className="emoji">
                {p.foto}
              </span>
            )}
            <div className="item-texto">
              <strong>{p.nome}</strong> · {moeda(p.preco)}
              <p className="detalhe">
                {p.categoria}
                {p.ativo ? '' : ' · pausado'}
                {p.adicionais.length > 0 && ` · adicionais: ${p.adicionais.map((a) => a.nome).join(', ')}`}
              </p>
            </div>
            <button type="button" className="secundario" onClick={() => abrir(p)}>
              Editar
            </button>
            <button type="button" onClick={() => alternar(p)}>
              {p.ativo ? 'Pausar' : 'Ativar'}
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
