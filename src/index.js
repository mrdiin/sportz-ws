import express from 'express';

const app = express();
const PORT = 8000;

// Middleware to parse JSON bodies
app.use(express.json());

// Root GET route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Sportz API!' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
