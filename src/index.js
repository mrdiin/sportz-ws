import 'dotenv/config';
import express from 'express';
import { matchRouter } from './routes/matches.js';

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT;

// Middleware to parse JSON bodies
app.use(express.json());

// Root GET route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Sportz API from ' + req.ip + ' !' });
});

app.use('/api/v1/matches', matchRouter);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
