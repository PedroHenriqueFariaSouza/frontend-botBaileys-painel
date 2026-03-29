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
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { supabase } from "../lib/supabase";
import type { UserAllowedGroup } from "../types/database";

export default function GroupsPage() {
  const [groups, setGroups] = useState<UserAllowedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchGroups() {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_allowed_groups")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setGroups(data ?? []);
      }
      setLoading(false);
    }
    fetchGroups();
  }, []);

  const filtered = groups.filter(
    (g) => g.lid.includes(search) || g.group_id.includes(search)
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
      <Alert severity="error">Erro ao carregar grupos permitidos: {error}</Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Grupos Permitidos ({filtered.length})
      </Typography>

      <TextField
        size="small"
        placeholder="Buscar por LID ou ID do grupo..."
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
              <TableCell>ID</TableCell>
              <TableCell>LID do Usuário</TableCell>
              <TableCell>ID do Grupo</TableCell>
              <TableCell>Criado em</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((group) => (
              <TableRow key={group.id} hover>
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
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  Nenhum grupo encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
