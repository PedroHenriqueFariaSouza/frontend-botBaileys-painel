import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Dispara o magic link via Supabase Auth OTP — sem senha, link expira em 1h
  async function handleMagicLink() {
    const cleanEmail = email.trim();
    if (!cleanEmail) return;

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        // Redireciona de volta para este painel após o clique no link do email
        emailRedirectTo: window.location.origin,
      },
    });

    setSubmitting(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setSuccessMsg(
      "Link mágico enviado. Abra o email e confirme o acesso para entrar no painel."
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 420,
          p: 3,
          border: (theme) => `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
        }}
      >
        <Typography variant="h5" fontWeight={700} mb={1}>
          Acesso ao Painel
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Entre com magic link para acessar áreas administrativas de bots.
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@empresa.com"
            fullWidth
            size="small"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && email.trim()) {
                void handleMagicLink();
              }
            }}
          />

          <Button
            variant="contained"
            onClick={() => void handleMagicLink()}
            disabled={!email.trim() || submitting}
          >
            {submitting ? <CircularProgress size={20} /> : "Entrar com Magic Link"}
          </Button>

          {errorMsg && <Alert severity="error">{errorMsg}</Alert>}
          {successMsg && <Alert severity="success">{successMsg}</Alert>}
        </Box>
      </Paper>
    </Box>
  );
}
