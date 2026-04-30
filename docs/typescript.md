# TypeScript no Projeto

## Papel no projeto

TypeScript adiciona tipagem estatica ao frontend. Isso reduz erros em tempo de execucao e melhora a previsibilidade das integracoes com Supabase e WebSocket.

## Onde aparece no codigo

- src/types/database.ts com interfaces de tabelas
- Props de componentes e estados em paginas
- Tipos de mensagens do WebSocket no pareamento

## Importancia pratica

- Evita regressao ao alterar contratos de dados
- Ajuda a manter consistencia entre frontend e banco
- Aumenta seguranca em refatoracoes e evolucoes de features

## Decisoes relevantes

- Tipos explicitos para entidades de dominio (Bot, User, UserCommand, UserAllowedGroup)
- Tipagem de estados de conexao do WebSocket para controlar fluxo de UI
