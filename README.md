# BotBaileys Painel

Painel administrativo web para operação de múltiplos bots WhatsApp com Supabase, incluindo:

- login administrativo por magic link (sem senha)
- gerenciamento completo de bots: cadastro, remoção, pausa/reativação e visualização de consumidores por bot
- pareamento por QR Code em tempo real via WebSocket seguro
- isolamento por `bot_id` em todas as telas (usuários, comandos, grupos)
- dashboard com KPIs e gráficos multi-bot em tempo real

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

- Login por magic link com Supabase Auth (sem senha, link expira em 1h)
- Bloqueio das páginas internas quando não há sessão ativa
- Logout pelo próprio painel com limpeza de estado

### Pareamento

- Conexão WebSocket com reconexão automática (até 5 tentativas, intervalo de 2,5s)
- Token enviado como primeira mensagem após abertura do socket — nunca exposto na URL
- `bot_id` incluído na mensagem de autenticação para isolamento por instância
- Detecção automática de mixed-content (HTTPS + `ws://`) com aviso e bloqueio
- Recebimento e exibição do QR Code em base64 em tempo real
- Feedback visual de cada estado: idle, conectando, aguardando QR, pareado, erro, reconectando

### Gerenciamento de bots

- Listagem com status atual (reportado pelo BotManager) e coluna de ativo/pausado
- Cadastro de novo bot com ID personalizado
- Remoção de bot com confirmação
- **Pausar / Reativar bot:** altera `is_active` na tabela `bots`; o BotManager usa esse campo para subir ou encerrar o socket sem remover o registro
- **Visualizar consumidores:** drawer lateral com a lista de usuários (`users`) vinculados ao bot, incluindo chips de Admin/Banido, LID, `phone_jid` e contagem de comandos
- Ação direta para abrir pareamento de um bot específico
- Atualização em tempo real via Supabase Realtime

### Operação diária com isolamento por bot

Todas as telas abaixo possuem filtro por `bot_id` para visualização isolada por instância:

- **Dashboard** — KPIs (bots online, usuários, comandos hoje) + 7 gráficos Recharts (status dos bots, usuários por bot, comandos por bot, top comandos, atividade diária, status dos usuários, top usuários)
- **Usuários** — tabela de consumidores com filtro por bot e busca por LID, nome ou telefone
- **Comandos** — log de `user_commands` com filtro por bot e busca por comando ou usuário
- **Grupos Permitidos** — CRUD de `user_allowed_groups` com filtro por bot

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

### Tabelas consumidas

| Tabela | Uso |
|---|---|
| `bots` | Listagem, cadastro, remoção, toggle `is_active`, pareamento |
| `users` | Consumidores por bot; exibidos no drawer de BotsPage e na UsersPage |
| `user_commands` | Log de comandos exibido em CommandsPage |
| `user_allowed_groups` | Grupos permitidos por usuário/bot em GroupsPage |

Modelagem completa e contexto multi-bot: [modelagemBancoBotWhatsapp.md](modelagemBancoBotWhatsapp.md)

## Troubleshooting Rápido

### Não consigo logar

- Verifique se o provider Email está habilitado no Supabase.
- Confira se a URL atual está em Redirect URLs.
- Veja se o email usado está autorizado pela regra interna do projeto.

### Painel abre, mas bots não atualizam em tempo real

- Verifique se Realtime está habilitado para a tabela `bots` no Supabase.
- Confirme que eventos de update/insert/delete estão sendo disparados no banco.

### Erro no pareamento via WebSocket

- Confirme valor correto de `VITE_PAIR_WS_URL`.
- Se o frontend está em HTTPS, o endpoint deve usar `wss://` (mixed-content bloqueado pelo navegador).
- Verifique se o token bate com o `PAIR_TOKEN` configurado no núcleo do bot.

### Bot aparece como "Ativo" mas não responde mensagens

- Verifique se `is_active = true` na tabela `bots`.
- Confirme que o BotManager do núcleo está rodando e leu o estado mais recente do banco.

### Filtro por bot não mostra registros

- Confirme que os registros em `users`, `user_commands` e `user_allowed_groups` têm o campo `bot_id` preenchido.
- O valor no filtro deve coincidir exatamente com o `id` da tabela `bots`.

## Detalhamentos Técnicos

Documentação técnica separada por tecnologia e importância no projeto:

- [React](docs/react.md)
- [TypeScript](docs/typescript.md)
- [Vite](docs/vite.md)
- [Material UI](docs/material-ui.md)
- [Supabase](docs/supabase.md)
- [WebSocket de pareamento](docs/websocket-pairing.md)
