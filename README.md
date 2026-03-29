# BotBaileys Painel

Painel administrativo web para gerenciar o bot WhatsApp (BotBaileys). Permite visualizar e acompanhar usuários, comandos executados e grupos permitidos, consumindo dados diretamente do Supabase.

## Stack

- **React 19** — Biblioteca de UI
- **TypeScript** — Tipagem estática
- **Vite 8** — Bundler e dev server
- **Material UI v7** — Componentes visuais
- **Supabase** — Banco de dados (PostgreSQL hospedado)

## Estrutura do Projeto

```
src/
├── lib/
│   └── supabase.ts             # Client Supabase (inicialização)
├── types/
│   └── database.ts             # Tipos: User, UserCommand, UserAllowedGroup
├── components/
│   └── Sidebar.tsx             # Menu lateral (abre/fecha)
├── pages/
│   ├── UsersPage.tsx           # Tabela de usuários
│   ├── CommandsPage.tsx        # Log de comandos executados
│   └── GroupsPage.tsx          # Grupos permitidos por usuário
├── App.tsx                     # Layout com sidebar + navegação
├── main.tsx                    # Entry point com ThemeProvider
└── theme.ts                    # Configuração do tema MUI
```

## Instalação

```bash
npm install
```

## Configuração

Crie um arquivo `.env` na raiz do projeto com as credenciais do Supabase:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_KEY=sua_chave_aqui
```

> As variáveis usam o prefixo `VITE_` porque é assim que o Vite expõe variáveis de ambiente para o código frontend.

## Scripts

| Comando           | O que faz                                                        |
|-------------------|------------------------------------------------------------------|
| `npm run dev`     | Servidor de desenvolvimento com hot reload (porta 5173)          |
| `npm run build`   | Gera o bundle otimizado para produção na pasta `dist/`           |
| `npm run preview` | Serve localmente o último build gerado                           |
| `npm run prod`    | Builda e abre o preview de produção em sequência                 |

### Desenvolvimento vs Produção

- **`npm run dev`** — Use durante o desenvolvimento. O Vite sobe um servidor local com HMR (Hot Module Replacement), ou seja, qualquer alteração no código reflete instantaneamente no navegador sem recarregar a página.

- **`npm run build`** — Gera arquivos estáticos otimizados (HTML, JS, CSS) na pasta `dist/`. Esses arquivos são o que você hospeda em produção (Vercel, Netlify, Nginx, etc).

- **`npm run prod`** — Atalho que executa o build e abre o preview logo em seguida, útil para testar localmente como o app se comporta em modo de produção.

## Por que não usamos Nodemon?

O **Nodemon** é uma ferramenta que monitora alterações em arquivos e reinicia automaticamente um processo Node.js. Ele é excelente para projetos **backend** (servidores Express, APIs, bots), onde você precisa reiniciar o processo para que as mudanças tenham efeito.

Neste projeto **não faz sentido usar Nodemon** porque:

1. **O Vite já faz isso nativamente e melhor.** O dev server do Vite possui HMR (Hot Module Replacement), que atualiza o navegador instantaneamente quando você salva um arquivo — sem reiniciar nenhum processo e sem perder o estado da aplicação.

2. **Nodemon reinicia o processo inteiro.** Em um frontend, isso significaria derrubar e subir o servidor de desenvolvimento toda vez que um arquivo muda. O HMR do Vite é cirurgicamente mais eficiente: ele atualiza apenas o módulo que mudou.

3. **Não há processo persistente para "reiniciar".** Em produção, o frontend vira arquivos estáticos (`dist/`). Não existe um servidor Node.js rodando permanentemente que precise ser reiniciado.

**Resumo:** Nodemon = ótimo para backend. Vite HMR = a solução correta para frontend. Instalar Nodemon aqui seria redundante e sem efeito prático.

## Tabelas do Banco (Supabase)

O painel consome 3 tabelas:

- **`users`** — Usuários do bot (LID, nome, status admin/ban/mute, contadores de uso)
- **`user_commands`** — Log de todos os comandos executados (quem, qual comando, quando)
- **`user_allowed_groups`** — Vínculos de quais grupos cada usuário pode usar o bot

A modelagem completa está documentada em `modelagemBancoBotWhatsapp.md`.
