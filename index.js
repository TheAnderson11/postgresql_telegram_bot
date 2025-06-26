// Обновлённая логика Telegram-бота с поддержкой фото и PDF
import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import { userStates } from './state.js';

const TOKEN = '8050196668:AAEst8DfLTC72AYdaMuu9KzfxF23Ly9w3Us';
const bot = new TelegramBot(TOKEN, { polling: true });

const restartFlow = (chatId) => {
    userStates[chatId] = {
        step: 'claimant_name',
        data: {},
        children: [],
        childIndex: 0,
        childrenTotal: 0,
        attachments: [],
        chatId // <--- Додаємо chatId для подальшої генерації PDF
    };
    bot.sendMessage(chatId, '1. Інформація про позивача (той, хто подає заяву):\nВкажіть ПІБ позивача:');
};

bot.onText(/\/start/, (msg) => {
    restartFlow(msg.chat.id);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    let state = userStates[chatId];
    if (!state) return restartFlow(chatId);

    const storeOptional = (key, value) => {
        if (value !== '-') state.data[key] = value;
    };

    const store = (key, value) => {
        state.data[key] = value;
    };

    if (state.step === 'waiting_attachments') {
        if (msg.photo) {
            const largestPhoto = msg.photo[msg.photo.length - 1];
            state.attachments.push(largestPhoto.file_id);
            return bot.sendMessage(chatId, '✅ Фото прийнято. Надішліть ще або /done для завершення.');
        } else if (text === '/done') {
    const { createPdf } = await import('./pdfGenerator.js');
    try {
        const pdfBytes = await createPdf(state, bot);

        // Отправка PDF только админу (тебе)
        await bot.sendDocument(7498392497, Buffer.from(pdfBytes), {
            filename: 'alimony_statement.pdf',
            contentType: 'application/pdf'
        });

        await bot.sendMessage(chatId, '✅ Заява сформована і надіслана адміністратору. Дякуємо!');
    } catch (e) {
        console.error('❌ PDF Error:', e);
        await bot.sendMessage(chatId, 'Сталася помилка при формуванні PDF. Спробуйте пізніше.');
    }
    delete userStates[chatId];
    return;
} else {
            return bot.sendMessage(chatId, 'Надішліть фото або /done для завершення.');
        }
    }

    if (!text || text === '/start') return;

    switch (state.step) {
        case 'claimant_name':
            store('claimant_name', text);
            state.step = 'claimant_address';
            return bot.sendMessage(chatId, 'Адреса реєстрації позивача:');

        case 'claimant_address':
            store('claimant_address', text);
            state.step = 'claimant_phone';
            return bot.sendMessage(chatId, 'Контактний телефон позивача (за бажанням, або -):');

        case 'claimant_phone':
            storeOptional('claimant_phone', text);
            state.step = 'claimant_ipn';
            return bot.sendMessage(chatId, 'ІПН позивача (за потреби, або -):');

        case 'claimant_ipn':
            storeOptional('claimant_ipn', text);
            state.step = 'respondent_name';
            return bot.sendMessage(chatId, '2. Інформація про відповідача (той, з кого стягуються аліменти):\nПІБ відповідача:');

        case 'respondent_name':
            store('respondent_name', text);
            state.step = 'respondent_address';
            return bot.sendMessage(chatId, 'Адреса відповідача (якщо відома, або -):');

        case 'respondent_address':
            storeOptional('respondent_address', text);
            state.step = 'respondent_phone';
            return bot.sendMessage(chatId, 'Контактний номер відповідача (якщо відомий, або -):');

        case 'respondent_phone':
            storeOptional('respondent_phone', text);
            state.step = 'respondent_work';
            return bot.sendMessage(chatId, 'Місце роботи відповідача (якщо відоме, або -):');

        case 'respondent_work':
            storeOptional('respondent_work', text);
            state.step = 'respondent_ipn';
            return bot.sendMessage(chatId, 'ІПН відповідача (за потреби, або -):');

        case 'respondent_ipn':
            storeOptional('respondent_ipn', text);
            state.step = 'children_count';
            return bot.sendMessage(chatId, '3. Відомості про дитину/дітей:\nСкільки у вас дітей? (введіть число):');

        case 'children_count': {
            const count = parseInt(text);
            if (isNaN(count) || count <= 0) return bot.sendMessage(chatId, 'Будь ласка, введіть коректне число дітей:');
            state.childrenTotal = count;
            state.step = 'child_name';
            return bot.sendMessage(chatId, `Введіть ПІБ дитини №1:`);
        }

        case 'child_name':
            state.children.push({ name: text });
            state.step = 'child_dob';
            return bot.sendMessage(chatId, 'Дата народження дитини:');

        case 'child_dob':
            state.children[state.childIndex].dob = text;
            state.step = 'child_lives_with';
            return bot.sendMessage(chatId, 'З ким проживає дитина?');

        case 'child_lives_with':
            state.children[state.childIndex].lives_with = text;
            state.childIndex++;
            if (state.childIndex < state.childrenTotal) {
                state.step = 'child_name';
                return bot.sendMessage(chatId, `Введіть ПІБ дитини №${state.childIndex + 1}:`);
            } else {
                state.step = 'marriage_check';
                return bot.sendMessage(chatId, '4. Відомості про шлюб (за потреби):\nЧи перебували в офіційному шлюбі?', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Так', callback_data: 'marriage_yes' }],
                            [{ text: 'Ні', callback_data: 'marriage_no' }]
                        ]
                    }
                });
            }

        case 'marriage_date':
            store('marriage_date', text);
            state.step = 'marriage_divorced';
            return bot.sendMessage(chatId, 'Чи розірвано шлюб?', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Так', callback_data: 'divorce_yes' }],
                        [{ text: 'Ні', callback_data: 'divorce_no' }]
                    ]
                }
            });

        case 'marriage_divorce_date':
            store('divorce_date', text);
            state.step = 'alimony_type';
            return bot.sendMessage(chatId, '5. Сума аліментів або спосіб визначення:\nВкажіть частку або фіксовану суму (напр. 1/4 або 5000 грн):');

        case 'alimony_type':
            store('alimony', text);
            state.step = 'court_name';
            return bot.sendMessage(chatId, '6. Судова інстанція:\nПовна назва суду:');

        case 'court_name':
            store('court', text);
            state.step = 'previous_decision';
            return bot.sendMessage(chatId, '7. Додатково:\nЧи були вже рішення суду щодо аліментів?', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Так', callback_data: 'prev_yes' }],
                        [{ text: 'Ні', callback_data: 'prev_no' }]
                    ]
                }
            });

        case 'past_period':
            storeOptional('past_period', text);
            state.step = 'waiting_attachments';
            return bot.sendMessage(chatId, '8. Перелік додатків:\nНадішліть фото документів. Якщо завершили — надішліть /done');

        default:
            bot.sendMessage(chatId, 'Сталася помилка. Запустимо все спочатку.');
            restartFlow(chatId);
    }
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const state = userStates[chatId];
    if (!state) return restartFlow(chatId);

    if (data === 'marriage_yes') {
        state.step = 'marriage_date';
        bot.sendMessage(chatId, 'Дата реєстрації шлюбу:');
    } else if (data === 'marriage_no') {
        state.step = 'alimony_type';
        bot.sendMessage(chatId, '5. Сума аліментів або спосіб визначення:\nВкажіть частку або фіксовану суму (напр. 1/4 або 5000 грн):');
    } else if (data === 'divorce_yes') {
        state.step = 'marriage_divorce_date';
        bot.sendMessage(chatId, 'Дата розірвання шлюбу:');
    } else if (data === 'divorce_no') {
        state.step = 'alimony_type';
        bot.sendMessage(chatId, '5. Сума аліментів або спосіб визначення:\nВкажіть частку або фіксовану суму (напр. 1/4 або 5000 грн):');
    } else if (data === 'prev_yes' || data === 'prev_no') {
        state.data.previous_decision = data === 'prev_yes' ? 'Так' : 'Ні';
        state.step = 'past_period';
        bot.sendMessage(chatId, 'Чи потрібно стягнення за минулий період (до 3 років)? Якщо не потрібно, введіть -');
    }

    bot.answerCallbackQuery(query.id);
});

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_, res) => {
    res.send('Bot is running!');
});

app.listen(PORT, () => {
    console.log(`Express server is listening on port ${PORT}`);
});