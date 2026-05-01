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
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
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
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import PeopleIcon from "@mui/icons-material/People";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import { supabase } from "../lib/supabase";
import { formatUiErrorMessage } from "../lib/uiError.ts";
import type { Bot, User } from "../types/database";

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

  // Guarda o bot selecionado para pausar/reativar; null = dialog fechado
  const [toggleTarget, setToggleTarget] = useState<Bot | null>(null);
  // Indica que a requisição de toggle está em andamento (desabilita botões)
  const [toggling, setToggling] = useState(false);

  // Estado do Drawer lateral que exibe os usuários vinculados ao bot escolhido
  const [usersDrawer, setUsersDrawer] = useState<{
    open: boolean;
    botId: string | null;   // bot_id exibido no cabeçalho do Drawer
    users: User[];          // lista carregada do Supabase
    loading: boolean;       // spinner enquanto a query está em voo
  }>({ open: false, botId: null, users: [], loading: false });

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
      setError(formatUiErrorMessage("carregar os bots", error.message));
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
      .insert({ id, name: id, status: "disconnected" });
    setAddSaving(false);
    if (error) {
      setSnackbar({ open: true, message: formatUiErrorMessage("criar o bot", error.message), severity: "error" });
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
      setSnackbar({ open: true, message: formatUiErrorMessage("remover o bot", error.message), severity: "error" });
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

  async function handleToggleActive() {
    if (!toggleTarget) return;
    setToggling(true);

    // Inverte o valor atual: se is_active for null/undefined tratamos como true (ativo)
    const newActive = !(toggleTarget.is_active ?? true);

    // Persiste a mudança no campo is_active da tabela bots
    // O BotManager do núcleo lê esse campo para decidir se sobe ou encerra o socket
    const { error } = await supabase
      .from("bots")
      .update({ is_active: newActive })
      .eq("id", toggleTarget.id);
    setToggling(false);
    if (error) {
      setSnackbar({ open: true, message: formatUiErrorMessage("alterar o status do bot", error.message), severity: "error" });
    } else {
      setBots((currentBots) =>
        currentBots.map((bot) =>
          bot.id === toggleTarget.id ? { ...bot, is_active: newActive } : bot
        )
      );
      setSnackbar({
        open: true,
        message: `Bot "${toggleTarget.id}" ${newActive ? "reativado" : "pausado"}.`,
        severity: "success",
      });
    }
    setToggleTarget(null);
    // Recarrega a lista para refletir o novo valor na coluna "Ativo"
    void fetchBots();
  }

  async function handleViewUsers(botId: string) {
    // Abre o Drawer imediatamente com spinner enquanto a query vai ao Supabase
    setUsersDrawer({ open: true, botId, users: [], loading: true });

    // Busca apenas os usuários (consumers) escopados ao bot selecionado
    // Isso garante o isolamento visual por bot_id (roadmap 5.1)
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("bot_id", botId)
      .order("first_seen_at", { ascending: false });
    if (error) {
      setUsersDrawer((prev) => ({ ...prev, loading: false }));
      setSnackbar({ open: true, message: formatUiErrorMessage("carregar os usuários do bot", error.message), severity: "error" });
      return;
    }
    // Substitui o spinner pela lista de usuários retornada
    setUsersDrawer((prev) => ({ ...prev, users: (data as User[]) ?? [], loading: false }));
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
                <TableCell><strong>Ações</strong></TableCell>
                <TableCell><strong>Bot ID</strong></TableCell>
                <TableCell><strong>Ativo</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Criado em</strong></TableCell>
                <TableCell><strong>Atualizado em</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.disabled" }}>
                    Nenhum bot cadastrado. Clique em "Adicionar Bot" para começar.
                  </TableCell>
                </TableRow>
              ) : (
                bots.map((bot) => (
                  <TableRow key={bot.id} hover>
                    <TableCell>
                      {/* Abre o Drawer lateral com os consumers (users) deste bot */}
                      <Tooltip title="Ver usuários vinculados">
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => void handleViewUsers(bot.id)}
                          sx={{ mr: 0.5 }}
                        >
                          <PeopleIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
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
                      {/* Pausa (is_active=false) ou reativa (is_active=true) o bot sem deletá-lo */}
                      <Tooltip title={bot.is_active === false ? "Reativar bot" : "Pausar bot"}>
                        <IconButton
                          size="small"
                          color={bot.is_active === false ? "success" : "warning"}
                          onClick={() => setToggleTarget(bot)}
                          sx={{ mr: 0.5 }}
                        >
                          {bot.is_active === false ? (
                            <PlayCircleIcon fontSize="small" />
                          ) : (
                            <PauseCircleIcon fontSize="small" />
                          )}
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
                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 600 }}>
                      {bot.id}
                    </TableCell>
                    {/* Coluna is_active: mostra se o BotManager deve ou não subir o socket deste bot */}
                    <TableCell>
                      {bot.is_active === false ? (
                        <Chip label="Pausado" color="default" size="small" />
                      ) : (
                        <Chip label="Ativo" color="success" size="small" />
                      )}
                    </TableCell>
                    <TableCell>{statusChip(bot.status)}</TableCell>
                    <TableCell>{formatDate(bot.created_at)}</TableCell>
                    <TableCell>{formatDate(bot.updated_at)}</TableCell>
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

      {/* Dialog de confirmação antes de alterar is_active — evita cliques acidentais */}
      <Dialog open={!!toggleTarget} onClose={() => setToggleTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {toggleTarget?.is_active === false ? "Reativar Bot" : "Pausar Bot"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {toggleTarget?.is_active === false
              ? `Reativar o bot "${toggleTarget?.id}"? O BotManager poderá carregar suas credenciais e subir o socket novamente.`
              : `Pausar o bot "${toggleTarget?.id}"? O bot deixará de aceitar novos sockets até ser reativado. As credenciais serão mantidas.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToggleTarget(null)} disabled={toggling}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color={toggleTarget?.is_active === false ? "success" : "warning"}
            onClick={() => void handleToggleActive()}
            disabled={toggling}
          >
            {toggling ? (
              <CircularProgress size={18} />
            ) : toggleTarget?.is_active === false ? (
              "Reativar"
            ) : (
              "Pausar"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Drawer lateral: lista os consumers (tabela users) escopados ao bot selecionado */}
      <Drawer
        anchor="right"
        open={usersDrawer.open}
        onClose={() => setUsersDrawer((prev) => ({ ...prev, open: false }))}
        PaperProps={{ sx: { width: 420, p: 3 } }}
      >
        <Typography variant="h6" fontWeight={700} mb={0.5}>
          Usuários vinculados
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Bot: <strong>{usersDrawer.botId}</strong>
        </Typography>
        <Divider sx={{ mb: 2 }} />
        {usersDrawer.loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : usersDrawer.users.length === 0 ? (
          <Typography color="text.disabled" align="center" sx={{ mt: 4 }}>
            Nenhum usuário vinculado a este bot.
          </Typography>
        ) : (
          <List disablePadding>
            {usersDrawer.users.map((u, idx) => (
              <Box key={u.lid}>
                <ListItem disablePadding sx={{ py: 1 }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {u.push_name ?? u.lid}
                        </Typography>
                        {u.is_admin && (
                          <Chip label="Admin" color="primary" size="small" />
                        )}
                        {u.is_banned && (
                          <Chip label="Banido" color="error" size="small" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                        {u.lid}
                        {u.phone_jid ? ` • ${u.phone_jid}` : ""}
                        {` • ${u.command_count} cmds`}
                      </Typography>
                    }
                  />
                </ListItem>
                {/* Separador entre itens, omitido no último para não deixar linha final solta */}
                {idx < usersDrawer.users.length - 1 && <Divider />}
              </Box>
            ))}
          </List>
        )}
      </Drawer>

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
