import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Box,
  Divider,
  Typography,
  Switch,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import TerminalIcon from "@mui/icons-material/Terminal";
import GroupsIcon from "@mui/icons-material/Groups";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import BadgeIcon from "@mui/icons-material/Badge";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import type { AppThemeMode } from "../theme";

// Largura fixa do menu lateral em pixels — usada também em App.tsx para o offset do conteúdo
const DRAWER_WIDTH = 260;

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
  themeMode: AppThemeMode;
  onToggleThemeMode: () => void;
}

// Itens de navegação — a propriedade `key` deve coincidir com os cases em App.renderPage()
const menuItems = [
  { key: "dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { key: "users", label: "Usuários", icon: <PeopleIcon /> },
  { key: "commands", label: "Comandos", icon: <TerminalIcon /> },
  { key: "groups", label: "Grupos Permitidos", icon: <GroupsIcon /> },
  { key: "pairing", label: "Pareamento", icon: <QrCode2Icon /> },
  { key: "bots", label: "Gerenciar Bots", icon: <SmartToyIcon /> },
  { key: "roles", label: "Papéis", icon: <BadgeIcon /> },
];

// Transição suave ao abrir/fechar o menu — sincronizada com o padding do conteúdo em App.tsx
const TRANSITION = "width 300ms cubic-bezier(0.4, 0, 0.2, 1), margin 300ms cubic-bezier(0.4, 0, 0.2, 1)";

export default function Sidebar({
  open,
  onToggle,
  currentPage,
  onNavigate,
  themeMode,
  onToggleThemeMode,
}: SidebarProps) {
  return (
    <>
      {/* Aba na borda esquerda para abrir o menu */}
      {!open && (
        <Box
          onClick={onToggle}
          sx={{
            position: "fixed",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 1300,
            width: 20,
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "primary.main",
            color: "primary.contrastText",
            borderRadius: "0 8px 8px 0",
            cursor: "pointer",
            boxShadow: 3,
            transition: "width 200ms ease, opacity 200ms ease",
            "&:hover": {
              width: 28,
              opacity: 0.9,
            },
          }}
        >
          <ChevronRightIcon fontSize="small" />
        </Box>
      )}

      <Drawer
        variant="persistent"
        anchor="left"
        open={open}
        sx={{
          width: open ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          transition: TRANSITION,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 2,
          }}
        >
          <Typography variant="h6" noWrap>
            Bot Painel
          </Typography>
          <IconButton onClick={onToggle}>
            <ChevronLeftIcon />
          </IconButton>
        </Box>

        <Divider />

        <List>
          {menuItems.map((item) => (
            <ListItemButton
              key={item.key}
              selected={currentPage === item.key}
              onClick={() => onNavigate(item.key)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>

        <Box sx={{ mt: "auto" }}>
          <Divider sx={{ mb: 1 }} />
          <List>
            <ListItemButton onClick={onToggleThemeMode}>
              <ListItemIcon>{themeMode === "dark" ? <DarkModeIcon /> : <LightModeIcon />}</ListItemIcon>
              <ListItemText
                primary={themeMode === "dark" ? "Modo Escuro" : "Modo Claro"}
                secondary="Alternar tema"
              />
              <Switch
                edge="end"
                checked={themeMode === "dark"}
                onClick={(event) => event.stopPropagation()}
                onChange={(_event) => onToggleThemeMode()}
                inputProps={{ "aria-label": "alternar modo escuro" }}
              />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>
    </>
  );
}

export { DRAWER_WIDTH };
