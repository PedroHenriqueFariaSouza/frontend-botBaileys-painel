# Roadmap de Implementação — Autenticação Persistente via Banco de Dados

> **Referência:** Este documento detalha o que deve ser criado em cada fase, separando explicitamente as responsabilidades do **núcleo do bot** e do **frontend web**.
> Toda a arquitetura, modelagem e decisões estão documentadas em [`autenticacaoBancoDeDados.md`](./autenticacaoBancoDeDados.md).

---

## 🎯 Modelo de Arquitetura Multi-Bot

O sistema diferencia **bots** de **consumidores**:

| Entidade | Onde? | O que é? | Pareamento? |
|---|---|---|---|
| **Bot** | Tabela `bots` | Número WhatsApp que **responde** mensagens (sessão ativa do sistema) | ✅ Sim, via QR Code |
| **Consumer** | Tabela `users` | Usuário comum que **fala com** o bot (whitelist padrão) | ❌ Não, apenas cadastro |

**Fluxo prático:**

1. Você pareía um número WhatsApp como `bot` (escaneando QR Code)
2. Credenciais vão para `auth_store`, registro vai para `bots` com `id` = identificador interno
3. O runtime lê a tabela `bots` e sobe um socket para cada número bot ativo
4. Quando usuários mandam mensagens para esse número, o bot responde isoladamente
5. Usuários normais (consumidores) ficam em `users`, sem precisar de pareamento

**Exemplos de isolamento:**

- Número bot `5511999999999` responde via socket próprio
- Número bot `5521888888888` responde via outro socket próprio
- Usuário normal (consumer) em `users.bot_id='bot-a'` só interage com aquele bot
- Admin de `bot-a` não enxerga dados de `bot-b`

---

## Índice

