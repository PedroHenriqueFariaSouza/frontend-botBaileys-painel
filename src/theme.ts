import { alpha, createTheme } from "@mui/material/styles";
import type { PaletteMode } from "@mui/material";

export type AppThemeMode = PaletteMode;

export const THEME_MODE_STORAGE_KEY = "bot-painel-theme-mode";

export function createAppTheme(mode: AppThemeMode) {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? "#36c2ff" : "#1976d2",
        contrastText: isDark ? "#041018" : "#ffffff",
      },
      secondary: {
        main: isDark ? "#20d19b" : "#9c27b0",
      },
      background: {
        default: isDark ? "#000000" : "#f7f9fc",
        paper: isDark ? "#0b0b0b" : "#ffffff",
      },
      text: {
        primary: isDark ? "#f5f5f5" : "#111827",
        secondary: isDark ? "#b8b8b8" : "#4b5563",
      },
      divider: isDark ? alpha("#ffffff", 0.14) : alpha("#0f172a", 0.12),
    },
    shape: {
      borderRadius: 10,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isDark ? "#000000" : "#f7f9fc",
            backgroundImage: isDark
              ? "radial-gradient(circle at 10% -20%, rgba(54,194,255,0.14), transparent 28%), radial-gradient(circle at 90% -10%, rgba(32,209,155,0.12), transparent 24%)"
              : "radial-gradient(circle at 10% -20%, rgba(25,118,210,0.12), transparent 28%), radial-gradient(circle at 90% -10%, rgba(156,39,176,0.1), transparent 24%)",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: "none",
            backgroundColor: isDark ? "#050505" : "#ffffff",
            borderRight: `1px solid ${isDark ? alpha("#ffffff", 0.12) : alpha("#0f172a", 0.12)}`,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            borderColor: isDark ? alpha("#ffffff", 0.1) : alpha("#0f172a", 0.08),
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            marginInline: 8,
            "&.Mui-selected": {
              backgroundColor: isDark ? alpha("#36c2ff", 0.18) : alpha("#1976d2", 0.14),
            },
            "&.Mui-selected:hover": {
              backgroundColor: isDark ? alpha("#36c2ff", 0.24) : alpha("#1976d2", 0.2),
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          outlined: {
            borderColor: isDark ? alpha("#ffffff", 0.32) : alpha("#0f172a", 0.28),
          },
        },
      },
    },
  });
}
