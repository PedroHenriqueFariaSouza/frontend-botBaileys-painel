# 📚 Banco de Dados - Bot WhatsApp (Supabase)

## 🎯 Sobre

Este documento descreve a estrutura do banco de dados do bot no Supabase, já considerando a direção arquitetural definida para o projeto:

- múltiplos bots funcionando na mesma solução
- autenticação persistente do WhatsApp no banco
- painel/web para pareamento e administração
- isolamento lógico por instância de bot

O banco é responsável por:

- controle de bots/instâncias
- armazenamento da sessão do WhatsApp (Baileys)
- controle de usuários por bot
- controle de permissões híbrido (`is_admin` + papéis por bot)
- controle de uso (logs e estatísticas)
- restrição de uso por grupos

A modelagem foi pensada para ser simples, escalável e preparada para multi-bot sem refatoração estrutural depois.

---

## 🔗 Integração com o Projeto

O banco de dados está hospedado no Supabase e é acessado via `@supabase/supabase-js`.

As credenciais ficam no `.env`:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=sua_service_role_key
BOT_ID=default
PAIR_TOKEN=defina_um_token_forte
```

O módulo de acesso ao banco fica em:

```text
src/database/
├── supabase.ts    # Client Supabase (inicialização)
├── users.ts       # CRUD e verificações da tabela users
├── groups.ts      # Verificação de grupos autorizados
├── commands.ts    # Log de comandos executados
├── authStore.ts   # Persistência de auth do Baileys
└── index.ts       # Barrel export
```

---

## 🧭 Decisão Arquitetural

O projeto não está sendo modelado apenas para um bot único.

O objetivo é permitir que múltiplos bots coexistam na mesma base de código e no mesmo banco, cada um com:

- seu próprio número/instância WhatsApp
- seu próprio estado de autenticação
- sua própria whitelist
- seus próprios grupos permitidos
- seus próprios logs e estatísticas

Por isso, a tabela `bots` passa a ser a entidade raiz da modelagem.

---

## SQL completo de criação do banco

Use o script abaixo no Supabase para criar a modelagem completa já alinhada com essa realidade multi-bot.

> **Importante:** Este script assume **banco novo** ou tabelas ainda não existentes nesse formato. Se o projeto já tiver tabelas antigas como `users`, `user_commands` e `user_allowed_groups`, o `CREATE TABLE IF NOT EXISTS` **não altera** a estrutura antiga. Nesse caso, é necessário rodar uma **migração** antes, senão comandos como `CREATE INDEX ... ON users(bot_id, lid)` falham com erro `column "bot_id" does not exist`.

```sql
-- 1. Tabela raiz de bots / instancias
CREATE TABLE IF NOT EXISTS bots (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'inactive',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  phone_jid VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de usuarios por bot
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  lid VARCHAR(50) NOT NULL,
  phone_jid VARCHAR(50),
  push_name VARCHAR(100),
  is_admin BOOLEAN DEFAULT FALSE,
  is_banned BOOLEAN DEFAULT FALSE,
  banned_at TIMESTAMP WITH TIME ZONE,
  ban_reason VARCHAR(255),
  muted_until TIMESTAMP WITH TIME ZONE,
  cooldown_until TIMESTAMP WITH TIME ZONE,
  command_count INTEGER DEFAULT 0,
  daily_command_count INTEGER DEFAULT 0,
  daily_count_date DATE DEFAULT CURRENT_DATE,
  last_command_at TIMESTAMP WITH TIME ZONE,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_users_bot_lid UNIQUE (bot_id, lid),
  CONSTRAINT uq_users_id_bot UNIQUE (id, bot_id)
);

-- 3. Catalogo de papeis por bot
CREATE TABLE IF NOT EXISTS bot_roles (
  id BIGSERIAL PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_bot_roles_bot_slug UNIQUE (bot_id, slug),
  CONSTRAINT uq_bot_roles_id_bot UNIQUE (id, bot_id)
);

