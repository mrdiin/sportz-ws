import 'dotenv/config';
import express from 'express';
import http from 'http';
import { securityMiddleware } from './arcjet.js';
import { matchRouter } from './routes/matches.js';
import { attachWebSocketServer } from './ws/server.js';

// Server configuration
const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';

// Create Express app
const app = express();
const server = http.createServer(app);

// Middleware to parse JSON bodies
app.use(express.json());

// Arcjet security middleware
app.use(securityMiddleware());

// Root GET route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Sportz API from ' + req.ip + ' !' });
});

// API routes
app.use('/api/v1/matches', matchRouter);

// WebSocket server
const { broadcastMatchCreated } = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;

// Start the server
server.listen(PORT, HOST, () => {
  const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running at ${baseUrl}`);
  console.log(`WebSocket Server is running at ${baseUrl.replace('http', 'ws')}/ws`);
});
