import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Grid,
  useTheme,
  alpha,
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import BlockIcon from "@mui/icons-material/Block";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import TerminalIcon from "@mui/icons-material/Terminal";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import { supabase } from "../lib/supabase";
import type { User, UserCommand } from "../types/database";

interface KPI {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

interface CommandCount {
  command: string;
  count: number;
}

interface DailyActivity {
  date: string;
  commands: number;
}

interface UserStatusData {
  name: string;
  value: number;
}

interface TopUser {
  name: string;
  commands: number;
}

const PIE_COLORS = ["#4caf50", "#f44336", "#ff9800", "#2196f3"];

export default function DashboardPage() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [commands, setCommands] = useState<UserCommand[]>([]);

  const [kpis, setKpis] = useState<KPI[]>([]);
  const [topCommands, setTopCommands] = useState<CommandCount[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [userStatus, setUserStatus] = useState<UserStatusData[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [newUsersPerDay, setNewUsersPerDay] = useState<{ date: string; users: number }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [usersRes, commandsRes] = await Promise.all([
        supabase.from("users").select("*"),
        supabase.from("user_commands").select("*").order("used_at", { ascending: false }).limit(5000),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (commandsRes.error) throw commandsRes.error;

      const usersData = (usersRes.data ?? []) as User[];
      const commandsData = (commandsRes.data ?? []) as UserCommand[];

      setUsers(usersData);
      setCommands(commandsData);
      processData(usersData, commandsData);
    } catch (err: any) {
      setError(err.message ?? "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  function processData(usersData: User[], commandsData: UserCommand[]) {
    // --- KPIs ---
    const totalUsers = usersData.length;
    const bannedUsers = usersData.filter((u) => u.is_banned).length;
    const adminUsers = usersData.filter((u) => u.is_admin).length;
    const totalCommands = commandsData.length;

    const today = new Date().toISOString().slice(0, 10);
    const activeToday = usersData.filter((u) => u.last_command_at?.slice(0, 10) === today).length;
    const newToday = usersData.filter((u) => u.first_seen_at?.slice(0, 10) === today).length;

    setKpis([
      { label: "Total Usuários", value: totalUsers, icon: <PeopleIcon />, color: "#2196f3" },
      { label: "Ativos Hoje", value: activeToday, icon: <TrendingUpIcon />, color: "#4caf50" },
      { label: "Novos Hoje", value: newToday, icon: <PersonAddIcon />, color: "#00bcd4" },
      { label: "Admins", value: adminUsers, icon: <AdminPanelSettingsIcon />, color: "#ff9800" },
      { label: "Banidos", value: bannedUsers, icon: <BlockIcon />, color: "#f44336" },
      { label: "Total Comandos", value: totalCommands.toLocaleString("pt-BR"), icon: <TerminalIcon />, color: "#9c27b0" },
    ]);

    // --- Top 10 Commands ---
    const cmdMap = new Map<string, number>();
    commandsData.forEach((c) => {
      cmdMap.set(c.command, (cmdMap.get(c.command) ?? 0) + 1);
    });
    const sortedCmds = [...cmdMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([command, count]) => ({ command, count }));
    setTopCommands(sortedCmds);

    // --- Daily Activity (last 30 days) ---
    const last30 = new Map<string, number>();
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      last30.set(d.toISOString().slice(0, 10), 0);
    }
    commandsData.forEach((c) => {
      const day = c.used_at.slice(0, 10);
      if (last30.has(day)) {
        last30.set(day, last30.get(day)! + 1);
      }
    });
    setDailyActivity(
      [...last30.entries()].map(([date, commands]) => ({
        date: date.slice(5), // MM-DD
        commands,
      }))
    );

    // --- User Status Pie ---
    const active = usersData.filter(
      (u) => !u.is_banned && !u.muted_until && u.is_admin === false
    ).length;
    const muted = usersData.filter(
      (u) => u.muted_until && new Date(u.muted_until) > new Date()
    ).length;
    setUserStatus([
      { name: "Ativos", value: active },
      { name: "Banidos", value: bannedUsers },
      { name: "Mutados", value: muted },
      { name: "Admins", value: adminUsers },
    ].filter((s) => s.value > 0));

    // --- Top 10 Users by command_count ---
    const sorted = [...usersData]
      .sort((a, b) => b.command_count - a.command_count)
      .slice(0, 10);
    setTopUsers(
      sorted.map((u) => ({
        name: u.push_name || u.lid.slice(0, 8) + "…",
        commands: u.command_count,
      }))
    );

    // --- New Users per Day (last 30 days) ---
    const newMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      newMap.set(d.toISOString().slice(0, 10), 0);
    }
    usersData.forEach((u) => {
      if (u.first_seen_at) {
        const day = u.first_seen_at.slice(0, 10);
        if (newMap.has(day)) {
          newMap.set(day, newMap.get(day)! + 1);
        }
      }
    });
    setNewUsersPerDay(
      [...newMap.entries()].map(([date, users]) => ({
        date: date.slice(5),
        users,
      }))
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Erro ao carregar dashboard: {error}</Alert>;
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        Dashboard
      </Typography>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {kpis.map((kpi) => (
          <Grid size={{ xs: 6, sm: 4, md: 2 }} key={kpi.label}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 3,
                border: `1px solid ${alpha(kpi.color, 0.2)}`,
                background: `linear-gradient(135deg, ${alpha(kpi.color, 0.06)} 0%, ${alpha(kpi.color, 0.02)} 100%)`,
                transition: "transform 0.2s, box-shadow 0.2s",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: `0 4px 20px ${alpha(kpi.color, 0.15)}`,
                },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                <Box
                  sx={{
                    color: kpi.color,
                    display: "flex",
                    alignItems: "center",
                    fontSize: 28,
                  }}
                >
                  {kpi.icon}
                </Box>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: kpi.color }}>
                {kpi.value}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {kpi.label}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Row 1: Activity + Status */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3, borderRadius: 3, height: 370 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Atividade Diária (últimos 30 dias)
            </Typography>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dailyActivity}>
                <defs>
                  <linearGradient id="colorCmds" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.1)} />
                <XAxis dataKey="date" fontSize={12} tick={{ fill: theme.palette.text.secondary }} />
                <YAxis fontSize={12} tick={{ fill: theme.palette.text.secondary }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 8,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="commands"
                  name="Comandos"
                  stroke={theme.palette.primary.main}
                  fillOpacity={1}
                  fill="url(#colorCmds)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, borderRadius: 3, height: 370 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Status dos Usuários
            </Typography>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={userStatus}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {userStatus.map((_entry, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Row 2: Top Commands + Top Users */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 3, height: 400 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Top 10 Comandos Mais Usados
            </Typography>
            <ResponsiveContainer width="100%" height={310}>
              <BarChart data={topCommands} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.1)} />
                <XAxis type="number" fontSize={12} tick={{ fill: theme.palette.text.secondary }} allowDecimals={false} />
                <YAxis
                  dataKey="command"
                  type="category"
                  fontSize={12}
                  tick={{ fill: theme.palette.text.secondary }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 8,
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Execuções"
                  fill={theme.palette.secondary.main}
                  radius={[0, 6, 6, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 3, height: 400 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Top 10 Usuários (por comandos)
            </Typography>
            <ResponsiveContainer width="100%" height={310}>
              <BarChart data={topUsers} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.1)} />
                <XAxis type="number" fontSize={12} tick={{ fill: theme.palette.text.secondary }} allowDecimals={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  fontSize={12}
                  tick={{ fill: theme.palette.text.secondary }}
                  width={90}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 8,
                  }}
                />
                <Bar
                  dataKey="commands"
                  name="Comandos"
                  fill="#00bcd4"
                  radius={[0, 6, 6, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Row 3: New Users Over Time */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 3, borderRadius: 3, height: 350 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Novos Usuários por Dia (últimos 30 dias)
            </Typography>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={newUsersPerDay}>
                <defs>
                  <linearGradient id="colorNewUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4caf50" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4caf50" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.1)} />
                <XAxis dataKey="date" fontSize={12} tick={{ fill: theme.palette.text.secondary }} />
                <YAxis fontSize={12} tick={{ fill: theme.palette.text.secondary }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 8,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  name="Novos Usuários"
                  stroke="#4caf50"
                  fillOpacity={1}
                  fill="url(#colorNewUsers)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