-- 4. Vinculo N:N usuario x papel por bot
CREATE TABLE IF NOT EXISTS user_roles (
  id BIGSERIAL PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_user_roles_user_bot FOREIGN KEY (user_id, bot_id)
    REFERENCES users (id, bot_id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role_bot FOREIGN KEY (role_id, bot_id)
    REFERENCES bot_roles (id, bot_id) ON DELETE CASCADE,
  CONSTRAINT uq_user_roles UNIQUE (bot_id, user_id, role_id)
);

-- 5. Tabela de logs de comandos por bot
CREATE TABLE IF NOT EXISTS user_commands (
  id BIGSERIAL PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  command VARCHAR(50) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Tabela de grupos permitidos por bot e usuario
CREATE TABLE IF NOT EXISTS user_allowed_groups (
  id BIGSERIAL PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_user_allowed_groups UNIQUE (bot_id, user_id, group_id)
);

-- 7. Tabela de autenticacao persistente do Baileys
CREATE TABLE IF NOT EXISTS auth_store (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  key_type TEXT NOT NULL,
  key_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_auth_store_key UNIQUE (bot_id, key_type, key_id)
);

-- 8. Indices para performance
CREATE INDEX IF NOT EXISTS idx_users_bot_lid ON users(bot_id, lid);
CREATE INDEX IF NOT EXISTS idx_bot_roles_bot_slug ON bot_roles(bot_id, slug);
CREATE INDEX IF NOT EXISTS idx_user_roles_bot_user ON user_roles(bot_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_bot_role ON user_roles(bot_id, role_id);
CREATE INDEX IF NOT EXISTS idx_user_commands_bot_user ON user_commands(bot_id, user_id);
CREATE INDEX IF NOT EXISTS idx_allowed_groups_bot_user ON user_allowed_groups(bot_id, user_id);
CREATE INDEX IF NOT EXISTS idx_allowed_groups_bot_group ON user_allowed_groups(bot_id, group_id);
CREATE INDEX IF NOT EXISTS idx_auth_store_bot ON auth_store(bot_id, key_type);
CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status);

-- 9. Trigger generica para updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_bots_modtime ON bots;
CREATE TRIGGER update_bots_modtime
  BEFORE UPDATE ON bots
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_users_modtime ON users;
CREATE TRIGGER update_users_modtime
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_bot_roles_modtime ON bot_roles;
CREATE TRIGGER update_bot_roles_modtime
  BEFORE UPDATE ON bot_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_auth_store_modtime ON auth_store;
CREATE TRIGGER update_auth_store_modtime
  BEFORE UPDATE ON auth_store
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();

-- 10. RLS da tabela auth_store
ALTER TABLE auth_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON auth_store;
CREATE POLICY "Service role full access"
  ON auth_store
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "No anon access" ON auth_store;
CREATE POLICY "No anon access"
  ON auth_store
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
```

---

## Migração de banco já existente

Se o Supabase já possui a modelagem antiga do projeto, o erro abaixo é esperado ao colar o SQL completo diretamente:

```text
ERROR: column "bot_id" does not exist
```

Isso acontece porque:

- a tabela antiga `users` já existe
- o `CREATE TABLE IF NOT EXISTS users (...)` não recria a tabela
- portanto a coluna nova `bot_id` não é adicionada automaticamente
- em seguida, o índice `idx_users_bot_lid` tenta usar uma coluna que ainda não existe

### Opção A — Banco novo / ambiente limpo

Se você ainda não precisa preservar dados, a solução mais simples é:

1. apagar as tabelas antigas
2. colar novamente o SQL completo desta documentação

---

### Opção B — Migrar a estrutura antiga sem perder dados

Use o script abaixo para adaptar o schema antigo para a nova modelagem.

> Este script parte da premissa de que o sistema antigo tinha `users(lid PK)`, `user_commands(lid)` e `user_allowed_groups(lid)`.

```sql
-- 1. Criar tabela de bots
CREATE TABLE IF NOT EXISTS bots (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'inactive',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  phone_jid VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.1 Garantir a coluna usada para pausar/reativar bots sem perder dados antigos
ALTER TABLE bots ADD COLUMN IF NOT EXISTS is_active BOOLEAN;

UPDATE bots
SET is_active = TRUE
WHERE is_active IS NULL;

ALTER TABLE bots ALTER COLUMN is_active SET DEFAULT TRUE;
ALTER TABLE bots ALTER COLUMN is_active SET NOT NULL;

-- 2. Garantir bot default
INSERT INTO bots (id, name, status, is_active)
VALUES ('default', 'Bot Default', 'inactive', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3. Expandir tabela users antiga
ALTER TABLE users ADD COLUMN IF NOT EXISTS id BIGINT GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_id TEXT;

UPDATE users
SET bot_id = 'default'
WHERE bot_id IS NULL;

ALTER TABLE users ALTER COLUMN bot_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_bot'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT fk_users_bot
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_users_bot_lid'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT uq_users_bot_lid UNIQUE (bot_id, lid);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_users_id'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT uq_users_id UNIQUE (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_users_id_bot'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT uq_users_id_bot UNIQUE (id, bot_id);
  END IF;
END $$;

-- 4. Criar/ajustar tabela bot_roles
CREATE TABLE IF NOT EXISTS bot_roles (
  id BIGSERIAL PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_bot_roles_bot_slug UNIQUE (bot_id, slug),
  CONSTRAINT uq_bot_roles_id_bot UNIQUE (id, bot_id)
);

ALTER TABLE bot_roles ADD COLUMN IF NOT EXISTS bot_id TEXT;
ALTER TABLE bot_roles ADD COLUMN IF NOT EXISTS name VARCHAR(80);
ALTER TABLE bot_roles ADD COLUMN IF NOT EXISTS slug VARCHAR(80);
ALTER TABLE bot_roles ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE bot_roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bot_roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

UPDATE bot_roles
SET bot_id = 'default'
WHERE bot_id IS NULL;

UPDATE bot_roles
SET name = CONCAT('Role ', id::TEXT)
WHERE name IS NULL;

UPDATE bot_roles
SET slug = CONCAT('role-', id::TEXT)
WHERE slug IS NULL;

UPDATE bot_roles
SET created_at = NOW()
WHERE created_at IS NULL;

UPDATE bot_roles
SET updated_at = NOW()
WHERE updated_at IS NULL;

ALTER TABLE bot_roles ALTER COLUMN bot_id SET NOT NULL;
ALTER TABLE bot_roles ALTER COLUMN name SET NOT NULL;
ALTER TABLE bot_roles ALTER COLUMN slug SET NOT NULL;
ALTER TABLE bot_roles ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE bot_roles ALTER COLUMN updated_at SET DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_bot_roles_bot'
  ) THEN
    ALTER TABLE bot_roles
    ADD CONSTRAINT fk_bot_roles_bot
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_bot_roles_bot_slug'
  ) THEN
    ALTER TABLE bot_roles
    ADD CONSTRAINT uq_bot_roles_bot_slug UNIQUE (bot_id, slug);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_bot_roles_id_bot'
  ) THEN
    ALTER TABLE bot_roles
    ADD CONSTRAINT uq_bot_roles_id_bot UNIQUE (id, bot_id);
  END IF;
END $$;

-- 5. Criar/ajustar tabela user_roles
CREATE TABLE IF NOT EXISTS user_roles (
  id BIGSERIAL PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_user_roles_user_bot FOREIGN KEY (user_id, bot_id)
    REFERENCES users (id, bot_id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role_bot FOREIGN KEY (role_id, bot_id)
    REFERENCES bot_roles (id, bot_id) ON DELETE CASCADE,
  CONSTRAINT uq_user_roles UNIQUE (bot_id, user_id, role_id)
);

ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS bot_id TEXT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS role_id BIGINT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;

UPDATE user_roles
SET created_at = NOW()
WHERE created_at IS NULL;

ALTER TABLE user_roles ALTER COLUMN bot_id SET NOT NULL;
ALTER TABLE user_roles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE user_roles ALTER COLUMN role_id SET NOT NULL;
ALTER TABLE user_roles ALTER COLUMN created_at SET DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_roles_bot'
  ) THEN
    ALTER TABLE user_roles
    ADD CONSTRAINT fk_user_roles_bot
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_roles_user_bot'
  ) THEN
    ALTER TABLE user_roles
    ADD CONSTRAINT fk_user_roles_user_bot
    FOREIGN KEY (user_id, bot_id) REFERENCES users(id, bot_id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_roles_role_bot'
  ) THEN
    ALTER TABLE user_roles
    ADD CONSTRAINT fk_user_roles_role_bot
    FOREIGN KEY (role_id, bot_id) REFERENCES bot_roles(id, bot_id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_user_roles'
  ) THEN
    ALTER TABLE user_roles
    ADD CONSTRAINT uq_user_roles UNIQUE (bot_id, user_id, role_id);
  END IF;
END $$;

-- 6. Expandir logs antigos
ALTER TABLE user_commands ADD COLUMN IF NOT EXISTS bot_id TEXT;
ALTER TABLE user_commands ADD COLUMN IF NOT EXISTS user_id BIGINT;

UPDATE user_commands uc
SET bot_id = 'default'
WHERE uc.bot_id IS NULL;

UPDATE user_commands uc
SET user_id = u.id
FROM users u
WHERE uc.user_id IS NULL
  AND uc.lid = u.lid
  AND u.bot_id = 'default';

ALTER TABLE user_commands ALTER COLUMN bot_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_commands_bot'
  ) THEN
    ALTER TABLE user_commands
    ADD CONSTRAINT fk_user_commands_bot
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_commands_user'
  ) THEN
    ALTER TABLE user_commands
    ADD CONSTRAINT fk_user_commands_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 9. Expandir grupos antigos
