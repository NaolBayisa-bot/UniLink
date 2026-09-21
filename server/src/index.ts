import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { query } from './db/query';
import { authRouter } from './routes/auth';
import { profileRouter } from './routes/profile';
import { photoRouter } from './routes/photo';
import jwtAuth from './middleware/jwt-auth';

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

// POST /auth/complete-signup — auth completion flow (Telegram + Google).
app.use('/auth', authRouter);

// POST /profile — the authenticated caller updates their own profile. Protected
// by jwtAuth, which sets req.userId (the single source of truth for identity).
app.use('/profile', jwtAuth, profileRouter);

// POST /photo/upload-signature — signed Cloudinary direct-upload params scoped
// to the authenticated caller's own folder. Protected by jwtAuth (req.userId is
// the single source of truth for identity).
app.use('/photo', jwtAuth, photoRouter);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
