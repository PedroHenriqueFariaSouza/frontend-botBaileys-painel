# 📚 Banco de Dados - Bot WhatsApp (Supabase)

## 🎯 Sobre

Este documento descreve a estrutura do banco de dados do bot, **já implementada e integrada** ao projeto via Supabase.

O banco é responsável por:

- Controle de usuários (whitelist via banco)
- Controle de permissões (admin/ban/mute)
- Controle de uso (logs e estatísticas)
- Restrição de uso por grupos

A modelagem foi pensada para ser **simples, escalável e sem overengineering**.

---

## 🔗 Integração com o Projeto

O banco de dados está hospedado no **Supabase** e é acessado via `@supabase/supabase-js`.

As credenciais ficam no `.env`:
```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=sua_service_role_key
```

O módulo de acesso ao banco fica em:
```
src/database/
├── supabase.ts    # Client Supabase (inicialização)
├── users.ts       # CRUD e verificações da tabela users
├── groups.ts      # Verificação de grupos autorizados
├── commands.ts    # Log de comandos executados
└── index.ts       # Barrel export
```

---

## 🔄 Fallback: Banco de Dados + `.env`

O bot usa um sistema de **duas camadas** para controle de acesso:

| Verificação | Fonte primária | Fallback (.env) |
|---|---|---|
| **Whitelist** (quem pode usar o bot) | Tabela `users` — se o LID existe e não está banido, passa | `WHITELIST_NUMBERS` no `.env` |
| **Admin** (comandos restritos) | Campo `is_admin` na tabela `users` | `ADMIN_NUMBERS` no `.env` |
| **Grupos autorizados** | Tabela `user_allowed_groups` | `ALLOWED_GROUPS` no `.env` |

### Como funciona na prática:

1. **Mensagem chega** → bot extrai o LID do remetente
2. **Busca no banco** (`findUser`) → se o usuário existe no banco:
   - Verifica `is_banned`, `muted_until`, `cooldown_until`
   - Se tudo OK, processa o comando
3. **Se NÃO existe no banco** → verifica o **fallback .env** (`WHITELIST_NUMBERS`):
   - Se o LID está na lista do `.env`, **cria automaticamente** o registro no banco
   - Se não está em nenhum dos dois, a mensagem é ignorada silenciosamente

### Por que o fallback existe?

- **Bootstrap:** Quando o banco está vazio, o admin precisa de uma forma de acessar o bot para começar a popular dados
- **Segurança:** Se o Supabase ficar fora do ar, os números do `.env` continuam funcionando
- **Migração gradual:** Permite migrar do controle por `.env` para o banco sem interrupção

> 💡 **Quando quiser:** Depois que o banco estiver com todos os usuários e grupos cadastrados, você pode esvaziar `WHITELIST_NUMBERS` e `ALLOWED_GROUPS` do `.env`. O bot vai usar 100% o banco.

---

# ⚠️ Nota sobre identificação de usuários: LID vs JID

O WhatsApp mudou a forma como identifica usuários internamente.  
Antes, o identificador era o **JID** baseado no número de telefone (ex: `5564984051412@s.whatsapp.net`).  
Agora, o WhatsApp usa o **LID (Linked Identity)** — um ID interno diferente do número de telefone (ex: `83339562246177@lid`).

No código do bot, o remetente é extraído assim:
```ts
const sender = message.key.participant || remoteJid;
```

- Em **grupos**: `participant` retorna o LID do remetente (ex: `83339562246177@lid`)
- Em **DMs**: `remoteJid` retorna o JID do chat (pode ser `@s.whatsapp.net` ou `@lid`)

Por isso, o bot possui o comando `meuid` — que permite qualquer pessoa descobrir seu LID para ser adicionada à whitelist.

**Consequência para o banco:** A chave primária do usuário é o `lid` (a parte numérica do LID), não mais o número de telefone.

---

# 🧱 Tabela: `users`

| Campo                | Tipo         | Descrição                                                                 |
|---------------------|-------------|--------------------------------------------------------------------------|
| lid                 | VARCHAR(50) | LID do usuário — identificador único no WhatsApp (chave primária)       |
| phone_jid           | VARCHAR(50) | JID baseado no número de telefone (opcional, apenas informativo)         |
| push_name           | VARCHAR(100)| Nome exibido do contato                                                  |
| is_admin            | BOOLEAN     | Define se o usuário é administrador                                      |
| is_banned           | BOOLEAN     | Indica se o usuário está banido                                          |
| banned_at           | DATETIME    | Quando o ban foi aplicado                                                |
| ban_reason          | VARCHAR(255)| Motivo do ban                                                            |
| muted_until         | DATETIME    | Até quando o usuário está silenciado                                     |
| cooldown_until      | DATETIME    | Controle de anti-spam (bloqueia até esse horário)                        |
| command_count       | INTEGER     | Total de comandos usados                                                 |
| daily_command_count | INTEGER     | Quantidade de comandos usados no dia                                     |
| daily_count_date    | DATE        | Data de referência do contador diário                                    |
| last_command_at     | DATETIME    | Último comando executado                                                 |
| first_seen_at       | DATETIME    | Primeira interação com o bot                                             |
| updated_at          | DATETIME    | Última atualização do registro                                           |