ALTER TABLE user_allowed_groups ADD COLUMN IF NOT EXISTS bot_id TEXT;
ALTER TABLE user_allowed_groups ADD COLUMN IF NOT EXISTS user_id BIGINT;

UPDATE user_allowed_groups ug
SET bot_id = 'default'
WHERE ug.bot_id IS NULL;

UPDATE user_allowed_groups ug
SET user_id = u.id
FROM users u
WHERE ug.user_id IS NULL
  AND ug.lid = u.lid
  AND u.bot_id = 'default';

ALTER TABLE user_allowed_groups ALTER COLUMN bot_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_allowed_groups_bot'
  ) THEN
    ALTER TABLE user_allowed_groups
    ADD CONSTRAINT fk_user_allowed_groups_bot
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_allowed_groups_user'
  ) THEN
    ALTER TABLE user_allowed_groups
    ADD CONSTRAINT fk_user_allowed_groups_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_user_allowed_groups'
  ) THEN
    ALTER TABLE user_allowed_groups
    ADD CONSTRAINT uq_user_allowed_groups UNIQUE (bot_id, user_id, group_id);
  END IF;
END $$;

-- 10. Criar auth_store se ainda nao existir
CREATE TABLE IF NOT EXISTS auth_store (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  key_type TEXT NOT NULL,
  key_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_auth_store_key UNIQUE (bot_id, key_type, key_id)
);

