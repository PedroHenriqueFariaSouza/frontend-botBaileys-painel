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
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import { supabase } from "../lib/supabase";
import { formatUiErrorMessage } from "../lib/uiError.ts";
import type { Bot, UserCommand, User } from "../types/database";

export default function CommandsPage() {
  const [commands, setCommands] = useState<UserCommand[]>([]);
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  // Lista de bots usada para popular o dropdown de filtro
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // bot_id selecionado no dropdown; string vazia = sem filtro (todos os bots)
  const [botFilter, setBotFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UserCommand | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  async function fetchCommands() {
    setLoading(true);
    // Três queries em paralelo: comandos, mapa de nomes e lista de bots para o filtro
    const [cmdsRes, usersRes, botsRes] = await Promise.all([
      supabase
        .from("user_commands")
        .select("*")
        .order("used_at", { ascending: false })
        .limit(500),
      supabase
        .from("users")
        .select("lid, push_name"),
      // Só o campo id é necessário para popular o dropdown de filtro
      supabase.from("bots").select("id").order("id"),
    ]);

    if (cmdsRes.error) {
      setError(formatUiErrorMessage("carregar os comandos", cmdsRes.error.message));
    } else {
      setCommands(cmdsRes.data ?? []);
    }

    if (!usersRes.error && usersRes.data) {
      // Monta um Map<lid, push_name> para resolver nomes sem query extra por linha
      const map = new Map<string, string>();
      (usersRes.data as Pick<User, "lid" | "push_name">[]).forEach((u) => {
        if (u.push_name) map.set(u.lid, u.push_name);
      });
      setUserMap(map);
    }

    if (!botsRes.error && botsRes.data) {
      setBots(botsRes.data as Bot[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchCommands();
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from("user_commands").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);

    if (error) {
      setSnackbar({ open: true, message: formatUiErrorMessage("remover o comando do log", error.message), severity: "error" });
    } else {
      setSnackbar({ open: true, message: "Comando removido do log!", severity: "success" });
      fetchCommands();
    }
  }

  // Filtragem local: escopo de bot primeiro, depois busca por texto
  const filtered = commands.filter(
    (c) =>
      (botFilter === "" || c.bot_id === botFilter) &&
      (c.lid.includes(search) ||
        c.command.toLowerCase().includes(search.toLowerCase()) ||
        (userMap.get(c.lid) ?? "").toLowerCase().includes(search.toLowerCase()))
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
      <Typography variant="h5" sx={{ mb: 2 }}>
        Log de Comandos ({filtered.length})
      </Typography>

      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center", flexWrap: "wrap" }}>
        <TextField
          size="small"
          placeholder="Buscar por LID, nome ou comando..."
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
              <TableCell>LID</TableCell>
              <TableCell>Usuário</TableCell>
              <TableCell>Comando</TableCell>
              <TableCell>Executado em</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((cmd) => (
              <TableRow key={cmd.id} hover>
                <TableCell>
                  <IconButton size="small" onClick={() => setDeleteTarget(cmd)} title="Deletar" color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
                <TableCell>{cmd.id}</TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>
                  {cmd.lid}
                </TableCell>
                <TableCell>
                  {userMap.get(cmd.lid) ?? <Typography variant="body2" color="text.disabled" component="span">—</Typography>}
                </TableCell>
                <TableCell>
                  <code>{cmd.command}</code>
                </TableCell>
                <TableCell>
                  {new Date(cmd.used_at).toLocaleString("pt-BR")}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  Nenhum comando encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Confirm delete dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Confirmar exclusão</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza que deseja remover o log do comando <strong>{deleteTarget?.command}</strong> (ID {deleteTarget?.id})?
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
