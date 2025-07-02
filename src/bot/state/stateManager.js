import { userStates } from './userStates.js';

export const restartFlow = (bot, chatId) => {
    userStates[chatId] = {
        step: 'claimant_name',
        data: {},
        children: [],
        childIndex: 0,
        childrenTotal: 0,
        attachments: [],
        attachmentStep: 0,
        lastReminderSent: null,
        chatId
    };

    bot.sendMessage(chatId, '1. Інформація про позивача (той, хто подає заяву):\nВкажіть ПІБ позивача:');
};
