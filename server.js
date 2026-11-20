import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';

// Load environment variables
dotenv.config();

const app = express();
import { setServers } from "node:dns";
setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

// Call database connection function
connectDB();

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
