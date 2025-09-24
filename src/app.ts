import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
// import errorHandler from './middlewares/error.middleware';
import { startSequenceJob } from "./jobs/sequenceJob";

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => {
  res.send('Welcome to Crew-Check-Backend')
});

// ✅ Start cronjob
// startSequenceJob();
// app.use('/api/v1/auth', authRoutes);
// app.use('/api/v1/user', userRoutes);
app.use('/api/v1', routes);

// Global error handler
// app.use(errorHandler);

export default app;
