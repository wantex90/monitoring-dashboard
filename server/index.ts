import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase, db, closeDatabase } from '../src/lib/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize database
try {
  initDatabase();
  console.log('Database connected successfully');
} catch (error) {
  console.error('Failed to connect to database:', error);
  process.exit(1);
}

// Error handler middleware
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Auth middleware (simple token-based)
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // TODO: Implement proper JWT verification
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Servers endpoints
app.get('/api/servers', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const servers = await db.getServers();
  res.json(servers);
}));

app.get('/api/servers/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const server = await db.getServerById(req.params.id);
  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }
  res.json(server);
}));

app.post('/api/servers', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const server = await db.createServer(req.body);
  res.status(201).json(server);
}));

app.patch('/api/servers/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const server = await db.updateServer(req.params.id, req.body);
  res.json(server);
}));

app.delete('/api/servers/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  await db.deleteServer(req.params.id);
  res.status(204).send();
}));

// Metrics endpoints
app.get('/api/servers/:id/metrics', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const metrics = await db.getServerMetrics(req.params.id, limit);
  res.json(metrics);
}));

app.post('/api/metrics', asyncHandler(async (req: Request, res: Response) => {
  // Agent endpoint - verify agent token
  const agentToken = req.headers['x-agent-token'];
  if (!agentToken) {
    return res.status(401).json({ error: 'Agent token required' });
  }

  const metrics = await db.addMetrics(req.body);
  res.status(201).json(metrics);
}));

// Services endpoints
app.get('/api/servers/:id/services', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const services = await db.getServerServices(req.params.id);
  res.json(services);
}));

app.post('/api/services', asyncHandler(async (req: Request, res: Response) => {
  // Agent endpoint
  const agentToken = req.headers['x-agent-token'];
  if (!agentToken) {
    return res.status(401).json({ error: 'Agent token required' });
  }

  const service = await db.upsertService(req.body);
  res.json(service);
}));

// Commands endpoints
app.get('/api/servers/:id/commands', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const commands = await db.getServerCommands(req.params.id, limit);
  res.json(commands);
}));

app.get('/api/commands/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const command = await db.getCommandById(req.params.id);
  if (!command) {
    return res.status(404).json({ error: 'Command not found' });
  }
  res.json(command);
}));

app.post('/api/commands', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const command = await db.createCommand(req.body);
  res.status(201).json(command);
}));

app.patch('/api/commands/:id', asyncHandler(async (req: Request, res: Response) => {
  // Agent endpoint
  const agentToken = req.headers['x-agent-token'];
  if (!agentToken) {
    return res.status(401).json({ error: 'Agent token required' });
  }

  const command = await db.updateCommand(req.params.id, req.body);
  res.json(command);
}));

// Alerts endpoints
app.get('/api/alerts', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const serverId = req.query.server_id as string;
  const resolved = req.query.resolved === 'true';
  const alerts = await db.getAlerts(serverId, resolved);
  res.json(alerts);
}));

app.post('/api/alerts', asyncHandler(async (req: Request, res: Response) => {
  // Agent endpoint
  const agentToken = req.headers['x-agent-token'];
  if (!agentToken) {
    return res.status(401).json({ error: 'Agent token required' });
  }

  const alert = await db.createAlert(req.body);
  res.status(201).json(alert);
}));

app.patch('/api/alerts/:id/resolve', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const alert = await db.resolveAlert(req.params.id);
  res.json(alert);
}));

// User endpoints
app.get('/api/profile/:userId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const profile = await db.getUserProfile(req.params.userId);
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  res.json(profile);
}));

app.post('/api/profile', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const profile = await db.createUserProfile(req.body);
  res.status(201).json(profile);
}));

app.patch('/api/profile/:userId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const profile = await db.updateUserProfile(req.params.userId, req.body);
  res.json(profile);
}));

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
