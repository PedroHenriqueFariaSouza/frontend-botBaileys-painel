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
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { supabase } from "../lib/supabase";
import type { User } from "../types/database";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
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
    fetchUsers();
  }, []);

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
      <Typography variant="h5" sx={{ mb: 2 }}>
        Usuários ({filtered.length})
      </Typography>

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
                <TableCell align="right">{user.daily_command_count}</TableCell>
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
                <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
