import { useState } from "react";
import { Box } from "@mui/material";
import Sidebar from "./components/Sidebar";
import UsersPage from "./pages/UsersPage";
import CommandsPage from "./pages/CommandsPage";
import GroupsPage from "./pages/GroupsPage";

function App() {
  const [page, setPage] = useState("users");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  function renderPage() {
    switch (page) {
      case "commands":
        return <CommandsPage />;
      case "groups":
        return <GroupsPage />;
      default:
        return <UsersPage />;
    }
  }

  return (
    <Box sx={{ display: "flex" }}>
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        currentPage={page}
        onNavigate={setPage}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          pt: sidebarOpen ? 3 : 8,
          transition: "padding-top 300ms cubic-bezier(0.4, 0, 0.2, 1)",
          minHeight: "100vh",
        }}
      >
        {renderPage()}
      </Box>
    </Box>
  );
}

export default App;