---

## 🧠 Por que esses campos existem?

- **lid**  
  Identifica unicamente cada usuário via LID (Linked Identity).  
  É a parte numérica do identificador interno do WhatsApp (ex: `83339562246177`).  
  Sem isso não existe controle.

- **phone_jid**  
  O JID antigo baseado no número de telefone (ex: `5564984051412`).  
  Opcional e apenas informativo — útil para o admin saber qual número real está por trás do LID.  
  Não deve ser usado como chave, pois nem sempre está disponível.

- **push_name**  
  Apenas informativo. Pode mudar, então não deve ser usado como chave.

- **is_admin**  
  Permite criar comandos restritos (ban, broadcast, etc).

- **is_banned / banned_at / ban_reason**  
  Controle completo de banimento.  
  O motivo evita dúvidas futuras e ajuda na administração.

- **muted_until**  
  Permite silenciar usuário temporariamente sem precisar de cron/job.  
  O próprio tempo resolve o estado.

- **cooldown_until**  
  Protege contra spam/flood.  
  Mesmo que você não limite uso, isso evita sobrecarga e problemas com o WhatsApp.

- **command_count**  
  Estatística geral de uso.

- **daily_command_count + daily_count_date**  
  Permite limitar uso diário sem precisar de job externo.  
  O reset acontece automaticamente via lógica no código.

- **last_command_at**  
  Útil para debug e análise de comportamento.

- **first_seen_at**  
  Permite identificar novos usuários (ex: mensagem de boas-vindas).

- **updated_at**  
  Controle básico de alteração de dados.

---

# 📊 Tabela: `user_commands`

| Campo    | Tipo         | Descrição                                         |
|----------|-------------|--------------------------------------------------|
| id       | INTEGER     | ID único do registro                             |
| lid      | VARCHAR(50) | LID do usuário que executou o comando (FK → users)|
| command  | VARCHAR(50) | Nome do comando executado                        |
| used_at  | DATETIME    | Data e hora da execução                          |

---

## 🧠 Por que essa tabela existe?

Essa tabela é responsável pelo **log de uso do bot**.

- Permite saber quais comandos são mais usados
- Ajuda a detectar abuso ou spam
- Facilita debugging (quem executou o quê e quando)
- Base para métricas futuras (ranking de usuários, etc)

❗ Importante:  
Não armazenar logs em campo TEXT dentro de `users`.  
Separar em tabela própria é o que permite escalar.

---

# 📊 Tabela: `user_allowed_groups`

| Campo      | Tipo         | Descrição                                         |
|------------|-------------|--------------------------------------------------|
| id         | INTEGER     | ID único do vínculo                              |
| lid        | VARCHAR(50) | LID do usuário (FK → users)                      |
| group_id   | VARCHAR(50) | ID do grupo do WhatsApp                          |
| created_at | DATETIME    | Data de criação do vínculo                       |

---

## 🧠 Por que essa tabela existe?

Define **em quais grupos o usuário (identificado pelo LID) pode usar o bot**.

### Regra do sistema:
> O bot só funciona em grupos previamente autorizados.

### Benefícios:

- Evita uso indevido em grupos aleatórios
- Permite controle fino por usuário
- Escala facilmente (um usuário pode ter vários grupos)

---

# 🔁 Fluxo de validação do bot (implementado)

```
mensagem recebida →

1. Filtra mensagens do próprio bot, newsletters, status
2. Grupo? → Verifica no banco (user_allowed_groups) → fallback ALLOWED_GROUPS do .env
3. Comando "meuid"? → Responde com LID + ID do grupo (funciona SEM whitelist)
4. Extrai LID do remetente (message.key.participant || remoteJid)
5. Busca usuário no banco (findUser)
   ├─ Existe? → Verifica ban → mute → cooldown
   └─ Não existe? → Verifica WHITELIST_NUMBERS do .env
                    ├─ Está no .env? → Cria registro automaticamente no banco
                    └─ Não está? → Ignora silenciosamente
6. Resolve isAdmin (banco is_admin OU ADMIN_NUMBERS do .env)
7. Executa comando na feature correspondente
8. Loga comando no banco (user_commands)
9. Atualiza estatísticas do usuário (command_count, daily_command_count, etc)
```

**Implementação:** O pipeline completo está em `src/index.ts` (evento `messages.upsert`).
O roteamento de comandos e log estão em `src/handlers/index.ts`.

---

# 🚀 Considerações finais

Essa modelagem foi construída e implementada com foco em:

- **Simplicidade** — poucas tabelas, campos objetivos
- **Performance** — índices nas colunas mais consultadas
- **Facilidade de manutenção** — código modular em `src/database/`
- **Resiliência** — fallback `.env` garante funcionamento mesmo sem banco
- **Crescimento futuro** — estrutura pronta para novas features sem refatoração pesada

---
