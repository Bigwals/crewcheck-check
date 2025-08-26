import app from './app';
import dotenv from 'dotenv';
import connectDB from './config/db';

dotenv.config();

connectDB()

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server is up & running on port ${PORT}`);
});
