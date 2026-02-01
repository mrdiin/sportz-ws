import { WebSocket, WebSocketServer } from 'ws';
import { wsArcjet } from '../arcjet.js';

const matchSubscribers = new Map();

function subscribeToMatch(matchId, socket) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }
  matchSubscribers.get(matchId).add(socket);
}

function unsubscribeFromMatch(matchId, socket) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers) {
    return;
  }
  subscribers.delete(socket);
  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  }
}

function cleanupSubscriptions(socket) {
  for (const matchId of socket.subscriptions) {
    unsubscribeFromMatch(matchId, socket);
  }
}

function broadcastToMatch(matchId, payload) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers || subscribers.size === 0) {
    return;
  }
  subscribers.forEach((socket) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
  });
}

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload) {
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    client.send(JSON.stringify(payload));
  });
}

function handleMessage(socket, data) {
  let message;
  try {
    message = JSON.parse(data.toString());
  } catch (e) {
    sendJson(socket, { type: 'error', data: 'Invalid JSON' });
    return;
  }

  const matchId = message?.matchId !== undefined ? parseInt(message.matchId, 10) : null;

  if (message?.type === 'subscribe') {
    if (isNaN(matchId)) {
      sendJson(socket, { type: 'error', data: 'Invalid matchId' });
      return;
    }
    subscribeToMatch(matchId, socket);
    socket.subscriptions.add(matchId);
    sendJson(socket, { type: 'subscribed', matchId });
  }

  if (message?.type === 'unsubscribe') {
    if (isNaN(matchId)) {
      sendJson(socket, { type: 'error', data: 'Invalid matchId' });
      return;
    }
    unsubscribeFromMatch(matchId, socket);
    socket.subscriptions.delete(matchId);
    sendJson(socket, { type: 'unsubscribed', matchId });
  }
}

export function attachWebSocketServer(server) {
  const wss = new WebSocketServer({ noServer: true, path: '/ws', maxPayload: 1024 * 1024 });

  server.on('upgrade', async (req, socket, head) => {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);

    if (pathname !== '/ws') {
      return;
    }

    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);

        if (decision.isDenied()) {
          if (decision.reason.isRateLimit()) {
            socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
          } else {
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          }
          socket.destroy();
          return;
        }
      } catch (e) {
        console.error('WS upgrade protection error', e);
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', async (socket, req) => {
    socket.isAlive = true;
    socket.on('pong', () => {
      socket.isAlive = true;
    });

    socket.subscriptions = new Set();

    sendJson(socket, { type: 'welcome' });

    socket.on('message', (data) => {
      handleMessage(socket, data);
    });

    socket.on('error', () => {
      socket.terminate();
    });

    socket.on('close', () => {
      cleanupSubscriptions(socket);
    });

    socket.on('error', console.error);
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  function broadcastMatchCreated(match) {
    broadcastToAll(wss, { type: 'match_created', data: match });
  }

  function broadcastCommentary(matchId, comment) {
    broadcastToMatch(matchId, { type: 'commentary', data: comment });
  }

  return { broadcastMatchCreated, broadcastCommentary };
}
