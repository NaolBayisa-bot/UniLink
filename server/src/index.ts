import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { query } from './db/query';

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    const { rows } = await query<{ db_time: string }>('SELECT now() AS db_time');
    res.json({ status: 'ok', db_time: rows[0].db_time });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
