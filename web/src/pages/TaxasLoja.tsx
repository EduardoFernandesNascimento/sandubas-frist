import { useEffect, useState, type FormEvent } from 'react'
import type { Bairro, BairroEntrada } from '../../../shared/tipos'
import { api, mensagemDeErro } from '../services/api'
import { moeda } from '../services/formatar'
import { Trilha } from '../components/Trilha'

function numero(texto: string): number {
  return Number(texto.replace(',', '.'))
}

// Taxas por bairro: REQ-024 (RF25).
export function TaxasLoja() {
  const [bairros, setBairros] = useState<Bairro[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [nome, setNome] = useState('')
  const [taxa, setTaxa] = useState('')
  const [editando, setEditando] = useState<number | null>(null)
  const [taxaEdicao, setTaxaEdicao] = useState('')

  useEffect(() => {
    api
      .get<Bairro[]>('/bairros')
      .then((r) => setBairros(r.data))
      .catch((e) => setErro(mensagemDeErro(e, 'Não foi possível carregar os bairros')))
      .finally(() => setCarregando(false))
  }, [])

  async function criar(ev: FormEvent) {
    ev.preventDefault()
    try {
      const corpo: BairroEntrada = { nome: nome.trim(), taxa: numero(taxa) }
      const { data } = await api.post<Bairro>('/bairros', corpo)
      setBairros((atual) => [...atual, data])
      setNome('')
      setTaxa('')
      setErro('')
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível criar o bairro'))
    }
  }

  async function salvar(b: Bairro) {
    try {
      const corpo: BairroEntrada = { nome: b.nome, taxa: numero(taxaEdicao) }
      const { data } = await api.put<Bairro>(`/bairros/${b.id}`, corpo)
      setBairros((atual) => atual.map((x) => (x.id === data.id ? data : x)))
      setEditando(null)
      setErro('')
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível salvar a taxa'))
    }
  }

  return (
    <main className="pagina">
      <Trilha para="/loja" rotulo="o painel de pedidos" atual="Taxas por bairro" />
      <h1>Taxas por bairro</h1>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {carregando && (
        <>
          <p>Carregando…</p>
          <div className="skeleton skeleton-bloco" aria-hidden="true" />
        </>
      )}
      {!carregando && bairros.length === 0 && !erro && (
        <div className="vazio" role="status">
          <span className="icone-vazio" aria-hidden="true">
            📍
          </span>
          <p>Nenhum bairro cadastrado.</p>
        </div>
      )}
      <ul className="lista">
        {bairros.map((b) => (
          <li key={b.id} className="item-carrinho">
            <div className="item-texto">
              <strong>{b.nome}</strong> · {moeda(b.taxa)}
            </div>
            {editando === b.id ? (
              <>
                <label>
                  Nova taxa (R$)
                  <input value={taxaEdicao} onChange={(ev) => setTaxaEdicao(ev.target.value)} inputMode="decimal" />
                </label>
                <button type="button" onClick={() => salvar(b)}>
                  Salvar
                </button>
                <button type="button" className="secundario" onClick={() => setEditando(null)}>
                  Cancelar
                </button>
              </>
            ) : (
              <button
                type="button"
                className="secundario"
                onClick={() => {
                  setEditando(b.id)
                  setTaxaEdicao(String(b.taxa).replace('.', ','))
                }}
              >
                Editar taxa
              </button>
            )}
          </li>
        ))}
      </ul>
      <form className="sub-form" onSubmit={criar}>
        <h2>Novo bairro</h2>
        <label>
          Nome do bairro
          <input value={nome} onChange={(ev) => setNome(ev.target.value)} required />
        </label>
        <label>
          Taxa de entrega (R$)
          <input value={taxa} onChange={(ev) => setTaxa(ev.target.value)} required inputMode="decimal" placeholder="5,00" />
        </label>
        <button type="submit">Adicionar bairro</button>
      </form>
    </main>
  )
}
