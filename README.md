# BotBaileys Painel

Painel administrativo web para operação de múltiplos bots WhatsApp com Supabase, incluindo:

- login administrativo com sessão (magic link)
- gerenciamento de bots
- pareamento por QR Code em tempo real via WebSocket
- visualização de usuários, comandos e grupos permitidos

## Requisitos

- Node.js 20 ou superior
- npm 10 ou superior
- Projeto Supabase configurado
- Núcleo do bot com endpoint WebSocket de pareamento disponível

## Instalação

1. Instalar dependências:

```bash
npm install
```

2. Criar seu arquivo de ambiente a partir do template:

```bash
cp .env.example .env
```

No Windows PowerShell, se preferir:

```powershell
Copy-Item .env.example .env
```

3. Preencher as variáveis do arquivo .env.

4. Executar em desenvolvimento:

```bash
npm run dev
```

## Variáveis de Ambiente

Arquivo de referência: [.env.example](.env.example)

### VITE_SUPABASE_URL

- O que é: URL do projeto Supabase.
- Onde encontrar: Supabase Dashboard > Settings > API > Project URL.
- Exemplo de valor: https://abcxyzcompany.supabase.co

### VITE_SUPABASE_KEY

- O que é: chave pública (anon key) usada pelo frontend para autenticação e consultas permitidas pelo RLS.
- Onde encontrar: Supabase Dashboard > Settings > API > Project API Keys > anon public.
- Importante: não usar service_role no frontend.

### VITE_PAIR_WS_URL

- O que é: URL do endpoint WebSocket do servidor de pareamento do bot.
- Onde definir: endpoint exposto pelo núcleo do bot (rota /pair/ws).
- Exemplo local: ws://localhost:3000/pair/ws
- Exemplo produção: wss://bot-api.seudominio.com/pair/ws
- Importante: em página HTTPS, usar wss para evitar bloqueio de mixed content.

## Configurações Obrigatórias no Supabase

### Authentication (Magic Link)

1. Authentication > Providers > Email: habilitar.
2. Authentication > URL Configuration: cadastrar Redirect URLs do frontend.
3. Definir política interna para quais emails podem acessar o painel admin.

Exemplos de Redirect URLs:

- http://localhost:5173
- https://painel.seudominio.com

### Realtime (Tabela bots)

Para o status dos bots atualizar em tempo real no painel:

1. Database > Replication: habilitar realtime para a tabela bots.
2. Confirmar que a tabela pública bots está na publicação usada pelo Realtime.

Sem isso, a listagem funciona normalmente, porém sem atualização instantânea.

## Como Executar

### Desenvolvimento

```bash
npm run dev
```

### Build de produção

```bash
npm run build
```

### Preview do build

```bash
npm run preview
```

### Build + preview em sequência

```bash
npm run prod
```

## Funcionalidades Implementadas

### Segurança e acesso

- Login por magic link com Supabase Auth
- Bloqueio das páginas internas quando não há sessão
- Logout pelo próprio painel

### Pareamento

- Conexão WebSocket com reconexão automática
- Recebimento de QR Code em tempo real
- Mensagens de sucesso e erro do fluxo
- Envio de token e bot_id na mensagem de autenticação (sem expor na URL)

### Multi-bot

- Tela para listar bots
- Cadastro de novo bot
- Remoção de bot
- Ação direta para abrir pareamento de um bot específico
- Atualização em tempo real da tabela bots

### Operação diária

- Dashboard
- Usuários
- Comandos
- Grupos permitidos

## Estrutura Principal

```text
src/
	components/
		Sidebar.tsx
	lib/
		supabase.ts
	pages/
		BotsPage.tsx
		CommandsPage.tsx
		DashboardPage.tsx
		GroupsPage.tsx
		LoginPage.tsx
		PairingPage.tsx
		UsersPage.tsx
	types/
		database.ts
	App.tsx
	main.tsx
	theme.ts
docs/
	react.md
	typescript.md
	vite.md
	material-ui.md
	supabase.md
	websocket-pairing.md
```

## Árvore de Responsabilidades

```text
raiz/
	src/
		Responsabilidade: codigo fonte da aplicacao frontend

		components/
			Responsabilidade: componentes compartilhados de interface
			Exemplo: Sidebar.tsx controla navegacao lateral

		lib/
			Responsabilidade: integracoes e clientes externos
			Exemplo: supabase.ts inicializa client do Supabase

		pages/
			Responsabilidade: telas de negocio do painel
			Exemplo: BotsPage.tsx, PairingPage.tsx, LoginPage.tsx

		types/
			Responsabilidade: contratos e tipagens de dados
			Exemplo: database.ts define interfaces das tabelas

		App.tsx
			Responsabilidade: layout principal, guarda de autenticacao e roteamento por estado

		main.tsx
			Responsabilidade: bootstrap do React e providers globais

		theme.ts
			Responsabilidade: tema visual central da aplicacao

	docs/
		Responsabilidade: documentacao tecnica complementar por tecnologia
		Exemplo: react.md, supabase.md, websocket-pairing.md

	public/
		Responsabilidade: arquivos estaticos servidos sem processamento

	.env.example
		Responsabilidade: template oficial de configuracao de ambiente

	README.md
		Responsabilidade: guia principal de instalacao, execucao e operacao
```

## Banco de Dados Utilizado pelo Frontend

Tabelas consumidas:

- bots
- users
- user_commands
- user_allowed_groups

Modelagem e contexto geral: [modelagemBancoBotWhatsapp.md](modelagemBancoBotWhatsapp.md)

## Troubleshooting Rápido

### Não consigo logar

- Verifique se o provider Email está habilitado no Supabase.
- Confira se a URL atual está em Redirect URLs.
- Veja se o email usado está autorizado pela regra interna do projeto.

### Painel abre, mas bots não atualizam em tempo real

- Verifique se Realtime está habilitado para a tabela bots.
- Confirme que há eventos de update/insert/delete sendo disparados no banco.

### Erro no pareamento via WebSocket

- Confirme valor correto de VITE_PAIR_WS_URL.
- Se frontend está em HTTPS, garanta endpoint em wss.
- Verifique token e validação no backend do bot.

## Detalhamentos Técnicos

Documentação técnica separada por tecnologia e importância no projeto:

- [React](docs/react.md)
- [TypeScript](docs/typescript.md)
- [Vite](docs/vite.md)
- [Material UI](docs/material-ui.md)
- [Supabase](docs/supabase.md)
- [WebSocket de pareamento](docs/websocket-pairing.md)
