import { useState } from "react";
import { Box } from "@mui/material";
import Sidebar, { DRAWER_WIDTH } from "./components/Sidebar";
import UsersPage from "./pages/UsersPage";
import CommandsPage from "./pages/CommandsPage";
import GroupsPage from "./pages/GroupsPage";

function App() {
  const [page, setPage] = useState("users");

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
      <Sidebar currentPage={page} onNavigate={setPage} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          ml: `${DRAWER_WIDTH}px`,
          minHeight: "100vh",
        }}
      >
        {renderPage()}
      </Box>
    </Box>
  );
}

export default App;
