import { useEffect, useState } from "react";
import { Box, Button, CircularProgress } from "@mui/material";
import type { Session } from "@supabase/supabase-js";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import CommandsPage from "./pages/CommandsPage";
import GroupsPage from "./pages/GroupsPage";
import PairingPage from "./pages/PairingPage";
import BotsPage from "./pages/BotsPage";
import LoginPage from "./pages/LoginPage.tsx";
import { supabase } from "./lib/supabase";
import type { AppThemeMode } from "./theme";

interface AppProps {
  themeMode: AppThemeMode;
  onToggleThemeMode: () => void;
}

function App({ themeMode, onToggleThemeMode }: AppProps) {
  const [session, setSession] = useState<Session | null>(null);
  // true enquanto a sessão ainda não foi verificada — evita piscar a tela de login
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Propagado para PairingPage quando o usuário clica em "Parear" em BotsPage
  const [selectedBotId, setSelectedBotId] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Guard para evitar setState em componente desmontado durante leitura assíncrona
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setCheckingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setCheckingAuth(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function handleNavigate(p: string) {
    // Limpa o bot selecionado ao sair da tela de pareamento via sidebar
    if (p !== "pairing") setSelectedBotId(undefined);
    setPage(p);
  }

  // Chamado por BotsPage ao clicar em "Parear": pré-preenche o bot_id na PairingPage
  function handlePairBot(botId: string) {
    setSelectedBotId(botId);
    setPage("pairing");
  }

  function renderPage() {
    switch (page) {
      case "dashboard":
        return <DashboardPage />;
      case "commands":
        return <CommandsPage />;
      case "groups":
        return <GroupsPage />;
      case "pairing":
        return <PairingPage botId={selectedBotId} />;
      case "bots":
        return <BotsPage onPairBot={handlePairBot} />;
      default:
        return <UsersPage />;
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSelectedBotId(undefined);
    setPage("dashboard");
  }

  if (checkingAuth) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <Box sx={{ display: "flex", bgcolor: "background.default", color: "text.primary" }}>
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        currentPage={page}
        onNavigate={handleNavigate}
        themeMode={themeMode}
        onToggleThemeMode={onToggleThemeMode}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          transition: "padding 300ms cubic-bezier(0.4, 0, 0.2, 1)",
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
          <Button variant="outlined" size="small" onClick={() => void handleLogout()}>
            Sair
          </Button>
        </Box>
        {renderPage()}
      </Box>
    </Box>
  );
}

export default App;
