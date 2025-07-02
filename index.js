import dotenv from 'dotenv';
import express from 'express';
import { launchBot } from './src/bot/launchBot.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
    launchBot();
});
