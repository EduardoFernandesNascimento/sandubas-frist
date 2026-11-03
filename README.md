# First Sanduba's

Sistema de delivery de uma lanchonete, feito como **trabalho acadêmico**. Roda só na sua máquina e usa apenas **dados fictícios** (usuários, endereços, pedidos e pagamento simulado).

## Dupla

| Nome | GitHub |
|------|--------|
| Eduardo Fernandes Nascimento | [@EduardoFernandesNascimento](https://github.com/EduardoFernandesNascimento) |
| Carlos Wagner | [@cwcasado](https://github.com/cwcasado) |

- API: TypeScript + Express, dados em `api/db.json`, login com JWT.
- Front: React + Vite (TypeScript).

- API: TypeScript + Express, dados em `api/db.json`, login com JWT.
- Front: React + Vite (TypeScript).

## Pré-requisitos

- Node.js **18 ou mais novo** (já vem com o `npm`).

## Instalação e execução

Abra **dois terminais** e deixe os dois rodando ao mesmo tempo.

Terminal 1, a API (porta 3000):

```bash
cd api
npm install
npm start
```

Terminal 2, o site (http://localhost:5173):

```bash
cd web
npm install
npm run dev
```

Depois abra http://localhost:5173 no navegador.

Se aparecer **"Não foi possível falar com a API (ela está rodando?)"**, é porque só o `web` está rodando: suba a API no outro terminal.

## Usuários de teste

Senha de todos: `123456`

| Perfil | E-mail |
| :--- | :--- |
| Cliente | `cliente@demo.com` |
| Loja | `loja@demo.com` |
| Entregador | `entregador@demo.com` |
| Entregador (segundo) | `entregador2@demo.com` |

## Roteiro de demonstração

1. Tentar abrir a área do cliente sem login (http://localhost:5173/cliente) → o React redireciona para o login. *(conferência manual)*
2. Logar como cliente → o token JWT é salvo no `localStorage` (inspecionável em F12 → Application) e enviado no header `Authorization: Bearer <token>` em toda requisição.
3. Montar e confirmar um pedido → a requisição leva o cabeçalho `Authorization: Bearer <token>`.
4. Com o token de cliente, chamar `GET /pedidos` → a API responde 403.
5. Logar como loja → aceitar o pedido e mudar os status.
6. Logar como entregador → confirmar a entrega; o cliente vê "Entregue".
7. Esperar o token expirar → a próxima ação retorna 401 e volta ao login.

Os passos 2 a 7 também são conferidos automaticamente pelo teste `api/roteiro.test.ts`.

## Expiração do token

O token vale **5 minutos** por padrão. Para mudar, defina `JWT_EXPIRA_EM` antes de subir a API (aceita `30s`, `1m`, `2h`...):

```bash
cd api
JWT_EXPIRA_EM=1m npm start
```

No PowerShell: `$env:JWT_EXPIRA_EM="1m"; npm start`. Um valor curto ajuda a mostrar o passo 7 do roteiro.

## Segurança

- Senhas guardadas com hash (bcrypt) e rotas protegidas por JWT e perfil.
- O token fica no `localStorage` do navegador. Isso foi **aceito para a demonstração**, porque é simples de mostrar e de inspecionar.
- Em produção, guardar o token num **cookie `httpOnly`** reduz o risco de roubo do token por XSS, já que o JavaScript da página não consegue ler esse cookie.

## Testes

```bash
cd api
npm test          # testes da API (vitest + supertest), incluindo o roteiro
npm run tipos     # checagem de tipos (tsc)
npm run smoke     # sobe a API, chama GET /produtos e encerra
```

Os testes usam uma cópia temporária do `db.json`; o arquivo original não é alterado.

No front: `cd web` e `npm run build` (confere os tipos e gera o build).

## Documentação

- [Requisitos do trabalho](docs/requisitos/requisitos-sanduba-frist.pdf)
- [Diagramas](docs/diagramas/sanduba-frist-diagramas.drawio): os 7 diagramas; abra em [app.diagrams.net](https://app.diagrams.net)
- [Logo original](docs/marca/logo-sanduba-frist.png): de onde vem a paleta de cores
- [Contrato da API](docs/api/openapi.v1.yaml) (OpenAPI)
- [Evidências](docs/evidencias/): testes e build de cada feature

## Estrutura de pastas

```
api/             API Express (server.ts), dados (db.json) e testes
web/             front React + Vite (src/pages, src/components, src/services; logo e favicon em public/)
shared/          tipos TypeScript usados pela API e pelo front
docs/            contrato da API (docs/api/openapi.v1.yaml) e evidências dos testes
docs/requisitos/ requisitos do trabalho (PDF)
docs/diagramas/  diagramas (.drawio)
docs/marca/      logo original
```
