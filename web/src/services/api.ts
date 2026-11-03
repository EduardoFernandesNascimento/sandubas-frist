import axios from 'axios'

// Chaves do localStorage usadas pela sessão.
export const CHAVE_TOKEN = 'token'
export const CHAVE_USUARIO = 'usuario'
export const CHAVE_AVISO = 'aviso'

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
export const api = axios.create({ baseURL: apiBaseUrl })

// Navegação SPA (definida pelo App ao montar)
let navigateFn: ((path: string, options?: { replace?: boolean }) => void) | null = null;
export function setNavigate(fn: typeof navigateFn) { navigateFn = fn; }

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
      if (navigateFn) {
        navigateFn('/login', { replace: true });
      } else {
        window.location.assign('/login')
      }
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
    if (erro.code === 'ECONNABORTED') return 'Tempo de resposta esgotado'
    if (erro.code === 'ERR_NETWORK') return 'Erro de rede — verifique sua conexão'
  }
  if (erro instanceof Error && erro.message) return erro.message
  return padrao
}
