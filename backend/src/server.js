const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDb = require('./config/db');
const { port, clientUrl } = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const courseRoutes = require('./routes/courseRoutes');
const recordRoutes = require('./routes/recordRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const errorHandler = require('./middlewares/errorHandler');
const { ensureAdminAccount } = require('./services/bootstrapService');

const app = express();

const allowedOrigins = new Set([
  clientUrl,
  'http://localhost:5173',
  'http://localhost:5174',
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/files/certificates', express.static(path.join(__dirname, '../uploads/certificates')));

app.use(errorHandler);

connectDb()
  .then(async () => {
    await ensureAdminAccount();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Cannot start server', err);
    process.exit(1);
  });
