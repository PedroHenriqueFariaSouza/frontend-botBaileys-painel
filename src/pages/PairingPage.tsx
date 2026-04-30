import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
  useTheme,
  alpha,
} from "@mui/material";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WifiOffIcon from "@mui/icons-material/WifiOff";

type WsStatus =
  | "idle"
  | "connecting"
  | "waiting_qr"
  | "qr_received"
  | "success"
  | "error"
  | "reconnecting";

interface WsMessage {
  type: "qr" | "success" | "error";
  payload?: string;
  message?: string;
}

const MAX_RETRIES = 5;
const RECONNECT_DELAY_MS = 2500;

export default function PairingPage() {
  const theme = useTheme();

  const [token, setToken] = useState("");
  const [wsUrl, setWsUrl] = useState(
    import.meta.env.VITE_PAIR_WS_URL ?? "ws://localhost:3000/pair/ws"
  );
  const [status, setStatus] = useState<WsStatus>("idle");
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const activeRef = useRef(false);

  const clearRetryTimer = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(
    (currentToken: string, currentWsUrl: string) => {
      closeWs();
      setStatus("connecting");
      setQrBase64(null);

      const url = `${currentWsUrl}?token=${encodeURIComponent(currentToken)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        retryCountRef.current = 0;
        setRetryCount(0);
        setStatus("waiting_qr");
      };

      ws.onmessage = (event: MessageEvent) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(event.data as string) as WsMessage;
        } catch {
          return;
        }

        if (msg.type === "qr") {
          setQrBase64(msg.payload ?? null);
          setStatus("qr_received");
        } else if (msg.type === "success") {
          setStatus("success");
          activeRef.current = false;
          closeWs();
        } else if (msg.type === "error") {
          setErrorMsg(msg.message ?? "Erro desconhecido durante o pareamento.");
          setStatus("error");
          activeRef.current = false;
          closeWs();
        }
      };

      ws.onclose = () => {
        if (!activeRef.current) return;
        const nextRetry = retryCountRef.current + 1;
        if (nextRetry > MAX_RETRIES) {
          setErrorMsg(
            `Conexão perdida após ${MAX_RETRIES} tentativas. Verifique o servidor.`
          );
          setStatus("error");
          activeRef.current = false;
          return;
        }
        retryCountRef.current = nextRetry;
        setRetryCount(nextRetry);
        setQrBase64(null);
        setStatus("reconnecting");
        retryTimerRef.current = setTimeout(() => {
          if (activeRef.current) {
            connect(currentToken, currentWsUrl);
          }
        }, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        // onclose dispara logo após, que cuida da lógica de retry
      };
    },
    [closeWs]
  );

  const handleStart = () => {
    if (!token.trim()) return;
    setErrorMsg(null);
    retryCountRef.current = 0;
    setRetryCount(0);
    activeRef.current = true;
    connect(token, wsUrl);
  };

  const handleStop = () => {
    activeRef.current = false;
    clearRetryTimer();
    closeWs();
    setStatus("idle");
    setQrBase64(null);
    setErrorMsg(null);
    setRetryCount(0);
    retryCountRef.current = 0;
  };

  const handleRetry = () => {
    setErrorMsg(null);
    retryCountRef.current = 0;
    setRetryCount(0);
    activeRef.current = true;
    connect(token, wsUrl);
  };

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      activeRef.current = false;
      clearRetryTimer();
      closeWs();
    };
  }, [closeWs]);

  const isConnecting =
    status === "connecting" ||
    status === "waiting_qr" ||
    status === "reconnecting";

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={0.5}>
        Pareamento do Bot
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Escaneie o QR Code com o WhatsApp para parear uma instância do bot.
      </Typography>

      {/* Formulário de configuração */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
        }}
      >
        <Typography variant="subtitle1" fontWeight={600} mb={2}>
          Configuração
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="URL do WebSocket"
            value={wsUrl}
            onChange={(e) => setWsUrl(e.target.value)}
            disabled={isConnecting || status === "success"}
            placeholder="ws://localhost:3000/pair/ws"
            fullWidth
            size="small"
            helperText="Ex: ws://seu-servidor:3000/pair/ws"
          />
          <TextField
            label="Token de Acesso"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={isConnecting || status === "success"}
            type="password"
            placeholder="Digite o PAIR_TOKEN configurado no bot"
            fullWidth
            size="small"
            onKeyDown={(e) => {
              if (e.key === "Enter" && token.trim() && status === "idle") {
                handleStart();
              }
            }}
          />
          <Box sx={{ display: "flex", gap: 1 }}>
            {status === "idle" || status === "error" ? (
              <Button
                variant="contained"
                startIcon={<QrCode2Icon />}
                onClick={status === "error" ? handleRetry : handleStart}
                disabled={!token.trim()}
              >
                {status === "error" ? "Tentar Novamente" : "Iniciar Pareamento"}
              </Button>
            ) : status === "success" ? (
              <Button variant="outlined" onClick={handleStop}>
                Novo Pareamento
              </Button>
            ) : (
              <Button variant="outlined" color="error" onClick={handleStop}>
                Cancelar
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Painel de status / QR Code */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
          minHeight: 320,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        {/* IDLE */}
        {status === "idle" && (
          <Box sx={{ textAlign: "center", color: "text.disabled" }}>
            <QrCode2Icon sx={{ fontSize: 64, mb: 1 }} />
            <Typography variant="body2">
              Preencha o token e clique em "Iniciar Pareamento".
            </Typography>
          </Box>
        )}

        {/* CONNECTING */}
        {status === "connecting" && (
          <Box sx={{ textAlign: "center" }}>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Conectando ao servidor…
            </Typography>
          </Box>
        )}

        {/* WAITING_QR */}
        {status === "waiting_qr" && (
          <Box sx={{ textAlign: "center" }}>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Aguardando QR Code…
            </Typography>
          </Box>
        )}

        {/* RECONNECTING */}
        {status === "reconnecting" && (
          <Box sx={{ textAlign: "center" }}>
            <WifiOffIcon sx={{ fontSize: 48, mb: 1, color: "warning.main" }} />
            <Typography variant="body1" fontWeight={600} color="warning.main">
              Reconectando…
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Tentativa {retryCount} de {MAX_RETRIES}
            </Typography>
          </Box>
        )}

        {/* QR_RECEIVED */}
        {status === "qr_received" && qrBase64 && (
          <Box sx={{ textAlign: "center" }}>
            <Box
              sx={{
                display: "inline-block",
                p: 1.5,
                borderRadius: 2,
                bgcolor: "#fff",
                boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.15)}`,
              }}
            >
              <img
                src={`data:image/png;base64,${qrBase64}`}
                alt="QR Code de pareamento"
                style={{ display: "block", width: 280, height: 280 }}
              />
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              mt={2}
              sx={{ maxWidth: 320 }}
            >
              Abra o WhatsApp → Configurações → Dispositivos Vinculados → Vincular
              dispositivo, e escaneie o código acima.
            </Typography>
            <Typography variant="caption" color="text.disabled" mt={0.5}>
              O QR expira em ~20 segundos. Um novo será gerado automaticamente.
            </Typography>
          </Box>
        )}

        {/* SUCCESS */}
        {status === "success" && (
          <Box sx={{ textAlign: "center" }}>
            <CheckCircleOutlineIcon
              sx={{ fontSize: 64, color: "success.main", mb: 1 }}
            />
            <Typography variant="h6" fontWeight={700} color="success.main">
              Bot pareado com sucesso!
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={1}>
              Aguarde a inicialização do bot. Ele assumirá a sessão em breve.
            </Typography>
          </Box>
        )}

        {/* ERROR */}
        {status === "error" && errorMsg && (
          <Box sx={{ textAlign: "center", width: "100%", maxWidth: 480 }}>
            <ErrorOutlineIcon
              sx={{ fontSize: 56, color: "error.main", mb: 1 }}
            />
            <Alert severity="error" sx={{ textAlign: "left", mb: 2 }}>
              {errorMsg}
            </Alert>
            <Button
              variant="contained"
              color="error"
              startIcon={<QrCode2Icon />}
              onClick={handleRetry}
              disabled={!token.trim()}
            >
              Tentar Novamente
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
