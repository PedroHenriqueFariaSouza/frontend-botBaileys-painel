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
  FormControlLabel,
  Switch,
  Snackbar,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { supabase } from "../lib/supabase";
import type { User } from "../types/database";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
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
  const [newUser, setNewUser] = useState({ lid: "", push_name: "", phone_jid: "", is_admin: false });
  const [addSaving, setAddSaving] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("first_seen_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setUsers(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  function handleEdit(user: User) {
    setEditUser({ ...user });
    setEditOpen(true);
  }

  async function handleSave() {
    if (!editUser) return;
    setSaving(true);

    const { error } = await supabase
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
      })
      .eq("lid", editUser.lid);

    setSaving(false);

    if (error) {
      setSnackbar({ open: true, message: `Erro ao salvar: ${error.message}`, severity: "error" });
    } else {
      setSnackbar({ open: true, message: "Usuário atualizado com sucesso!", severity: "success" });
      setEditOpen(false);
      fetchUsers();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from("users").delete().eq("lid", deleteTarget.lid);
    setDeleteTarget(null);

    if (error) {
      setSnackbar({ open: true, message: `Erro ao deletar: ${error.message}`, severity: "error" });
    } else {
      setSnackbar({ open: true, message: "Usuário removido! Ao interagir com o bot, um novo registro será criado.", severity: "success" });
      fetchUsers();
    }
  }

  async function handleAdd() {
    if (!newUser.lid.trim()) return;
    setAddSaving(true);

    const { error } = await supabase.from("users").insert({
      lid: newUser.lid.trim(),
      push_name: newUser.push_name.trim() || null,
      phone_jid: newUser.phone_jid.trim() || null,
      is_admin: newUser.is_admin,
      is_banned: false,
      command_count: 0,
      daily_command_count: 0,
      first_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setAddSaving(false);

    if (error) {
      setSnackbar({ open: true, message: `Erro ao adicionar: ${error.message}`, severity: "error" });
    } else {
      setSnackbar({ open: true, message: "Usuário adicionado com sucesso!", severity: "success" });
      setAddOpen(false);
      setNewUser({ lid: "", push_name: "", phone_jid: "", is_admin: false });
      fetchUsers();
    }
  }

  const filtered = users.filter(
    (u) =>
      u.lid.includes(search) ||
      u.push_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone_jid?.includes(search)
  );

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Erro ao carregar usuários: {error}</Alert>;
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

      <TextField
        size="small"
        placeholder="Buscar por LID, nome ou telefone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2, width: 360 }}
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
              <TableRow key={user.lid} hover>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add user dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Adicionar Usuário</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancelar</Button>
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