- [Fase 1 — Fundação (MVP)](#fase-1--fundação-mvp)
- [Fase 2 — Servidor de Pareamento](#fase-2--servidor-de-pareamento)
- [[outro repositorio front end manipular] Fase 3 — Frontend Web](#outro-repositorio-front-end-manipular-fase-3--frontend-web)
- [Fase 4 — Hardening](#fase-4--hardening)
- [Fase 5 — Multi-Bot / Multi-Tenant](#fase-5--multi-bot--multi-tenant)

---

## Fase 1 — Fundação (MVP)

> **Objetivo:** Fazer o bot parar de usar a pasta `auth/` e passar a ler/escrever todas as credenciais e chaves de sessão diretamente no Supabase. A modelagem base multi-bot no banco já foi concluída; a partir deste ponto, o foco da fase é implementar essa realidade no **núcleo do bot**. Não envolve interface visual — é 100% infraestrutura e código do bot.

### [outro repositorio front end manipular] Frontend Web

Nada a ser feito nesta fase. O frontend ainda não existe.

---

### Núcleo do Bot

#### 1.1 — Criar a modelagem base multi-bot no Supabase ✅ Concluído

Esta etapa já foi concluída.

A estrutura do banco foi desenhada para múltiplos números WhatsApp (bots) coexistirem no mesmo sistema, cada um com sua sessão isolada.

Resultado esperado desta etapa:

- tabela `bots` — registros de números WhatsApp pareados (as sessões ativas do sistema)
  - campos: `id` (identificador único), `status` (inactive/pairing/ready/active/disconnected), `phone_jid` (número + @s.whatsapp.net), `is_active`, `created_at`, `updated_at`
  - **cada linha = um bot que sobe um socket Baileys**
- tabela `auth_store` — credenciais + chaves do Signal Protocol de cada bot
  - ligação: `bot_id` REFERENCES `bots(id)`
- tabelas operacionais — consumidores, logs e grupos
  - `users`: consumidores/whitelist escopados por `bot_id`
  - `user_commands`: logs de comandos por bot
  - `user_allowed_groups`: grupos permitidos por bot

O SQL e a estratégia de migração para banco novo ou banco já existente estão documentados em [`modelagemBancoBotWhatsapp.md`](./modelagemBancoBotWhatsapp.md).

O que fica pendente na Fase 1, a partir daqui, é a implementação do código do bot para consumir essa modelagem.

Exemplo da estrutura criada no Supabase:

```sql
CREATE TABLE auth_store (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bot_id      TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  key_type    TEXT NOT NULL,
  key_id      TEXT NOT NULL,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_auth_store_key UNIQUE (bot_id, key_type, key_id)
);

CREATE INDEX idx_auth_store_bot ON auth_store (bot_id, key_type);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auth_store_updated
  BEFORE UPDATE ON auth_store
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

Configure também o RLS para que apenas o `service_role` do Supabase tenha acesso:

```sql
ALTER TABLE auth_store ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON auth_store FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "No anon access"
  ON auth_store FOR ALL TO anon
  USING (false);
```

**Por que:** A chave `anon` (usada em frontends públicos) nunca deve conseguir ler as credenciais do Signal Protocol. Apenas o backend com a `service_role` key acessa essa tabela.

---

#### 1.2 — Implementar `useSupabaseAuthState` em `src/database/authStore.ts`

Crie o arquivo `src/database/authStore.ts`. Esta função substitui `useMultiFileAuthState("auth")` mantendo exatamente a mesma interface `{ state, saveCreds }` que o Baileys espera.

O que esta função deve fazer:

- **`readCreds()`** — Busca no banco (`key_type = 'creds'`, `key_id = 'main'`). Se não existir, chama `initAuthCreds()` do Baileys para gerar credenciais novas.
- **`saveCreds()`** — Serializa as credenciais com `BufferJSON.replacer` e faz upsert na tabela (`onConflict: 'bot_id,key_type,key_id'`).
- **`keys.get(type, ids)`** — Busca múltiplas chaves do Signal (pre-keys, sessions, sender-keys) em uma única query usando `IN (ids)`. Deserializa com `BufferJSON.reviver`.
- **`keys.set(data)`** — Para cada chave com valor não-nulo, faz upsert no banco. Para chaves com valor `null`, deleta o registro correspondente (o Baileys sinaliza deleção passando `null`).

O `bot_id` deve vir da variável de ambiente `BOT_ID`. Durante bootstrap, pode usar `default`, mas a modelagem já assume que existirão múltiplos bots reais na solução.

Estrutura de tipos de chave e como eles mapeiam para a tabela:

| Arquivo original | `key_type` | `key_id` |
|---|---|---|
| `creds.json` | `creds` | `main` |
| `pre-key-1.json` | `pre-key` | `1` |
| `session-556484051412.0.json` | `session` | `556484051412.0` |
| `sender-key-status@broadcast--xxx.json` | `sender-key` | `status@broadcast--xxx` |
| `app-state-sync-key-AAA.json` | `app-state-sync-key` | `AAA` |
| `app-state-sync-version-regular.json` | `app-state-sync-version` | `regular` |

---

#### 1.3 — Adicionar cache em memória com `NodeCache`

O Signal Protocol faz **dezenas de leituras/escritas de chaves por mensagem** (encrypt/decrypt). Sem cache, cada operação seria uma query HTTP ao Supabase — inviável em produção.

O projeto já usa `NodeCache` para `msgRetryCounterCache`, então a dependência já está disponível.

Dentro do `keys.get` e `keys.set` da `useSupabaseAuthState`:

- **No `get`:** Montar uma `cacheKey` como `"${type}:${id}"`. Se existir no cache, retornar sem ir ao banco. Se não existir, buscar no banco, salvar no cache e retornar.
- **No `set`:** Salvar imediatamente no cache (síncrono) e disparar o upsert ao Supabase em background (async/fire-and-forget ou com batching).

TTL sugerido: 5 minutos (`stdTTL: 300`). Ajustar conforme a necessidade.

O cache transforma dezenas de queries por mensagem em zero queries na maioria dos casos.

---

#### 1.4 — Criar script de migração `auth/` → banco de dados

Crie um script separado (ex: `src/scripts/migrateAuthToDb.ts`) que:

1. Lê todos os arquivos da pasta `auth/` usando `fs`.
2. Para cada arquivo, infere o `key_type` e `key_id` a partir do nome do arquivo.
3. Faz o parse do JSON e upsert na tabela `auth_store`.
4. Ao final, imprime quantos registros foram migrados.

**Importante:** Não deletar a pasta `auth/` durante a migração. Mantê-la como backup até o bot ser validado com o banco.

Regras de inferência do nome do arquivo para `key_type`/`key_id`:

- `creds.json` → `key_type: 'creds'`, `key_id: 'main'`
- `pre-key-27.json` → `key_type: 'pre-key'`, `key_id: '27'`
- `session-556484051412.0.json` → `key_type: 'session'`, `key_id: '556484051412.0'`
- `sender-key-<resto>.json` → `key_type: 'sender-key'`, `key_id: '<resto>'`
- `app-state-sync-key-<resto>.json` → `key_type: 'app-state-sync-key'`, `key_id: '<resto>'`
- `app-state-sync-version-<resto>.json` → `key_type: 'app-state-sync-version'`, `key_id: '<resto>'`

---

#### 1.5 — Criar `BotManager` em `src/index.ts` para múltiplos bots

Esta é a alteração estrutural mais importante. Em vez de subir um único bot:

```diff
- const { state, saveCreds } = await useMultiFileAuthState("auth");
+ const { state, saveCreds } = await useSupabaseAuthState();
- const sock = makeWASocket({ auth: { ...state, keys: ... } });
```

Agora o runtime deve:

1. **Consultar no Supabase todos os bots ativos:**
   ```sql
   SELECT * FROM bots WHERE is_active = true
   ```

2. **Para cada bot, criar um socket isolado:**
   ```ts
   const bots = await supabase.from('bots').select('*').eq('is_active', true);
   
   for (const bot of bots) {
     const { state, saveCreds } = await useSupabaseAuthState(bot.id);
     const sock = makeWASocket({ auth: { ...state, keys: ... } });
     
     bots_map.set(bot.id, {
       sock,
       status: 'connecting',
       botId: bot.id,
       // ...
     });
   }
   ```

3. **Manter todos os sockets vivos no mesmo processo:**
   - Cada socket tem listeners próprios para `connection.update`, `messages.upsert`, etc.
   - Handler central recebe a mensagem e sabe qual `botId` processá-la
   - Feature executa escopada por `botId`

**Benefício:** Um número desconecta, os outros seguem respondendo. Sem impacto cruzado.

---

#### 1.6 — Adaptar `clearCorruptedAuthFiles` para operar no banco

A função atual que limpa a pasta `auth/` em caso de corrupção precisa de uma equivalente para o banco. Crie (ou adapte) uma função `clearCorruptedAuthKeys`:

Ela deve deletar todos os registros da tabela `auth_store` cujo `key_type` seja diferente de `'creds'` (ou seja: pre-keys, sessions, sender-keys, app-state-sync-key, app-state-sync-version) para o `bot_id` correspondente. As credenciais principais (`creds`) não devem ser deletadas nessa limpeza.

Usar `delete({ count: 'exact' })` para logar quantos registros foram removidos.

---

#### 1.7 — Validar conexão, reconexão e troca de mensagens ⚠️ Validado parcialmente

Status atual da validação desta etapa:

- ✅ Migração executada com sucesso (`auth/` → `auth_store`), com 41 registros enviados para `BOT_ID=default`
- ✅ Leitura do estado de autenticação pelo bot via `useSupabaseAuthState`
- ✅ Handshake inicial com o endpoint do WhatsApp iniciado com sucesso
- ❌ Sessão rejeitada pelo WhatsApp com `401 Unauthorized` (logout), impedindo validar troca de mensagens e reconexão estável sem novo pareamento

Bloqueio identificado:

- A sessão migrada existente está inválida/expirada no WhatsApp

Próxima ação para concluir a 1.7:

1. Realizar novo pareamento (gerar sessão nova válida).
2. Subir o bot novamente e confirmar `connection: open`.
3. Validar envio/recebimento de mensagem real.
4. Reiniciar processo e confirmar reconexão sem QR.

Após as etapas acima:

1. Rodar o script de migração (1.4).
2. Subir o bot com `useSupabaseAuthState`.
3. Verificar no Supabase que as credenciais foram lidas/escritas corretamente.
4. Enviar e receber mensagens para confirmar que o Signal Protocol está operando.
5. Reiniciar o bot e verificar que ele se reconecta sem pedir novo QR Code.

---

## Fase 2 — Servidor de Pareamento

> **Objetivo:** Embutir no bot um servidor HTTP/WebSocket que gere o QR Code de pareamento e o envie em tempo real para quem estiver conectado. Esta fase não envolve ainda uma interface bonita — apenas o endpoint funcional.

### Núcleo do Bot

#### 2.1 — Subir servidor HTTP/WebSocket junto com o bot

Adicionar ao processo do bot (recomendado: usar Express + `ws`) um servidor HTTP que:

- Escuta em uma porta definida via variável de ambiente (ex: `PAIR_PORT=3000`).
- Tem um middleware de autenticação simples em todas as rotas `/pair/*` que valida um token via `req.query.token` ou `Authorization` header, comparando com `process.env.PAIR_TOKEN`.
- Retorna `401` se o token for inválido.

O servidor HTTP sobe junto com o socket do Baileys, no mesmo processo. Não é um serviço separado.

Exemplo de estrutura de rotas:

```
GET  /pair        → Serve a página HTML de pareamento (Fase 3)
WS   /pair/ws     → WebSocket que transmite QR Code e status em tempo real
```

---

#### 2.2 — Implementar lógica do socket Baileys temporário

Quando um cliente abre o WebSocket em `/pair/ws` **para parear um novo bot**:

1. Criar uma instância **temporária** do socket Baileys com `printQRInTerminal: false`.
2. Escutar o evento `connection.update`.
3. Quando `qr` estiver presente no update, converter para base64 (usando a lib `qrcode`) e enviar ao cliente WebSocket como JSON: `{ type: 'qr', payload: '<base64>' }`.
4. Quando `connection === 'open'`, salvar as credenciais no Supabase, encerrar o socket temporário e enviar ao cliente: `{ type: 'success' }`.
5. Quando `connection === 'close'`, enviar ao cliente: `{ type: 'error', message: '...' }`.

**Importante:** O QR Code expira a cada ~20 segundos. O Baileys emite múltiplos QRs até o scan acontecer. O WebSocket deve repassar cada novo QR ao cliente em tempo real.

**Importante:** Se um bot já está ativo em `bots_map` (socket rodando em memória), o pareamento **não deve** tentar reusar o mesmo `bot_id`. Deve validar no banco se aquele `bot_id` já tem `status = 'active'` e recusar ou aguardar desconexão.

Regra segura: o socket temporário de pareamento é sempre isolado. Credenciais gravadas. Status marcado `ready`. O `BotManager` carrega o novo bot na próxima varredura ou em um rebalanceamento.

---

#### 2.3 — Implementar fluxo de status (`pairing` → `ready` → `active`)

Para evitar race conditions entre o servidor de pareamento e o bot que lê as credenciais, adicionar um campo `status` à tabela `auth_store` ou em uma tabela separada `bot_status`:

| Status | Significado |
|---|---|
| `pairing` | Frontend abriu WebSocket, pareamento em andamento |
| `ready` | Scan concluído, credenciais salvas, frontend encerrou socket temporário |
| `active` | Bot leu as credenciais e está operando normalmente |

O bot só deve tentar ler credenciais do banco quando `status = 'ready'` ou `status = 'active'`.
O frontend de pareamento deve atualizar o status para `pairing` ao iniciar e para `ready` ao concluir.

---

#### 2.4 — Testar ciclo completo via curl/wscat ⏳ Pendente

Status atual:

- Esta etapa ficará pendente temporariamente.
- A execução dos testes end-to-end (curl/wscat + scan real + validação de assunção da sessão pelo bot principal) será feita no fechamento das implementações das fases em andamento.

Antes de construir o frontend, validar o endpoint diretamente:

1. Conectar no WebSocket `/pair/ws?token=<PAIR_TOKEN>` com `wscat` ou similar.
2. Verificar que o QR chega como mensagem JSON com `type: 'qr'`.
3. Escanear o QR com o aplicativo WhatsApp.
4. Verificar que a mensagem `{ type: 'success' }` chega.
5. Verificar que as credenciais foram salvas no Supabase.
6. Subir o bot e verificar que ele assume a sessão.

---

## [outro repositorio front end manipular] Fase 3 — Frontend Web

> **Objetivo:** Nesta fase, o frontend será implementado no outro repositório já existente. Neste repositório atual, o foco fica apenas nos ajustes do núcleo do bot para servir e sustentar a interface.

### Núcleo do Bot

Nesta fase, neste repositório, implementar apenas o necessário no núcleo do bot para suportar o frontend externo.

Ajuste principal: garantir que `GET /pair` serve corretamente o arquivo HTML/interface consumida a partir do outro repositório de frontend.

---

### [outro repositorio front end manipular] Frontend Web

> O frontend de pareamento é uma página simples — não precisa de framework pesado. Pode ser um HTML + JS vanilla, React, Vue, ou qualquer outra tecnologia. O que importa é o comportamento.

#### 3.1 — Desenvolver a interface de pareamento

A página deve:

1. Ao abrir, conectar via WebSocket no endpoint `/pair/ws?token=<token>`.
2. Renderizar o QR Code assim que a mensagem `{ type: 'qr', payload: '<base64>' }` chegar (usar a lib `qrcode` ou `qrcode.react` para renderizar o base64 como imagem).
3. Exibir um indicador de carregamento enquanto aguarda o QR.
4. Quando receber `{ type: 'success' }`, exibir mensagem de sucesso: "Bot pareado com sucesso! Aguarde a inicialização."
5. Quando receber `{ type: 'error' }`, exibir mensagem de erro com a causa e botão para tentar novamente.

---

#### 3.2 — Adicionar autenticação no frontend

O token de acesso ao endpoint de pareamento **não deve ficar exposto no HTML público**. Estratégias:

- **Opção simples:** O admin digita o token em um campo de texto antes de conectar. O token é enviado como query param ou header no WebSocket.
- **Opção mais segura:** Criar uma rota de login (`POST /pair/login`) que valida usuário/senha do `.env` e retorna um JWT de curta duração. O WebSocket usa o JWT.

Em qualquer caso, a página de pareamento nunca deve ser acessível sem autenticação.

---

#### 3.3 — Implementar reconexão automática do WebSocket

O QR Code expira a cada ~20 segundos. Se o WebSocket cair (timeout, erro de rede), a página deve reconectar automaticamente e solicitar um novo QR. Implementar:

- Detectar evento `onclose` e `onerror` do WebSocket.
- Aguardar 2-3 segundos e tentar reconectar.
- Limpar o QR exibido durante a reconexão e exibir "Reconectando...".
- Limitar o número de tentativas (ex: 5) antes de exibir erro permanente.

---

#### 3.4 — Testar em dispositivos mobile e desktop

Pontos específicos a validar:

- O QR renderiza em tamanho adequado para ser escaneado pelo WhatsApp (mínimo ~200x200px, recomendado ~300x300px).
- Em mobile, a câmera do WhatsApp consegue focar e ler o QR na tela do computador.
- O feedback de sucesso aparece em ambos os dispositivos.
- O token de autenticação não vaza em logs do console nem no HTML do DOM.

---

## Fase 4 — Hardening

> **Objetivo:** Tornar o sistema robusto para uso em produção. Cobre segurança, resiliência e operabilidade.

### [outro repositorio front end manipular] Frontend Web

#### 4.1 — Não exibir dados sensíveis no DOM

Garantir que o token de autenticação e qualquer dado intermediário do pareamento não sejam expostos em atributos HTML ou logs do console.

#### 4.2 — Comunicação via WSS (WebSocket Secure)

Em produção, o WebSocket deve usar `wss://` (WebSocket sobre TLS). Configurar o servidor de forma que, quando a variável `NODE_ENV=production`, o servidor esteja atrás de um proxy (nginx, Caddy, etc.) que termina o TLS. O frontend deve se conectar via `wss://`.

---

### Núcleo do Bot

#### 4.3 — Criptografia do campo `data` no nível da aplicação (opcional)

O `creds.json` contém chaves privadas do Signal Protocol. Quem possui essas chaves pode se passar pelo número vinculado.

Embora o Supabase já criptografe dados em repouso, é possível adicionar uma camada extra: criptografar o campo `data` com AES-256 antes de salvar, usando uma chave que só o backend possui (variável de ambiente `AUTH_ENCRYPTION_KEY`). Descriptografar ao ler.

Isso garante que mesmo um acesso não autorizado ao banco não expõe as credenciais em texto claro.

---

#### 4.4 — Monitoramento de saúde da sessão

Implementar um mecanismo que detecte quando o bot se desconecta do WhatsApp (evento `connection: 'close'` com `loggedOut: true` ou por erro) e:

- Loga o evento com nível `error`.
- Opcionalmente, envia uma notificação (email, webhook, mensagem no próprio WhatsApp via número de alerta) para o administrador.
- Atualiza o `status` no banco para `disconnected`.

Isso permite que o admin saiba que precisa re-parear sem precisar monitorar o terminal.

---

#### 4.5 — Fallback local em disco para indisponibilidade do banco

Se o Supabase ficar indisponível:

- O cache em memória (`NodeCache`) permite que o bot continue operando por um tempo (as chaves já estão em RAM).
- Para writes, enfileirar as operações pendentes e persistir quando o banco voltar (retry com backoff exponencial).
- Opcionalmente, manter um fallback em disco (arquivo JSON local) como cache de emergência para leituras críticas.

---

#### 4.6 — Documentação de operações

Criar um `RUNBOOK.md` (ou seção no README) cobrindo:

- Como re-parear o bot (sessão expirou, WhatsApp forçou logout, celular trocou).
- Como debugar problemas de conexão (verificar status no banco, logs do bot).
- Como restaurar um backup das credenciais do banco.
- O que fazer se o bot entrar em loop de reconexão.

---

## 📌 Convenção de Divisão de Responsabilidades

Por toda este documento, você verá seções marcadas com:

- **`### Núcleo do Bot`** — Mudanças que você faz **NESTE REPOSITÓRIO** (`botWathsapp-baileys`)
  - Pairing server (`src/pairing/server.ts`)
  - BotManager para múltiplos sockets
  - Features, handlers, tipos
  - Banco de dados (migrations, queries)
  - Testes

- **`### [outro repositorio front end manipular] Frontend Web`** — Mudanças que você faz **EM OUTRO REPOSITÓRIO**
  - Painel admin
  - Interface de QR Code
  - Autenticação do cliente
  - Chamadas HTTP/WS para este servidor

---

## Fase 5 — Multi-Bot / Multi-Tenant

> **Objetivo:** Consolidar a camada multi-bot já prevista desde a modelagem inicial, permitindo que múltiplos bots (diferentes números de WhatsApp) coexistam no mesmo sistema, cada um com suas credenciais, usuários, grupos e logs isolados.

---

### [outro repositorio front end manipular] Frontend Web

#### 5.1 — Painel admin para gerenciar múltiplos bots

Interface que lista todos os bots cadastrados com seu `bot_id`, status atual e data da última atualização das credenciais. Permite:

- **Provisionar novo bot:** Chamar `POST /bots` e receber URL de pareamento
- **Iniciar pareamento:** Clicar em um bot e abrir fluxo de QR Code para aquele `bot_id`
- **Monitorar status:** Ver em tempo real se cada bot está `inactive`, `pairing`, `ready`, `active` ou `disconnected`
- **Gerenciar consumidores:** Ver quais usuários (consumers/whitelist) estão vinculados a cada bot
- **Desconectar bot:** Marcar `is_active = false` ou trocar `status = 'disconnected'` para pausar sem deletar

O painel deve usar autenticação robusta (não apenas um token simples) — OAuth, magic link, ou sistema de usuários completo.

**Fluxo visual:**

1. Admin abre o painel
2. Vê lista de bots (ex: `cliente-a`, `cliente-b`, `financeiro-bot`)
3. Clica em "Parear novo bot" → provisiona `bot_id` → recebe QR URL
4. Navega para QR → escaneia → bot sobe automaticamente
5. Admin volta ao painel → vê novo bot com `status = 'active'`

---

#### 5.2 — Isolamento visual por `bot_id`

O fluxo de pareamento (QR Code) deve ser parametrizado por `bot_id`. A URL é `/pair?bot_id=cliente-a` ou o `bot_id` pode ser selecionado no painel antes de abrir o WebSocket.

O WebSocket e o servidor de pareamento devem garantir que as credenciais geradas para `bot_id: 'cliente-a'` nunca sejam escritas no registro de `bot_id: 'cliente-b'`.

**Diferenciação importante:**

- Frontend seleciona `bot_id` **antes** do QR
- Uma vez que o número é pareado com `bot_id: 'cliente-a'`, aquele número fica vinculado para sempre a `cliente-a`
- Todos os consumidores (usuários em `users`) vão estar escopados por `bot_id`
- Se um usuário quiser interagir com `cliente-b`, precisa estar em `users` com `bot_id = 'cliente-b'`

---

### Núcleo do Bot

#### 5.3 — Isolamento completo por `bot_id` em toda a base

Todas as queries do sistema devem usar `bot_id` como filtro. Isso inclui `auth_store`, `users`, `user_commands` e `user_allowed_groups`. Garantir que:

- A tabela `bots` seja a fonte oficial das instâncias ativas (números que pareamos).
- Cada bot tem `id` único no banco (ex: `bot-a`, `bot-b`, `financeiro-bot`).
- A constraint `UNIQUE (bot_id, key_type, key_id)` esteja ativa na `auth_store`.
- A unicidade `UNIQUE (bot_id, lid)` esteja ativa na `users` (consumidores são escopados por bot).
- O `clearCorruptedAuthKeys(botId)` **nunca** limpa chaves de outros bots.
- Logs (`user_commands`) e grupos (`user_allowed_groups`) nunca vazem entre bots.
- Contexto de execução sempre carrega `botId` explicitamente (em [src/features/types.ts](src/features/types.ts#L18) `BotContext.botId`).
- Features declaram `bots: "all" | string[]` indicando em quais bots estão habilitadas.

---

#### 5.4 — Provisionamento automático de novos bots via API

Criar um endpoint autenticado (ex: `POST /bots`) que:

1. Recebe um `bot_id` e dados de configuração (nome, descrição, etc.).
2. Cria um registro inicial na tabela `bots` com `status = 'inactive'`, `is_active = true`.
3. Retorna a URL do fluxo de pareamento para aquele `bot_id`.

O admin do painel pode chamar esse endpoint para adicionar um novo bot sem precisar alterar código.

**Exemplo de response:**

```json
{
  "ok": true,
  "bot_id": "cliente-novo",
  "status": "inactive",
  "pair_ws_url": "ws://localhost:3000/pair/ws?bot_id=cliente-novo"
}
```

Depois que o frontend fizer o pareamento via WebSocket, o status passa para `ready`, e o `BotManager` detecta e sobe o socket automaticamente.

---

## Resumo por Fase

| Fase | Frontend | Núcleo do Bot |
|---|---|---|
| **1 — Fundação** | Nada | Tabela `auth_store`, `useSupabaseAuthState`, cache, migração, `BotManager` multi-bot em `src/index.ts`, adaptação do `clearCorruptedAuth` |
| **2 — Servidor de Pareamento** | Nada | Servidor HTTP/WS embutido, socket Baileys temporário, fluxo de status `pairing → ready → active` |
| **3 — Frontend Web** | Interface de QR Code, autenticação, seleção de `bot_id` | Servir o HTML estático da interface |
| **4 — Hardening** | WSS em produção, sem dados sensíveis no DOM | Criptografia opcional, monitoramento de saúde, fallback local, runbook |
| **5 — Multi-Bot / Multi-Tenant** | Painel admin, UI para provisionar bots, listar consumers/whitelist | `BotManager` carrega todos os bots ativos do banco; isolamento `bot_id` em `auth_store`, `users`, `user_commands`, `user_allowed_groups`; endpoint `POST /bots`

---

## Ajustes no Núcleo do Bot — Pendências geradas pela implementação do Frontend

> Esta seção documenta alterações no **núcleo do bot** que surgiram como consequência direta de decisões tomadas na implementação do frontend. Não faziam parte do planejamento original das fases, mas são obrigatórias para que o sistema funcione.

---

### Fase 4 — Hardening: autenticação do WebSocket por mensagem (não por query param)

**Origem:** item 4.1 da Fase 4 — o frontend passou a enviar o token como primeira mensagem WebSocket em vez de expô-lo na URL (`?token=xxx`).

**Motivação:** O token na URL aparece nos logs de acesso de qualquer proxy/CDN/nginx, no histórico do navegador e nos logs de rede do DevTools — o que viola o requisito 4.1 de não expor dados sensíveis.

**O que o servidor do bot precisa mudar:**

O handler do WebSocket em `/pair/ws` atualmente valida o token via `req.query.token` ou `req.headers.authorization` no momento do upgrade HTTP. Esse comportamento precisa ser substituído pelo seguinte fluxo:

1. Aceitar a conexão WebSocket **sem validar token no upgrade** (remover o middleware de token no handshake HTTP do `/pair/ws`).
2. Configurar um **timeout de autenticação** — se a primeira mensagem não chegar em até 5 segundos, fechar o socket com código `4401`.
3. Aguardar a **primeira mensagem** do cliente. Ela deve ter o formato:
   ```json
   { "type": "auth", "token": "<PAIR_TOKEN>" }
   ```
4. Validar `token === process.env.PAIR_TOKEN`.
   - Se **válido:** prosseguir normalmente (iniciar socket Baileys temporário, emitir QRs).
   - Se **inválido ou ausente:** enviar `{ "type": "error", "message": "Unauthorized" }` e fechar o socket com código `4401`.
5. Qualquer mensagem que **não seja do tipo `auth`** como primeira mensagem deve ser tratada como inválida — fechar o socket imediatamente.

**Exemplo de estrutura no servidor (pseudocódigo):**

```ts
wss.on("connection", (ws) => {
  const authTimeout = setTimeout(() => {
    ws.close(4401, "Authentication timeout");
  }, 5000);

  ws.once("message", (raw) => {
    clearTimeout(authTimeout);

    let msg: { type: string; token?: string };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.close(4400, "Invalid message format");
      return;
    }

    if (msg.type !== "auth" || msg.token !== process.env.PAIR_TOKEN) {
      ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
      ws.close(4401, "Unauthorized");
      return;
    }

    // Autenticado — iniciar fluxo de pareamento
    startPairingSession(ws);
  });
});
```

**O middleware de token em rotas HTTP (`GET /pair`, etc.) não precisa mudar** — apenas o handler do WebSocket `/pair/ws` é afetado por esta alteração.

---

### Fase 5 — Multi-Bot: isolamento de instância via `bot_id` na mensagem de auth

**Origem:** item 5.2 da Fase 5 — o frontend passou a incluir o campo `bot_id` na mensagem de autenticação WebSocket sempre que o pareamento é iniciado a partir do painel de gerenciamento de bots.

**Motivação:** Com múltiplas instâncias de bot registradas na tabela `bots`, o servidor precisa saber qual instância está sendo pareada para gravar as credenciais Baileys no registro correto de `auth_store`.

**Formato atualizado da mensagem de auth:**

```json
{ "type": "auth", "token": "<PAIR_TOKEN>", "bot_id": "clienteA" }
```

O campo `bot_id` é **opcional** — se omitido, o servidor deve usar a instância padrão (comportamento anterior).

**O que o servidor do bot precisa mudar:**

1. Após validar o `token` (ver Fase 4 acima), extrair `msg.bot_id` da mensagem de auth.
2. Se `bot_id` estiver presente:
   - Verificar se existe um registro correspondente na tabela `bots` (`SELECT * FROM bots WHERE id = $bot_id`).
   - Usar esse `bot_id` como prefixo/chave ao gravar e ler credenciais Baileys no `auth_store` (`WHERE bot_id = $bot_id`).
   - Atualizar o campo `status` da tabela `bots` durante o fluxo: `"pairing"` ao aguardar QR, `"active"` ao conectar com sucesso, `"disconnected"` ao fechar.
3. Se `bot_id` for omitido, manter o comportamento padrão (instância única ou instância com id `"default"`).

**Exemplo de adaptação no servidor (pseudocódigo):**

```ts
ws.once("message", (raw) => {
  clearTimeout(authTimeout);
  const msg = JSON.parse(raw.toString());

  if (msg.type !== "auth" || msg.token !== process.env.PAIR_TOKEN) {
    ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
    ws.close(4401, "Unauthorized");
    return;
  }

  const botId: string = msg.bot_id ?? "default";

  // Gravar status de pareamento no Supabase
  await supabase.from("bots").upsert({ id: botId, status: "pairing" });

  // Iniciar sessão Baileys usando auth_store filtrado por bot_id
  startPairingSession(ws, botId);
});
```

**Nenhuma rota HTTP nem a lógica de autenticação do token precisam mudar** — somente o handler do WebSocket `/pair/ws` é afetado.
