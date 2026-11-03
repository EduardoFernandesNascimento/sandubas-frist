⬇⛶A−A+
Universidade de Vassouras
Trabalho P2 · Delivery (3,0): app do zero, em sala
Laboratório de Programação Front End · Engenharia de Software · 2026.2

03/11/2026
Em dupla · 3,0
Entrega 22:10 no AVA
Laís Cristine Bordallo Pinheiro
Antes de começar
Regras e entrega
Entrega só pelo AVA, até 22:10. Tarefa “Trabalho P2 · Delivery (3,0)”.

Um ZIP por dupla (nome1-nome2.zip), sem node_modules; os dois enviam o mesmo arquivo
No README.md: nome completo dos dois, como rodar e o link do GitHub
Pode consultar as aulas, a documentação do DummyJSON e suas anotações.

Backend próprio é opcional: quem quiser pode usar o seu em vez do DummyJSON (o front lê VITE_API_URL, a rubrica é a mesma e a pasta do backend vai no ZIP, sem node_modules).

A nota depende do que funciona. Bonito e quebrado, ou código pela metade, perde pontos.

A missão
O cenário
Um app de delivery (pense no iFood, mas sem usar marca nem logo de app real) contratou a sua dupla para fazer o painel do restaurante parceiro. É a tela que o dono do restaurante usa para cuidar do cardápio: entra com login, vê os pratos, cadastra prato novo, edita e tira prato do cardápio. Ele usa muito pelo celular, no meio da cozinha.

A dupla escolhe o nome do restaurante e as cores.

Base da API: use a variável de ambiente do Vite — não cole URL fixa no código.

A API é pública e não pede chave: o DummyJSON (dummyjson.com). Crie o arquivo .env na raiz do projeto. O serviço de API (fetch ou Axios, você escolhe) vocês escrevem.

# .env (na raiz do projeto front)
VITE_API_URL=https://dummyjson.com
No código: import.meta.env.VITE_API_URL. Reinicie npm run dev depois de criar/editar o .env.

Atenção: a API só simula. Criar, editar e excluir respondem “deu certo”, mas não gravam no servidor. Por isso o app deve atualizar o estado local depois de salvar. Se recarregar a página, a lista volta ao que a API tem: isso é esperado.

Prato criado pela dupla recebe sempre o id 51 e não existe de verdade no servidor: editar ou excluir esse prato responde erro 404, e o app deve mostrar uma mensagem clara.

Conta de teste: usuário emilys · senha emilyspass. O login devolve accessToken; as rotas protegidas usam o header Authorization: Bearer <accessToken>.

API
Endpoints do trabalho
Método	Rota	Auth	Para quê
POST	/auth/login	não	Login · retorna accessToken
GET	/auth/me	Bearer	Conferir usuário logado
GET	/recipes	—	Listar pratos (resposta em recipes) · limit, skip e select
GET	/recipes/search?q=	—	Busca por nome
GET	/recipes/:id	—	Detalhe
POST	/recipes/add	—	Criar (simulado) · nome, cozinha e tempos
PATCH	/recipes/:id	—	Editar (simulado)
DELETE	/recipes/:id	—	Excluir (simulado)
O recurso Recipes do DummyJSON é usado como “pratos”. Campos usados: name, cuisine, image, prepTimeMinutes e cookTimeMinutes. A API não tem preço: use a regra do trabalho, preço = 15 + 0,50 × (preparo + cozimento), formatada em reais. Não use /todos, /users nem /posts.

O que entregar
O que fazer
Criar um app novo, do zero (não copie a pasta do FlyNow nem do portfólio), em React + TypeScript + Vite.

Login (POST /auth/login) com usuário e senha, guardando o token
Cardápio protegido: só aparece depois do login, e tem botão Sair
Lista de pratos com foto, nome, cozinha e preço, e busca
Novo prato, editar e excluir (com confirmação)
Telas montadas com componentes reutilizáveis (pelo menos 3, com props) e useState
Estados de carregando, erro (mensagem na tela, status lido) e lista vazia
Atualizar a lista depois de salvar (estado local: a API só simula)
Tela usável no celular (375 px, sem rolagem lateral)
Git: repositório no GitHub com commits dos dois da dupla e o link no README
Entregar o ZIP no AVA
Conferência
Teste antes de entregar
Façam esta lista no computador da dupla:

Rodei
npm run dev
e a página abriu
Cliquei em tudo que o trabalho pede e funcionou
Não tem botão ou link que não faz nada
Ficou usável no celular (tela estreita)
O console do navegador não mostrou erro vermelho
Rodei
npm run build
sem erro
O ZIP está sem
node_modules
e o README tem os nomes da dupla
Avaliação
Nota (3,0)
O que é avaliado	Pontos
Projeto organizado: Vite + TypeScript, .env, pasta services/ com fetch ou Axios, módulos import/export, npm run build sem erro, README com a dupla	0,3
Git e GitHub: repositório com commits dos dois da dupla ao longo do trabalho e link no README	0,2
Componentes reutilizáveis: pelo menos 3, com props (ex.: card do prato, formulário, cabeçalho) e estado com useState	0,3
Login com token, Context, rota protegida (Router) e Sair	0,5
Cardápio: useEffect para carregar, lista com map e key, busca com filter, carregando / vazio	0,5
Criar, editar e excluir (com confirmação); a lista atualiza depois de salvar	0,6
Tratamento de erro correto: try/catch/finally, status lido e mensagem na tela	0,3
Funciona no celular (375 px, sem rolagem lateral)	0,3
Total	3,0
Esta nota compõe a P2: trabalho (3,0) + prova prática do CRM (7,0, em 17/11) + até 1,0 extra dos Desafios 1 e 2.

Laís Cristine Bordallo Pinheiro
Docente
Universidade de Vassouras (FUSVE)
Laboratório de Programação Front End · Engenharia de Software · 2026.2 · Campus Saquarema
Material didático elaborado para fins de ensino nesta disciplina. Disponibilizado no AVA da turma.