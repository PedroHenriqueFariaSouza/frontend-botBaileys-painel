export interface Bot {
  id: string;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface User {
  lid: string;
  phone_jid: string | null;
  push_name: string | null;
  is_admin: boolean;
  is_banned: boolean;
  banned_at: string | null;
  ban_reason: string | null;
  muted_until: string | null;
  cooldown_until: string | null;
  command_count: number;
  daily_command_count: number;
  daily_count_date: string | null;
  last_command_at: string | null;
  first_seen_at: string | null;
  updated_at: string | null;
}

export interface UserCommand {
  id: number;
  lid: string;
  command: string;
  used_at: string;
}

export interface UserAllowedGroup {
  id: number;
  lid: string;
  group_id: string;
  created_at: string;
}
