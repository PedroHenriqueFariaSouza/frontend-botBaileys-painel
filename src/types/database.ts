/** Tabela `bots` — cada linha representa uma instância/socket WhatsApp */
export interface Bot {
  id: string;
  name?: string | null;
  /** Status reportado pelo BotManager: "active" | "pairing" | "disconnected" etc. */
  status: string | null;
  /** false = BotManager não sobe o socket; null/undefined = tratado como ativo */
  is_active?: boolean | null;
  /** JID do número vinculado ao bot após pareamento */
  phone_jid?: string | null;
  description?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Tabela `users` — consumers registrados por bot (escopados por bot_id) */
export interface User {
  id?: number;
  bot_id?: string;
  /** WhatsApp Link ID — identificador estável mesmo após troca de número */
  lid: string;
  phone_jid: string | null;
  push_name: string | null;
  is_admin: boolean;
  is_banned: boolean;
  banned_at: string | null;
  ban_reason: string | null;
  /** ISO timestamp — bot ignora mensagens deste usuário até essa data */
  muted_until: string | null;
  /** ISO timestamp — anti-spam: bloqueia novos comandos até essa data */
  cooldown_until: string | null;
  command_count: number;
  daily_command_count: number;
  /** Data de referência para zerar daily_command_count */
  daily_count_date: string | null;
  last_command_at: string | null;
  first_seen_at: string | null;
  updated_at: string | null;
}

/** Tabela `user_commands` — log imutável de cada comando disparado */
export interface UserCommand {
  id: number;
  bot_id?: string;
  user_id?: number;
  lid: string;
  command: string;
  used_at: string;
}

/** Tabela `user_allowed_groups` — vincula um usuário a grupos onde pode usar o bot */
export interface UserAllowedGroup {
  id: number;
  bot_id?: string;
  user_id?: number;
  lid: string;
  /** JID do grupo WhatsApp (ex: 1234567890-1234567890@g.us) */
  group_id: string;
  created_at: string;
}

/** Tabela `bot_roles` — catálogo de papéis (perfis) por bot */
export interface BotRole {
  id: number;
  bot_id: string;
  name: string;
  slug: string;
  description?: string | null;
  /** Papel de sistema (admin) — não pode ser deletado pelo front-end */
  is_system: boolean;
  created_at: string | null;
  updated_at: string | null;
}

/** Tabela `user_roles` — junção N:N usuário ↔ papel por bot */
export interface UserRole {
  id: number;
  bot_id: string;
  user_id: number;
  role_id: number;
  created_at: string | null;
}
