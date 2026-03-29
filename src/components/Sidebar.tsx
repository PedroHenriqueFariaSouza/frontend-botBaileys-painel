import { useState } from "react";
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
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import PeopleIcon from "@mui/icons-material/People";
import TerminalIcon from "@mui/icons-material/Terminal";
import GroupsIcon from "@mui/icons-material/Groups";

const DRAWER_WIDTH = 260;

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const menuItems = [
  { key: "users", label: "Usuários", icon: <PeopleIcon /> },
  { key: "commands", label: "Comandos", icon: <TerminalIcon /> },
  { key: "groups", label: "Grupos Permitidos", icon: <GroupsIcon /> },
];

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const [open, setOpen] = useState(true);

  return (
    <>
      {/* Botão flutuante para abrir quando fechado */}
      {!open && (
        <IconButton
          onClick={() => setOpen(true)}
          sx={{ position: "fixed", top: 16, left: 16, zIndex: 1300 }}
        >
          <MenuIcon />
        </IconButton>
      )}

      <Drawer
        variant="persistent"
        anchor="left"
        open={open}
        sx={{
          width: open ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
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
          <IconButton onClick={() => setOpen(false)}>
            <MenuIcon />
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
      </Drawer>
    </>
  );
}

export { DRAWER_WIDTH };
