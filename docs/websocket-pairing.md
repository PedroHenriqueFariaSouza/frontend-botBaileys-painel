# WebSocket de Pareamento

## Papel no projeto

O WebSocket conecta o frontend ao servidor de pareamento do bot para entregar QR Codes e status em tempo real durante o vinculo de dispositivo.

## Onde aparece no codigo

- src/pages/PairingPage.tsx

## Importancia pratica

- Evita polling para obter QR atualizado
- Garante feedback imediato de sucesso e erro
- Permite reconexao automatica quando ha falhas de rede

## Fluxo resumido

1. Usuario informa token e opcionalmente bot_id.
2. Frontend abre WebSocket no endpoint configurado.
3. Primeira mensagem enviada: auth com token e bot_id quando informado.
4. Servidor responde com eventos de qr, success ou error.
5. Frontend exibe QR e estado da conexao para o operador.

## Cuidados de seguranca

- Token enviado em mensagem, nao em query string
- Em producao, preferir sempre wss
- Bloquear mixed content quando pagina esta em https e ws inseguro
