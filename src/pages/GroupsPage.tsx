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
  InputAdornment,
  IconButton,
  Snackbar,
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
  Tooltip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { supabase } from "../lib/supabase";
import { formatUiErrorMessage } from "../lib/uiError.ts";
import type { Bot, UserAllowedGroup } from "../types/database";

export default function GroupsPage() {
  const [groups, setGroups] = useState<UserAllowedGroup[]>([]);
  // Lista de bots usada para popular o dropdown de filtro
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // bot_id selecionado no dropdown; string vazia = sem filtro (todos os bots)
  const [botFilter, setBotFilter] = useState("");

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newLid, setNewLid] = useState("");
  const [newGroupId, setNewGroupId] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<UserAllowedGroup | null>(null);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  async function fetchGroups() {
    setLoading(true);
    // Busca grupos e bots em paralelo para não fazer duas roundtrips sequenciais
    const [groupsRes, botsRes] = await Promise.all([
      supabase.from("user_allowed_groups").select("*").order("created_at", { ascending: false }),
      // Só o campo id é necessário para popular o dropdown de filtro
      supabase.from("bots").select("id").order("id"),
    ]);

    if (groupsRes.error) {
      setError(formatUiErrorMessage("carregar os grupos permitidos", groupsRes.error.message));
    } else {
      setGroups(groupsRes.data ?? []);
    }
    if (!botsRes.error && botsRes.data) {
      setBots(botsRes.data as Bot[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchGroups();
  }, []);

  async function handleAdd() {
    if (!newLid.trim() || !newGroupId.trim()) return;
    setAddSaving(true);

    const { error } = await supabase.from("user_allowed_groups").insert({
      lid: newLid.trim(),
      group_id: newGroupId.trim(),
    });

    setAddSaving(false);

    if (error) {
      setSnackbar({ open: true, message: formatUiErrorMessage("adicionar o grupo permitido", error.message), severity: "error" });
    } else {
      setSnackbar({ open: true, message: "Grupo adicionado com sucesso!", severity: "success" });
      setAddOpen(false);
      setNewLid("");
      setNewGroupId("");
      fetchGroups();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from("user_allowed_groups").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);

    if (error) {
      setSnackbar({ open: true, message: formatUiErrorMessage("remover o vínculo de grupo", error.message), severity: "error" });
    } else {
      setSnackbar({ open: true, message: "Vínculo removido!", severity: "success" });
      fetchGroups();
    }
  }

  // Filtragem local: escopo de bot primeiro, depois busca por texto
  const filtered = groups.filter(
    (g) =>
      (botFilter === "" || g.bot_id === botFilter) &&
      (g.lid.includes(search) || g.group_id.includes(search))
  );

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">{error}</Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5">
          Grupos Permitidos ({filtered.length})
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Adicionar
        </Button>
      </Box>

      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center", flexWrap: "wrap" }}>
        <TextField
          size="small"
          placeholder="Buscar por LID ou ID do grupo..."
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
              <TableCell>ID</TableCell>
              <TableCell>LID do Usuário</TableCell>
              <TableCell>ID do Grupo</TableCell>
              <TableCell>Criado em</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((group) => (
              <TableRow key={group.id} hover>
                <TableCell>
                  <IconButton size="small" onClick={() => setDeleteTarget(group)} title="Deletar" color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
                <TableCell>{group.id}</TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>
                  {group.lid}
                </TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>
                  {group.group_id}
                </TableCell>
                <TableCell>
                  {new Date(group.created_at).toLocaleString("pt-BR")}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  Nenhum grupo encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          Adicionar Grupo Permitido
          <Tooltip
            title="Cada permissão vincula um usuário (LID) a um grupo específico. Isso define em quais grupos aquele usuário pode interagir com o bot. Um mesmo usuário pode ter acesso a vários grupos."
            arrow
            placement="right"
          >
            <HelpOutlineIcon sx={{ fontSize: 20, color: "text.secondary", cursor: "help" }} />
          </Tooltip>
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          <TextField
            label="LID do Usuário"
            value={newLid}
            onChange={(e) => setNewLid(e.target.value)}
            size="small"
            fullWidth
            placeholder="Ex: 83339562246177"
          />
          <TextField
            label="ID do Grupo"
            value={newGroupId}
            onChange={(e) => setNewGroupId(e.target.value)}
            size="small"
            fullWidth
            placeholder="Ex: 120363044025@g.us"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancelar</Button>
          <Button onClick={handleAdd} variant="contained" disabled={addSaving || !newLid.trim() || !newGroupId.trim()}>
            {addSaving ? "Salvando..." : "Adicionar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm delete dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Confirmar exclusão</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Remover o vínculo do LID <strong>{deleteTarget?.lid}</strong> com o grupo <strong>{deleteTarget?.group_id}</strong>?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Deletar</Button>
        </DialogActions>
      </Dialog>

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
