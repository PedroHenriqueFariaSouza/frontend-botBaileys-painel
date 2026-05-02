import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { createAppTheme, THEME_MODE_STORAGE_KEY } from "./theme";
import App from "./App";

function getInitialThemeMode(): "light" | "dark" {
  const savedMode = localStorage.getItem(THEME_MODE_STORAGE_KEY);
  if (savedMode === "light" || savedMode === "dark") {
    return savedMode;
  }
  return "dark";
}

function Root() {
  const [themeMode, setThemeMode] = useState<"light" | "dark">(getInitialThemeMode);

  const theme = useMemo(() => createAppTheme(themeMode), [themeMode]);

  const handleToggleThemeMode = () => {
    setThemeMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_MODE_STORAGE_KEY, next);
      return next;
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App themeMode={themeMode} onToggleThemeMode={handleToggleThemeMode} />
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
