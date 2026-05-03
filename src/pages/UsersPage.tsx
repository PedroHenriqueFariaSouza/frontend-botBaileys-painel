import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Snackbar,
  Checkbox,
  FormGroup,
  Divider,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { supabase } from "../lib/supabase";
import { formatUiErrorMessage } from "../lib/uiError.ts";
import type { Bot, BotRole, User } from "../types/database";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  // Lista de bots usada para popular o dropdown de filtro
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // bot_id selecionado no dropdown; string vazia = sem filtro (todos os bots)
  const [botFilter, setBotFilter] = useState("");

  // Papéis disponíveis para o bot selecionado no dialog aberto
  const [dialogRoles, setDialogRoles] = useState<BotRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editRoleIds, setEditRoleIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  // Add dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [newUser, setNewUser] = useState({ lid: "", push_name: "", phone_jid: "", is_admin: false, bot_id: "" });
  const [addRoleIds, setAddRoleIds] = useState<Set<number>>(new Set());
  const [addSaving, setAddSaving] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    // Busca usuários e bots em paralelo para não fazer duas roundtrips sequenciais
    const [usersRes, botsRes] = await Promise.all([
      supabase.from("users").select("*").order("first_seen_at", { ascending: false }),
      // Só o campo id é necessário para popular o dropdown de filtro
      supabase.from("bots").select("id").order("id"),
    ]);

    if (usersRes.error) {
      setError(formatUiErrorMessage("carregar os usuários", usersRes.error.message));
    } else {
      setUsers(usersRes.data ?? []);
    }
    if (!botsRes.error && botsRes.data) {
      setBots(botsRes.data as Bot[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchRolesForBot(selectedBotId: string) {
    if (!selectedBotId) { setDialogRoles([]); return; }
    setLoadingRoles(true);
    const { data, error } = await supabase
      .from("bot_roles")
      .select("*")
      .eq("bot_id", selectedBotId)
      .order("name");
    setLoadingRoles(false);
    if (!error && data) setDialogRoles(data as BotRole[]);
    else setDialogRoles([]);
  }

  async function fetchUserRoleIds(userId: number, botId: string): Promise<Set<number>> {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role_id")
      .eq("user_id", userId)
      .eq("bot_id", botId);
    if (error || !data) return new Set();
    return new Set((data as { role_id: number }[]).map((r) => r.role_id));
  }

  async function handleEdit(user: User) {
    setEditUser({ ...user });
    setEditRoleIds(new Set());
    setEditOpen(true);
    const botId = user.bot_id ?? "";
    await fetchRolesForBot(botId);
    if (user.id && botId) {
      const ids = await fetchUserRoleIds(user.id, botId);
      setEditRoleIds(ids);
    }
  }

  async function handleSave() {
    if (!editUser) return;
    setSaving(true);

    let updateQuery = supabase
      .from("users")
      .update({
        push_name: editUser.push_name,
        phone_jid: editUser.phone_jid,
        is_admin: editUser.is_admin,
        is_banned: editUser.is_banned,
        ban_reason: editUser.is_banned ? editUser.ban_reason : null,
        banned_at: editUser.is_banned ? editUser.banned_at ?? new Date().toISOString() : null,
        muted_until: editUser.muted_until || null,
        cooldown_until: editUser.cooldown_until || null,
        updated_at: new Date().toISOString(),
      });

    // Prioriza o id (PK) para evitar update em múltiplos bots com o mesmo LID.
    if (editUser.id) {
      updateQuery = updateQuery.eq("id", editUser.id);
    } else {
      updateQuery = updateQuery.eq("lid", editUser.lid);
      if (editUser.bot_id) {
        updateQuery = updateQuery.eq("bot_id", editUser.bot_id);
      }
    }

    const { error } = await updateQuery;

    if (error) {
      setSaving(false);
      setSnackbar({ open: true, message: formatUiErrorMessage("salvar o usuário", error.message), severity: "error" });
      return;
    }

    // Sincroniza user_roles: remove todas e reinsere as selecionadas
    if (editUser.id && editUser.bot_id) {
      const userId = editUser.id;
      const botId = editUser.bot_id;
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("bot_id", botId);
      if (editRoleIds.size > 0) {
        await supabase.from("user_roles").insert(
          [...editRoleIds].map((roleId) => ({ bot_id: botId, user_id: userId, role_id: roleId }))
        );
      }
    }

    setSaving(false);
    setSnackbar({ open: true, message: "Usuário atualizado com sucesso!", severity: "success" });
    setEditOpen(false);
    fetchUsers();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    let deleteQuery = supabase.from("users").delete();

    // Prioriza o id (PK) para evitar remover usuário homônimo (mesmo LID) de outro bot.
    if (deleteTarget.id) {
      deleteQuery = deleteQuery.eq("id", deleteTarget.id);
    } else {
      deleteQuery = deleteQuery.eq("lid", deleteTarget.lid);
      if (deleteTarget.bot_id) {
        deleteQuery = deleteQuery.eq("bot_id", deleteTarget.bot_id);
      }
    }

    const { error } = await deleteQuery;
    setDeleteTarget(null);

    if (error) {
      setSnackbar({ open: true, message: formatUiErrorMessage("remover o usuário", error.message), severity: "error" });
    } else {
      setSnackbar({ open: true, message: "Usuário removido! Ao interagir com o bot, um novo registro será criado.", severity: "success" });
      fetchUsers();
    }
  }

  async function handleAdd() {
    if (!newUser.lid.trim()) return;
    setAddSaving(true);

    const { data: inserted, error } = await supabase
      .from("users")
      .insert({
        lid: newUser.lid.trim(),
        push_name: newUser.push_name.trim() || null,
        phone_jid: newUser.phone_jid.trim() || null,
        is_admin: newUser.is_admin,
        bot_id: newUser.bot_id || null,
        is_banned: false,
        command_count: 0,
        daily_command_count: 0,
        first_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      setAddSaving(false);
      setSnackbar({ open: true, message: formatUiErrorMessage("adicionar o usuário", error.message), severity: "error" });
      return;
    }

    // Salva papéis selecionados
    if (inserted && newUser.bot_id && addRoleIds.size > 0) {
      await supabase.from("user_roles").insert(
        [...addRoleIds].map((roleId) => ({ bot_id: newUser.bot_id, user_id: inserted.id, role_id: roleId }))
      );
    }

    setAddSaving(false);
    setSnackbar({ open: true, message: "Usuário adicionado com sucesso!", severity: "success" });
    setAddOpen(false);
    setNewUser({ lid: "", push_name: "", phone_jid: "", is_admin: false, bot_id: "" });
    setAddRoleIds(new Set());
    setDialogRoles([]);
    fetchUsers();
  }

  // Filtragem local: aplica primeiro o escopo de bot (se selecionado) e depois a busca por texto
  // Manter client-side evita queries extras no Supabase a cada keystroke
  const filtered = users.filter(
    (u) =>
      (botFilter === "" || u.bot_id === botFilter) &&
      (u.lid.includes(search) ||
        u.push_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.phone_jid?.includes(search))
  );

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5">
          Usuários ({filtered.length})
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Adicionar
        </Button>
      </Box>

      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center", flexWrap: "wrap" }}>
        <TextField
          size="small"
          placeholder="Buscar por LID, nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 320 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            },
          }}
        />
        {/* Dropdown de filtro por bot_id — isolamento visual por instância (roadmap 5.1) */}
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Bot</InputLabel>
          <Select
            value={botFilter}
            label="Bot"
            onChange={(e) => setBotFilter(e.target.value)}
          >
            {/* Opção padrão: exibe registros de todos os bots */}
            <MenuItem value="">Todos os bots</MenuItem>
            {bots.map((b) => (
              <MenuItem key={b.id} value={b.id}>
                {b.id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Ações</TableCell>
              <TableCell>LID</TableCell>
              <TableCell>Nome</TableCell>
              <TableCell>Phone JID</TableCell>
              <TableCell align="center">Admin</TableCell>
              <TableCell align="center">Banido</TableCell>
              <TableCell>Motivo Ban</TableCell>
              <TableCell>Mudo até</TableCell>
              <TableCell align="right">Comandos</TableCell>
              <TableCell align="right">Hoje</TableCell>
              <TableCell>Último comando</TableCell>
              <TableCell>Primeiro acesso</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((user) => (
              <TableRow key={user.id ?? `${user.bot_id ?? "sem-bot"}:${user.lid}`} hover>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <IconButton size="small" onClick={() => handleEdit(user)} title="Editar">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <Box sx={{ width: "1px", height: 24, bgcolor: "divider" }} />
                    <IconButton size="small" onClick={() => setDeleteTarget(user)} title="Deletar" color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>
                  {user.lid}
                </TableCell>
                <TableCell>{user.push_name ?? "—"}</TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>
                  {user.phone_jid ?? "—"}
                </TableCell>
                <TableCell align="center">
                  {user.is_admin ? (
                    <Chip label="Admin" color="primary" size="small" />
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell align="center">
                  {user.is_banned ? (
                    <Chip label="Banido" color="error" size="small" />
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{user.ban_reason ?? "—"}</TableCell>
                <TableCell>
                  {user.muted_until
                    ? new Date(user.muted_until).toLocaleString("pt-BR")
                    : "—"}
                </TableCell>
                <TableCell align="right">{user.command_count}</TableCell>
                <TableCell align="right">
                  {user.daily_count_date === new Date().toISOString().slice(0, 10)
                    ? user.daily_command_count
                    : 0}
                </TableCell>
                <TableCell>
                  {user.last_command_at
                    ? new Date(user.last_command_at).toLocaleString("pt-BR")
                    : "—"}
                </TableCell>
                <TableCell>
                  {user.first_seen_at
                    ? new Date(user.first_seen_at).toLocaleString("pt-BR")
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} align="center" sx={{ py: 4 }}>
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar Usuário — {editUser?.lid}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          <TextField
            label="Nome (push_name)"
            value={editUser?.push_name ?? ""}
            onChange={(e) => setEditUser((prev) => prev ? { ...prev, push_name: e.target.value || null } : null)}
            size="small"
            fullWidth
          />
          <TextField
            label="Phone JID"
            value={editUser?.phone_jid ?? ""}
            onChange={(e) => setEditUser((prev) => prev ? { ...prev, phone_jid: e.target.value || null } : null)}
            size="small"
            fullWidth
          />
          <FormControlLabel
            control={
              <Switch
                checked={editUser?.is_admin ?? false}
                onChange={(e) => setEditUser((prev) => prev ? { ...prev, is_admin: e.target.checked } : null)}
              />
            }
            label="Administrador"
          />
          <FormControlLabel
            control={
              <Switch
                checked={editUser?.is_banned ?? false}
                onChange={(e) => setEditUser((prev) => prev ? { ...prev, is_banned: e.target.checked } : null)}
              />
            }
            label="Banido"
          />
          {editUser?.is_banned && (
            <TextField
              label="Motivo do ban"
              value={editUser?.ban_reason ?? ""}
              onChange={(e) => setEditUser((prev) => prev ? { ...prev, ban_reason: e.target.value || null } : null)}
              size="small"
              fullWidth
            />
          )}
          <TextField
            label="Mudo até (datetime)"
            type="datetime-local"
            value={editUser?.muted_until?.slice(0, 16) ?? ""}
            onChange={(e) => setEditUser((prev) => prev ? { ...prev, muted_until: e.target.value ? new Date(e.target.value).toISOString() : null } : null)}
            size="small"
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Cooldown até (datetime)"
            type="datetime-local"
            value={editUser?.cooldown_until?.slice(0, 16) ?? ""}
            onChange={(e) => setEditUser((prev) => prev ? { ...prev, cooldown_until: e.target.value ? new Date(e.target.value).toISOString() : null } : null)}
            size="small"
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          {/* Seção de papéis — exibida apenas quando o usuário tem bot_id */}
          {editUser?.bot_id && (
            <>
              <Divider />
              <Typography variant="subtitle2" color="text.secondary">
                Papéis no bot {editUser.bot_id}
              </Typography>
              {loadingRoles ? (
                <CircularProgress size={20} />
              ) : dialogRoles.length === 0 ? (
                <Typography variant="body2" color="text.disabled">
                  Nenhum papel cadastrado para este bot.
                </Typography>
              ) : (
                <FormGroup>
                  {dialogRoles.map((role) => (
                    <FormControlLabel
                      key={role.id}
                      control={
                        <Checkbox
                          size="small"
                          checked={editRoleIds.has(role.id)}
                          onChange={(e) => {
                            setEditRoleIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(role.id);
                              else next.delete(role.id);
                              return next;
                            });
                          }}
                        />
                      }
                      label={
                        <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          {role.name}
                        </Box>
                      }
                    />
                  ))}
                </FormGroup>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add user dialog */}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setDialogRoles([]); setAddRoleIds(new Set()); }} maxWidth="sm" fullWidth>
        <DialogTitle>Adicionar Usuário</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          {/* Seletor de bot obrigatório para escopar o usuário e carregar papéis */}
          <FormControl size="small" fullWidth>
            <InputLabel>Bot</InputLabel>
            <Select
              value={newUser.bot_id}
              label="Bot"
              onChange={(e) => {
                const id = e.target.value;
                setNewUser((prev) => ({ ...prev, bot_id: id }));
                setAddRoleIds(new Set());
                fetchRolesForBot(id);
              }}
            >
              <MenuItem value=""><em>Selecione um bot (opcional)</em></MenuItem>
              {bots.map((b) => (
                <MenuItem key={b.id} value={b.id}>{b.id}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="LID"
            value={newUser.lid}
            onChange={(e) => setNewUser((prev) => ({ ...prev, lid: e.target.value }))}
            size="small"
            fullWidth
            required
            placeholder="Ex: 83339562246177"
          />
          <TextField
            label="Nome (push_name)"
            value={newUser.push_name}
            onChange={(e) => setNewUser((prev) => ({ ...prev, push_name: e.target.value }))}
            size="small"
            fullWidth
          />
          <TextField
            label="Phone JID"
            value={newUser.phone_jid}
            onChange={(e) => setNewUser((prev) => ({ ...prev, phone_jid: e.target.value }))}
            size="small"
            fullWidth
            placeholder="Ex: 5564984051412"
          />
          <FormControlLabel
            control={
              <Switch
                checked={newUser.is_admin}
                onChange={(e) => setNewUser((prev) => ({ ...prev, is_admin: e.target.checked }))}
              />
            }
            label="Administrador"
          />
          {/* Seção de papéis — exibida apenas quando bot selecionado */}
          {newUser.bot_id && (
            <>
              <Divider />
              <Typography variant="subtitle2" color="text.secondary">
                Papéis no bot {newUser.bot_id}
              </Typography>
              {loadingRoles ? (
                <CircularProgress size={20} />
              ) : dialogRoles.length === 0 ? (
                <Typography variant="body2" color="text.disabled">
                  Nenhum papel cadastrado para este bot.
                </Typography>
              ) : (
                <FormGroup>
                  {dialogRoles.map((role) => (
                    <FormControlLabel
                      key={role.id}
                      control={
                        <Checkbox
                          size="small"
                          checked={addRoleIds.has(role.id)}
                          onChange={(e) => {
                            setAddRoleIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(role.id);
                              else next.delete(role.id);
                              return next;
                            });
                          }}
                        />
                      }
                      label={
                        <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          {role.name}
                        </Box>
                      }
                    />
                  ))}
                </FormGroup>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddOpen(false); setDialogRoles([]); setAddRoleIds(new Set()); }}>Cancelar</Button>
          <Button onClick={handleAdd} variant="contained" disabled={addSaving || !newUser.lid.trim()}>
            {addSaving ? "Salvando..." : "Adicionar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm delete dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Confirmar exclusão</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza que deseja remover o usuário <strong>{deleteTarget?.push_name ?? deleteTarget?.lid}</strong> (LID: {deleteTarget?.lid})?
            <br /><br />
            Quando essa pessoa interagir com o bot novamente (com o novo LID), um novo registro será criado automaticamente.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Deletar</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