-- 10.1. Garantir FK auth_store -> bots em bancos que ja tinham auth_store sem relacionamento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_auth_store_bot'
  ) THEN
    ALTER TABLE auth_store
    ADD CONSTRAINT fk_auth_store_bot
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 11. Indices
CREATE INDEX IF NOT EXISTS idx_users_bot_lid ON users(bot_id, lid);
CREATE INDEX IF NOT EXISTS idx_bot_roles_bot_slug ON bot_roles(bot_id, slug);
CREATE INDEX IF NOT EXISTS idx_user_roles_bot_user ON user_roles(bot_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_bot_role ON user_roles(bot_id, role_id);
CREATE INDEX IF NOT EXISTS idx_user_commands_bot_user ON user_commands(bot_id, user_id);
CREATE INDEX IF NOT EXISTS idx_allowed_groups_bot_user ON user_allowed_groups(bot_id, user_id);
CREATE INDEX IF NOT EXISTS idx_allowed_groups_bot_group ON user_allowed_groups(bot_id, group_id);
CREATE INDEX IF NOT EXISTS idx_auth_store_bot ON auth_store(bot_id, key_type);
CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status);
```

### Observação importante sobre limpeza posterior

O script de migração **não remove** a coluna `lid` de `user_commands` e `user_allowed_groups`. Isso é intencional: o script apenas adiciona o `user_id` e faz o backfill, mas mantém o `lid` original para não destruir dados nem quebrar código que ainda dependa dele.

Quando o núcleo do bot e o frontend estiverem 100% operando com `user_id` nessas tabelas (e o `lid` nelas não for mais lido nem escrito por nenhum código), você pode executar a limpeza manualmente:

```sql
ALTER TABLE user_commands DROP COLUMN IF EXISTS lid;
ALTER TABLE user_allowed_groups DROP COLUMN IF EXISTS lid;
```

Não rode isso antes de confirmar que nenhuma parte do sistema ainda usa `lid` como referência de usuário nessas duas tabelas.

---

## 🧱 Tabela: `bots`

Esta é a entidade central da modelagem.

Cada registro representa uma instância real de bot WhatsApp.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `TEXT` | Identificador estável do bot. Ex: `default`, `cliente-a`, `suporte` |
| `name` | `VARCHAR(100)` | Nome amigável da instância |
| `status` | `VARCHAR(30)` | Estado operacional da instância (`inactive`, `pairing`, `ready`, `active`, `disconnected`) |
| `is_active` | `BOOLEAN` | Controle administrativo para pausar ou reativar a instância sem deletar o registro |
| `phone_jid` | `VARCHAR(50)` | JID/número da instância quando conhecido |
| `description` | `TEXT` | Campo opcional de documentação/admin |
| `created_at` | `TIMESTAMPTZ` | Quando o bot foi provisionado |
| `updated_at` | `TIMESTAMPTZ` | Última atualização do registro |

### Por que essa tabela existe?

Sem a tabela `bots`, o `bot_id` ficaria apenas como uma string solta espalhada pelo sistema.
Com ela, o projeto passa a ter:

- uma fonte oficial das instâncias existentes
- integridade referencial para `auth_store`
- integridade referencial para usuários, grupos e logs
- base para painel administrativo e provisionamento

---

## 🔐 Autenticação persistente do WhatsApp (Baileys)

Além das tabelas de domínio, o banco também armazena o estado de autenticação do WhatsApp, equivalente ao conteúdo da pasta `auth/`.

## Objetivo

Substituir o armazenamento local em arquivos por persistência no Supabase para:

- evitar perda de sessão em ambientes efêmeros
- permitir pareamento por frontend
- centralizar o estado do bot no banco
- suportar múltiplos bots de forma isolada

---

## 🧱 Tabela: `auth_store`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `BIGINT` | Chave primária técnica |
| `bot_id` | `TEXT` | FK para `bots(id)` |
| `key_type` | `TEXT` | Tipo da chave do Baileys (`creds`, `pre-key`, `session`, etc.) |
| `key_id` | `TEXT` | Identificador único dentro do tipo |
| `data` | `JSONB` | Conteúdo serializado da chave/credencial |
| `created_at` | `TIMESTAMPTZ` | Data de criação |
| `updated_at` | `TIMESTAMPTZ` | Última atualização |

### Finalidade dos campos

- `bot_id`: isola a sessão de cada bot de forma formal e relacional
- `key_type`: define a categoria da chave
- `key_id`: define qual item daquela categoria está sendo salvo
- `data`: guarda o JSON serializado com `BufferJSON`
- `updated_at`: ajuda em auditoria, debug e diagnóstico de sessão

---

## 🔐 Segurança (RLS obrigatório)

Regra de segurança para `auth_store`:

- frontend não acessa `auth_store` diretamente
- apenas backend com `service_role` lê/escreve credenciais
- a chave `anon` deve ter acesso zero ao conteúdo de `data`

Essa é a tabela mais sensível do sistema, porque contém material criptográfico do Signal Protocol.

---

## 🗂️ Mapeamento auth/ → auth_store

| Arquivo antigo no filesystem | key_type | key_id | data |
|---|---|---|---|
| `creds.json` | `creds` | `main` | JSON completo |
| `pre-key-1.json` | `pre-key` | `1` | JSON completo |
| `session-556484051412.0.json` | `session` | `556484051412.0` | JSON completo |
| `sender-key-status@broadcast--xxx.json` | `sender-key` | `status@broadcast--xxx` | JSON completo |
| `app-state-sync-key-AAA.json` | `app-state-sync-key` | `AAA` | JSON completo |
| `app-state-sync-version-regular.json` | `app-state-sync-version` | `regular` | JSON completo |

---

## 👤 Tabela: `users`

No cenário multi-bot, usuário não pode mais ser identificado apenas por `lid` globalmente.
O mesmo LID pode existir em mais de um bot com estados de permissão diferentes.

Por isso a unicidade correta passa a ser:

- `UNIQUE (bot_id, lid)`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `BIGSERIAL` | Chave primária técnica |
| `bot_id` | `TEXT` | FK para `bots(id)` |
| `lid` | `VARCHAR(50)` | LID do usuário no WhatsApp |
| `phone_jid` | `VARCHAR(50)` | JID informativo |
| `push_name` | `VARCHAR(100)` | Nome exibido |
| `is_admin` | `BOOLEAN` | Permissão administrativa dentro daquele bot |
| `is_banned` | `BOOLEAN` | Banimento naquele bot |
| `banned_at` | `TIMESTAMPTZ` | Data do ban |
| `ban_reason` | `VARCHAR(255)` | Motivo do ban |
| `muted_until` | `TIMESTAMPTZ` | Silenciamento temporário |
| `cooldown_until` | `TIMESTAMPTZ` | Anti-spam |
| `command_count` | `INTEGER` | Total de comandos usados naquele bot |
| `daily_command_count` | `INTEGER` | Total diário naquele bot |
| `daily_count_date` | `DATE` | Data de referência do contador diário |
| `last_command_at` | `TIMESTAMPTZ` | Último comando |
| `first_seen_at` | `TIMESTAMPTZ` | Primeira interação |
| `updated_at` | `TIMESTAMPTZ` | Última atualização |

---

## 🧩 Tabela: `bot_roles`

Catálogo de papéis por instância de bot.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `BIGSERIAL` | Chave primária técnica |
| `bot_id` | `TEXT` | FK para `bots(id)` |
| `name` | `VARCHAR(80)` | Nome amigável do papel |
| `slug` | `VARCHAR(80)` | Identificador estável do papel no bot |
| `description` | `TEXT` | Descrição opcional do papel |
| `created_at` | `TIMESTAMPTZ` | Data de criação |
| `updated_at` | `TIMESTAMPTZ` | Última atualização |

Regra principal:

- `UNIQUE (bot_id, slug)` para evitar papel duplicado dentro do mesmo bot.

---

## 🔗 Tabela: `user_roles`

Vínculo N:N entre usuários e papéis, sempre escopado por `bot_id`.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `BIGSERIAL` | Chave primária técnica |
| `bot_id` | `TEXT` | FK para `bots(id)` |
| `user_id` | `BIGINT` | Referência ao usuário do bot |
| `role_id` | `BIGINT` | Referência ao papel do bot |
| `created_at` | `TIMESTAMPTZ` | Data de atribuição |

Regras principais:

- `UNIQUE (bot_id, user_id, role_id)` evita vínculo duplicado.
- FKs compostas garantem isolamento: usuário e papel devem pertencer ao mesmo bot.

---

## 📊 Tabela: `user_commands`

Esta tabela armazena o log de uso por instância de bot.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `BIGSERIAL` | Chave primária |
| `bot_id` | `TEXT` | FK para `bots(id)` |
| `user_id` | `BIGINT` | FK para `users(id)` |
| `command` | `VARCHAR(50)` | Nome do comando executado |
| `used_at` | `TIMESTAMPTZ` | Momento da execução |

### Por que usar `user_id` e `bot_id`?

- `user_id` aponta para o usuário já resolvido dentro do contexto daquele bot
- `bot_id` facilita filtros e relatórios sem joins adicionais
- isso evita ambiguidades quando o mesmo LID participa de mais de um bot

---

## 📊 Tabela: `user_allowed_groups`

Define em quais grupos um usuário pode usar determinado bot.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `BIGSERIAL` | Chave primária |
| `bot_id` | `TEXT` | FK para `bots(id)` |
| `user_id` | `BIGINT` | FK para `users(id)` |
| `group_id` | `VARCHAR(50)` | ID do grupo do WhatsApp |
| `created_at` | `TIMESTAMPTZ` | Quando o vínculo foi criado |

### Regra do sistema

O bot só funciona em grupos previamente autorizados dentro da instância correta.

Isso significa que:

- grupo autorizado no bot A não autoriza automaticamente no bot B
- permissões ficam isoladas por instância

---

## 🔄 Fallback: Banco de Dados + `.env`

O sistema continua com fallback via `.env`, mas agora sempre no contexto do bot atual (`BOT_ID`).

| Verificação | Fonte primária | Fallback (.env) |
|---|---|---|
| whitelist | tabela `users` do `bot_id` atual | `WHITELIST_NUMBERS` |
| admin | campo `is_admin` da tabela `users` do `bot_id` atual | `ADMIN_NUMBERS` |
| grupos autorizados | tabela `user_allowed_groups` do `bot_id` atual | `ALLOWED_GROUPS` |

### Como funciona na prática

1. O processo sobe com um `BOT_ID`
2. Toda consulta ao banco é filtrada por esse `BOT_ID`
3. Se não houver registro no banco, o sistema pode usar fallback do `.env`
4. Se o fallback liberar o acesso, o registro é criado no banco já vinculado à instância correta

---

## ⚠️ Nota sobre identificação de usuários: LID vs JID

O WhatsApp hoje usa LID (Linked Identity), não apenas o número de telefone.

Por isso:

- em grupos, o bot costuma receber `participant` como LID
- em DMs, o `remoteJid` pode variar
- a chave de negócio do usuário continua sendo o `lid`
- mas agora o usuário é escopado por `bot_id`

Consequência correta da modelagem:

- não usar mais `lid` como PK global da tabela `users`
- usar chave técnica `id` + unicidade `UNIQUE (bot_id, lid)`

---

## 🔌 Integração no núcleo do bot

No startup do Baileys, a origem do auth state passa de filesystem para banco:

```diff
- const { state, saveCreds } = await useMultiFileAuthState("auth");
+ const { state, saveCreds } = await useSupabaseAuthState(process.env.BOT_ID);
```

### Interface esperada

A função `useSupabaseAuthState` deve manter o contrato do Baileys:

- `state.creds`
- `state.keys.get(type, ids)`
- `state.keys.set(data)`
- `saveCreds()`

### Regra obrigatória

Todas as queries do projeto que lidam com autenticação, usuários, grupos e logs devem incluir `bot_id` explicitamente.

---

## ⚡ Performance para Signal Protocol

O Baileys faz muitas leituras e escritas de chave por mensagem. Sem cache, cada operação viraria query HTTP no Supabase.

Diretriz obrigatória:

- usar cache em memória (`NodeCache`) para `keys.get` e `keys.set`
- persistir no banco com upsert por lote quando possível
- manter deleção explícita no banco quando valor vier `null`
- cachear por `bot_id:type:key_id`, nunca apenas por `type:key_id`

---

## 🔄 Migração de sessão existente

Para preservar sessão já ativa:

1. criar ou garantir o registro correspondente na tabela `bots`
2. ler todos os arquivos da pasta `auth/`
3. converter nome de arquivo em `key_type` + `key_id`
4. inserir via upsert na `auth_store` usando o `bot_id` correto
5. validar reconexão do bot pelo banco
6. manter `auth/` como backup até estabilização

---

## 🚀 Considerações finais

Essa modelagem foi construída com foco em:

- simplicidade operacional
- separação clara entre domínio do bot e sessão do WhatsApp
- suporte real a múltiplas instâncias
- integridade referencial entre bots, usuários, grupos, logs e auth
- crescimento futuro sem refatoração estrutural pesada

---
