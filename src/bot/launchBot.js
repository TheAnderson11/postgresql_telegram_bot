import TelegramBot from 'node-telegram-bot-api';
import { handleCallbackQuery } from './handlers/callbackHandler.js';
import { handleMessage } from './handlers/messageHandler.js';
import { restartFlow } from './state/stateManager.js';
import { userStates } from './state/userStates.js';

export const launchBot = () => {
    const TOKEN = process.env.TG_API || '8050196668:AAEst8DfLTC72AYdaMuu9KzfxF23Ly9w3Us';
    const bot = new TelegramBot(TOKEN, { polling: true });

    bot.onText(/\/start/, (msg) => {
        restartFlow(bot, msg.chat.id);
    });

    bot.on('callback_query', (query) => {
        handleCallbackQuery(bot, query, userStates);
    });

    bot.on('message', (msg) => {
        handleMessage(bot, msg, userStates);
    });
};
