export const skipButton = () => ({
  reply_markup: { inline_keyboard: [[{ text: 'Пропустити', callback_data: 'skip' }]] }
});