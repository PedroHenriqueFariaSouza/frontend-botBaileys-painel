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
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import { supabase } from "../lib/supabase";
import type { UserCommand } from "../types/database";

export default function CommandsPage() {
  const [commands, setCommands] = useState<UserCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UserCommand | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  async function fetchCommands() {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_commands")
      .select("*")
      .order("used_at", { ascending: false })
      .limit(500);

    if (error) {
      setError(error.message);
    } else {
      setCommands(data ?? []);
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
      setSnackbar({ open: true, message: `Erro ao deletar: ${error.message}`, severity: "error" });
    } else {
      setSnackbar({ open: true, message: "Comando removido do log!", severity: "success" });
      fetchCommands();
    }
  }

  const filtered = commands.filter(
    (c) =>
      c.lid.includes(search) ||
      c.command.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Erro ao carregar comandos: {error}</Alert>;
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Log de Comandos ({filtered.length})
      </Typography>

      <TextField
        size="small"
        placeholder="Buscar por LID ou comando..."
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
              <TableCell>ID</TableCell>
              <TableCell>LID</TableCell>
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
                  <code>{cmd.command}</code>
                </TableCell>
                <TableCell>
                  {new Date(cmd.used_at).toLocaleString("pt-BR")}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
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
