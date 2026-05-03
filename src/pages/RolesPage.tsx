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
  CircularProgress,
  Alert,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { supabase } from "../lib/supabase";
import { formatUiErrorMessage } from "../lib/uiError.ts";
import type { Bot, BotRole } from "../types/database";

/** Gera slug a partir do nome: minúsculas, espaços viram hifens, remove caracteres especiais */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function RolesPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [botId, setBotId] = useState("");
  const [roles, setRoles] = useState<BotRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", slug: "", description: "" });
  const [addSaving, setAddSaving] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editRole, setEditRole] = useState<BotRole | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<BotRole | null>(null);

  useEffect(() => {
    supabase
      .from("bots")
      .select("id, name")
      .order("id")
      .then(({ data }) => {
        if (data) setBots(data as Bot[]);
      });
  }, []);

  async function fetchRoles(selectedBotId: string) {
    if (!selectedBotId) { setRoles([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("bot_roles")
      .select("*")
      .eq("bot_id", selectedBotId)
      .order("name");
    setLoading(false);
    if (error) {
      setSnackbar({ open: true, message: formatUiErrorMessage("carregar os papéis", error.message), severity: "error" });
    } else {
      setRoles(data ?? []);
    }
  }

  function handleBotChange(id: string) {
    setBotId(id);
    fetchRoles(id);
  }

  function handleOpenAdd() {
    setNewRole({ name: "", slug: "", description: "" });
    setAddOpen(true);
  }

  async function handleAdd() {
    if (!newRole.name.trim() || !botId) return;
    setAddSaving(true);
    const { error } = await supabase.from("bot_roles").insert({
      bot_id: botId,
      name: newRole.name.trim(),
      slug: newRole.slug.trim() || toSlug(newRole.name.trim()),
      description: newRole.description.trim() || null,
      is_system: false,
    });
    setAddSaving(false);
    if (error) {
      setSnackbar({ open: true, message: formatUiErrorMessage("adicionar o papel", error.message), severity: "error" });
    } else {
      setSnackbar({ open: true, message: "Papel adicionado com sucesso!", severity: "success" });
      setAddOpen(false);
      fetchRoles(botId);
    }
  }

  function handleOpenEdit(role: BotRole) {
    setEditRole({ ...role });
    setEditOpen(true);
  }

  async function handleSave() {
    if (!editRole) return;
    setSaving(true);
    const { error } = await supabase
      .from("bot_roles")
      .update({
        name: editRole.name,
        slug: editRole.slug,
        description: editRole.description || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editRole.id);
    setSaving(false);
    if (error) {
      setSnackbar({ open: true, message: formatUiErrorMessage("salvar o papel", error.message), severity: "error" });
    } else {
      setSnackbar({ open: true, message: "Papel atualizado com sucesso!", severity: "success" });
      setEditOpen(false);
      fetchRoles(botId);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    // Verifica se o papel está em uso
    const { count } = await supabase
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role_id", deleteTarget.id);

    if (count && count > 0) {
      setDeleteTarget(null);
      setSnackbar({
        open: true,
        message: `Este papel está atribuído a ${count} usuário(s). Remova as atribuições antes de deletá-lo.`,
        severity: "error",
      });
      return;
    }

    const { error } = await supabase.from("bot_roles").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    if (error) {
      setSnackbar({ open: true, message: formatUiErrorMessage("remover o papel", error.message), severity: "error" });
    } else {
      setSnackbar({ open: true, message: "Papel removido com sucesso!", severity: "success" });
      fetchRoles(botId);
    }
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5">Papéis</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenAdd}
          disabled={!botId}
        >
          Adicionar Papel
        </Button>
      </Box>

      {/* Seletor de bot — obrigatório para visualizar/gerenciar papéis */}
      <FormControl size="small" sx={{ minWidth: 240, mb: 3 }} required>
        <InputLabel>Bot</InputLabel>
        <Select value={botId} label="Bot" onChange={(e) => handleBotChange(e.target.value)}>
          <MenuItem value=""><em>Selecione um bot</em></MenuItem>
          {bots.map((b) => (
            <MenuItem key={b.id} value={b.id}>
              {b.name ? `${b.name} (${b.id})` : b.id}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {!botId && (
        <Alert severity="info">Selecione um bot para visualizar e gerenciar seus papéis.</Alert>
      )}

      {botId && loading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {botId && !loading && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ações</TableCell>
                <TableCell>Nome</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>Descrição</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id} hover>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <IconButton size="small" onClick={() => handleOpenEdit(role)} title="Editar">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <Box sx={{ width: "1px", height: 24, bgcolor: "divider" }} />
                      <IconButton
                        size="small"
                        onClick={() => setDeleteTarget(role)}
                        title="Deletar"
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                  <TableCell>{role.name}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>{role.slug}</TableCell>
                  <TableCell>{role.description ?? "—"}</TableCell>
                </TableRow>
              ))}
              {roles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    Nenhum papel cadastrado para este bot.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Adicionar Papel — {botId}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          <TextField
            label="Nome"
            value={newRole.name}
            onChange={(e) => {
              const name = e.target.value;
              setNewRole((prev) => ({ ...prev, name, slug: toSlug(name) }));
            }}
            size="small"
            fullWidth
            required
            placeholder="Ex: Moderador"
          />
          <TextField
            label="Slug"
            value={newRole.slug}
            onChange={(e) => setNewRole((prev) => ({ ...prev, slug: e.target.value }))}
            size="small"
            fullWidth
            placeholder="Gerado automaticamente do nome"
            helperText="Identificador único. Gerado automaticamente, mas pode ser editado."
          />
          <TextField
            label="Descrição"
            value={newRole.description}
            onChange={(e) => setNewRole((prev) => ({ ...prev, description: e.target.value }))}
            size="small"
            fullWidth
            multiline
            rows={2}
            placeholder="Descreva brevemente o papel (opcional)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancelar</Button>
          <Button onClick={handleAdd} variant="contained" disabled={addSaving || !newRole.name.trim()}>
            {addSaving ? "Salvando..." : "Adicionar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar Papel — {editRole?.name}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          <TextField
            label="Nome"
            value={editRole?.name ?? ""}
            onChange={(e) => {
              const name = e.target.value;
              setEditRole((prev) => prev ? { ...prev, name } : null);
            }}
            size="small"
            fullWidth
            required
          />
          <TextField
            label="Slug"
            value={editRole?.slug ?? ""}
            onChange={(e) => setEditRole((prev) => prev ? { ...prev, slug: e.target.value } : null)}
            size="small"
            fullWidth
          />
          <TextField
            label="Descrição"
            value={editRole?.description ?? ""}
            onChange={(e) => setEditRole((prev) => prev ? { ...prev, description: e.target.value || null } : null)}
            size="small"
            fullWidth
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Confirmar exclusão</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza que deseja remover o papel <strong>{deleteTarget?.name}</strong>?
            <br /><br />
            Usuários com este papel perderão a atribuição permanentemente.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Remover</Button>
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
