import axios from 'axios'

// Chaves do localStorage usadas pela sessão.
export const CHAVE_TOKEN = 'token'
export const CHAVE_USUARIO = 'usuario'
export const CHAVE_AVISO = 'aviso'

export const api = axios.create({ baseURL: 'http://localhost:3000' })

// RJ02 (REQ-055): envia o token em toda requisição.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(CHAVE_TOKEN)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// RJ06 (REQ-059): 401 limpa a sessão e volta ao login com aviso.
// 403 só rejeita, com mensagem própria.
api.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    const status = axios.isAxiosError(erro) ? erro.response?.status : undefined
    const ehLogin = axios.isAxiosError(erro) && erro.config?.url?.startsWith('/auth/')
    if (status === 401 && !ehLogin) {
      localStorage.removeItem(CHAVE_TOKEN)
      localStorage.removeItem(CHAVE_USUARIO)
      sessionStorage.setItem(CHAVE_AVISO, 'Sessão expirada, entre novamente')
      window.location.assign('/login')
    }
    if (status === 403) {
      return Promise.reject(new Error('Sem permissão para esta ação'))
    }
    return Promise.reject(erro)
  },
)

// Lê a mensagem de erro da API ({ mensagem }) ou usa um texto padrão.
export function mensagemDeErro(erro: unknown, padrao: string): string {
  if (axios.isAxiosError(erro)) {
    const dados = erro.response?.data as { mensagem?: string } | undefined
    if (dados?.mensagem) return dados.mensagem
    if (!erro.response) return 'Não foi possível falar com a API (ela está rodando?)'
  }
  if (erro instanceof Error && erro.message) return erro.message
  return padrao
}
