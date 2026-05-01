const DIRECT_ERROR_MAP: Record<string, string> = {
  "Failed to fetch": "Não foi possível se comunicar com o servidor.",
  "Network request failed": "Não foi possível se comunicar com o servidor.",
  "Load failed": "Não foi possível carregar os dados solicitados.",
  "Invalid login credentials": "Credenciais de acesso inválidas.",
  "Email not confirmed": "O e-mail informado ainda não foi confirmado.",
  "User already registered": "Já existe um usuário cadastrado com esse e-mail.",
  "Email rate limit exceeded": "Limite de envio de e-mail excedido. Aguarde antes de tentar novamente.",
  "Signup is disabled": "O cadastro está desativado no momento.",
  "JWT expired": "Sua sessão expirou. Faça login novamente.",
  "Invalid JWT": "Sua sessão é inválida. Faça login novamente.",
  'Could not find the "is_active" column of "bots" in the schema cache': 'A coluna "is_active" não foi encontrada na tabela de bots.',
};

function translateKnownError(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  if (DIRECT_ERROR_MAP[trimmed]) {
    return DIRECT_ERROR_MAP[trimmed];
  }

  const lower = trimmed.toLowerCase();

  if (lower.includes("failed to fetch") || lower.includes("networkerror when attempting to fetch resource")) {
    return "Não foi possível se comunicar com o servidor.";
  }

  if (
    lower.includes("is_active") &&
    lower.includes("bots") &&
    lower.includes("schema cache") &&
    (lower.includes("column") || lower.includes("collum"))
  ) {
    return 'A coluna "is_active" não foi encontrada na tabela de bots.';
  }

  if (lower.includes("duplicate key value violates unique constraint")) {
    const duplicateMatch = trimmed.match(/key \((.+?)\)=\((.+?)\)/i);
    if (duplicateMatch) {
      return `Já existe um registro com ${duplicateMatch[1]} "${duplicateMatch[2]}".`;
    }

    return "Já existe um registro com esses dados.";
  }

  const notNullMatch = trimmed.match(/null value in column "(.+?)".+not-null constraint/i);
  if (notNullMatch) {
    return `O campo "${notNullMatch[1]}" é obrigatório.`;
  }

  const foreignKeyMatch = trimmed.match(/insert or update on table "(.+?)" violates foreign key constraint/i);
  if (foreignKeyMatch) {
    return "O registro informado depende de um dado relacionado que não foi encontrado.";
  }

  const invalidTypeMatch = trimmed.match(/invalid input syntax for type (.+?):\s*"?([^\"]+)"?/i);
  if (invalidTypeMatch) {
    return `O valor "${invalidTypeMatch[2]}" é inválido para o campo esperado.`;
  }

  if (lower.includes("row-level security")) {
    return "Você não tem permissão para executar esta operação.";
  }

  if (lower.includes("permission denied")) {
    return "Você não tem permissão para executar esta operação.";
  }

  if (lower.includes("for security purposes, you can only request this after")) {
    return "Por segurança, aguarde um momento antes de solicitar novamente.";
  }

  if (lower.includes("email address") && lower.includes("invalid")) {
    return "O endereço de e-mail informado é inválido.";
  }

  return null;
}

export function formatUiErrorMessage(action: string, message?: string | null) {
  const translated = message ? translateKnownError(message) : null;

  if (translated) {
    return `Não foi possível ${action}. ${translated}`;
  }

  if (message?.trim()) {
    return `Não foi possível ${action}. Detalhe técnico: ${message.trim()}`;
  }

  return `Não foi possível ${action}. Tente novamente.`;
}
