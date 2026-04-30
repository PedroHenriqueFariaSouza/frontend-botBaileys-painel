# Supabase no Projeto

## Papel no projeto

Supabase atua como backend de dados e autenticacao do painel. O frontend consulta tabelas operacionais e usa Supabase Auth para controlar acesso administrativo.

## Onde aparece no codigo

- src/lib/supabase.ts para inicializacao do client
- src/pages para consultas e mutacoes de dados
- src/App.tsx e src/pages/LoginPage.tsx para sessao e login

## Importancia pratica

- Centraliza dados de operacao do bot
- Permite autenticar administradores com magic link
- Habilita eventos em tempo real para atualizacao da tela de bots

## Decisoes relevantes

- Uso de anon key no frontend e politicas de seguranca no banco
- Inscricao em eventos realtime da tabela bots para refletir status imediatamente

## Tabelas consumidas no frontend

- bots
- users
- user_commands
- user_allowed_groups
