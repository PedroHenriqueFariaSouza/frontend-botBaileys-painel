import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import { supabase } from "../lib/supabase";
import type { Bot } from "../types/database";

interface BotsPageProps {
  onPairBot: (botId: string) => void;
}

type BotStatus = "active" | "pairing" | "ready" | "disconnected" | string;

function statusChip(status: BotStatus | null) {
  switch (status) {
    case "active":
      return <Chip label="Ativo" color="success" size="small" />;
    case "pairing":
      return <Chip label="Pareando" color="warning" size="small" />;
    case "ready":
      return <Chip label="Pronto" color="info" size="small" />;
    case "disconnected":
      return <Chip label="Desconectado" color="error" size="small" />;
    default:
      return (
        <Chip label={status ?? "Desconhecido"} color="default" size="small" />
      );
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

export default function BotsPage({ onPairBot }: BotsPageProps) {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newBotId, setNewBotId] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Bot | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const fetchBots = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from("bots")
      .select("*")
      .order("created_at", { ascending: false });
    if (!silent) setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setBots((data as Bot[]) ?? []);
  }, []);

  useEffect(() => {
    void fetchBots();
  }, [fetchBots]);

  useEffect(() => {
    const channel = supabase
      .channel("bots-table-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bots" },
        () => {
          void fetchBots(true);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchBots]);

  async function handleAdd() {
    const id = newBotId.trim();
    if (!id) return;
    setAddSaving(true);
    const { error } = await supabase
      .from("bots")
      .insert({ id, status: "disconnected" });
    setAddSaving(false);
    if (error) {
      setSnackbar({ open: true, message: `Erro: ${error.message}`, severity: "error" });
      return;
    }
    setSnackbar({ open: true, message: `Bot "${id}" criado com sucesso.`, severity: "success" });
    setAddOpen(false);
    setNewBotId("");
    void fetchBots();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from("bots")
      .delete()
      .eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      setSnackbar({ open: true, message: `Erro: ${error.message}`, severity: "error" });
      setDeleteTarget(null);
      return;
    }
    setSnackbar({
      open: true,
      message: `Bot "${deleteTarget.id}" removido.`,
      severity: "success",
    });
    setDeleteTarget(null);
    void fetchBots();
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} mb={0.5}>
            Gerenciar Bots
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Instâncias cadastradas no sistema. Cada bot opera de forma isolada com suas próprias credenciais.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddOpen(true)}
        >
          Adicionar Bot
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{ border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 2 }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Bot ID</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Criado em</strong></TableCell>
                <TableCell><strong>Atualizado em</strong></TableCell>
                <TableCell align="right"><strong>Ações</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.disabled" }}>
                    Nenhum bot cadastrado. Clique em "Adicionar Bot" para começar.
                  </TableCell>
                </TableRow>
              ) : (
                bots.map((bot) => (
                  <TableRow key={bot.id} hover>
                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 600 }}>
                      {bot.id}
                    </TableCell>
                    <TableCell>{statusChip(bot.status)}</TableCell>
                    <TableCell>{formatDate(bot.created_at)}</TableCell>
                    <TableCell>{formatDate(bot.updated_at)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Iniciar pareamento para este bot">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => onPairBot(bot.id)}
                          sx={{ mr: 0.5 }}
                        >
                          <QrCode2Icon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remover bot">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteTarget(bot)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialog: Adicionar Bot */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Adicionar Bot</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Informe um identificador único para o novo bot. O <code>bot_id</code> é
            imutável após a criação.
          </DialogContentText>
          <TextField
            label="Bot ID"
            value={newBotId}
            onChange={(e) => setNewBotId(e.target.value)}
            fullWidth
            size="small"
            placeholder="ex: clienteA, bot-principal"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && newBotId.trim()) void handleAdd();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddOpen(false); setNewBotId(""); }} disabled={addSaving}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleAdd()}
            disabled={!newBotId.trim() || addSaving}
          >
            {addSaving ? <CircularProgress size={18} /> : "Criar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Confirmar remoção */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remover Bot</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza que deseja remover o bot{" "}
            <strong>{deleteTarget?.id}</strong>? Todas as credenciais e chaves de
            sessão associadas serão deletadas via <code>ON DELETE CASCADE</code>.
            Essa ação não pode ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            {deleting ? <CircularProgress size={18} /> : "Remover"}
          </Button>
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
