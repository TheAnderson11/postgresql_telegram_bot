import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import { userStates } from './state.js';

const TOKEN = '8050196668:AAEst8DfLTC72AYdaMuu9KzfxF23Ly9w3Us';
const bot = new TelegramBot(TOKEN, { polling: true });

// Валидации
const validatePhone = (input) => /^\+380\d{9}$/.test(input);
const validateIPN = (input) => /^\d{10}$/.test(input);
const validateDOB = (input) => /^\d{2}\.\d{2}\.\d{4}$/.test(input);
const validateAmount = (input) => /^\d+(\.\d{1,2})?$/.test(input);

// Кнопка "Пропустити"
const skipButton = () => ({
    reply_markup: {
        inline_keyboard: [[{ text: 'Пропустити', callback_data: 'skip' }]]
    }
});

// Инициализация состояния для пользователя
const restartFlow = (chatId) => {
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

// Старт команды
bot.onText(/\/start/, (msg) => {
    restartFlow(msg.chat.id);
});

// Обработка callback_query (кнопок)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const state = userStates[chatId];
    if (!state) return restartFlow(chatId);

    // Обработка "Пропустити"
    if (data === 'skip' && state.step === 'waiting_attachments') {
        const photoTitles = [
            'Свідоцтво про народження дитини (копія)',
            'Свідоцтво про шлюб/про розірвання шлюбу (якщо є)',
            'Довідка про склад сім’ї або місце проживання дитини',
            'Квитанція про сплату судового збору'
        ];

        // Добавляем маркер пропуска в attachments на текущий шаг
        state.attachments[state.attachmentStep] = null;

        state.attachmentStep++;

        if (state.attachmentStep < photoTitles.length) {
            const nextDoc = photoTitles[state.attachmentStep];

            if (nextDoc === 'Свідоцтво про шлюб/про розірвання шлюбу (якщо є)') {
                await bot.sendMessage(chatId, `Додайте: ${nextDoc}`, {
                    reply_markup: {
                        inline_keyboard: [[{ text: 'Пропустити', callback_data: 'skip' }]]
                    }
                });
            } else {
                await bot.sendMessage(chatId, `Додайте: ${nextDoc}`);
            }
        } else {
            state.step = 'submit_ready';
            await bot.sendMessage(chatId, '✅ Усі документи отримано. Натисніть нижче, щоб надіслати заяву:', {
                reply_markup: {
                    inline_keyboard: [[{ text: '📨 Надіслати заяву', callback_data: 'submit_form' }]]
                }
            });
        }
        return bot.answerCallbackQuery(query.id);
    }

    // Обработка отправки формы (создание PDF)
    if (data === 'submit_form') {
        const { createPdf } = await import('./pdfGenerator.js');
        try {
            const pdfBytes = await createPdf({
                data: state.data,
                children: state.children,
                attachments: state.attachments
            }, bot);

            const pdfBuffer = Buffer.from(pdfBytes);

            await bot.sendDocument(chatId, pdfBuffer, {
                filename: 'alimony_statement.pdf',
                contentType: 'application/pdf'
            });
            await bot.sendMessage(chatId, '✅ Дякуємо за заповнення анкети! Щоб отримати результат, надішліть оплату на картку: 1234 5678 9012 3456.');
            delete userStates[chatId];
        } catch (e) {
            console.error('❌ PDF Error:', e);
            await bot.sendMessage(chatId, 'Помилка при формуванні PDF.');
        }
        return bot.answerCallbackQuery(query.id);
    }

    // Выбор вариантов
    switch (data) {
        // Проживание ребенка
        case 'lives_mother':
        case 'lives_father':
        case 'lives_other':
            state.children[state.childIndex].lives_with = data.replace('lives_', '');
            state.childIndex++;
            if (state.childIndex < state.childrenTotal) {
                state.step = 'child_name';
                await bot.sendMessage(chatId, `Введіть ПІБ дитини №${state.childIndex + 1}:`);
            } else {
                state.step = 'marriage_check';
                await bot.sendMessage(chatId, '4. Чи перебували в офіційному шлюбі?', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Так', callback_data: 'marriage_yes' }],
                            [{ text: 'Ні', callback_data: 'marriage_no' }]
                        ]
                    }
                });
            }
            break;

        // Шлюб
        case 'marriage_yes':
            state.step = 'marriage_date';
            await bot.sendMessage(chatId, 'Вкажіть дату шлюбу (ДД.ММ.РРРР):');
            break;
        case 'marriage_no':
            state.step = 'alimony_choice';
            await bot.sendMessage(chatId, '5. Сума аліментів або спосіб визначення:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '1/4 від доходу', callback_data: 'percent_1_4' }],
                        [{ text: '1/3 від доходу', callback_data: 'percent_1_3' }],
                        [{ text: '1/2 від доходу', callback_data: 'percent_1_2' }],
                        [{ text: 'Ввести суму', callback_data: 'enter_amount' }]
                    ]
                }
            });
            break;

        // Розірвання шлюбу
        case 'divorce_yes':
            state.step = 'marriage_divorce_date';
            await bot.sendMessage(chatId, 'Вкажіть дату розірвання шлюбу (ДД.ММ.РРРР):');
            break;
        case 'divorce_no':
            state.step = 'alimony_choice';
            await bot.sendMessage(chatId, '5. Сума аліментів або спосіб визначення:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '1/4 від доходу', callback_data: 'percent_1_4' }],
                        [{ text: '1/3 від доходу', callback_data: 'percent_1_3' }],
                        [{ text: '1/2 від доходу', callback_data: 'percent_1_2' }],
                        [{ text: 'Ввести суму', callback_data: 'enter_amount' }]
                    ]
                }
            });
            break;

        // Выбор алиментов - проценты
        case 'percent_1_4':
        case 'percent_1_3':
        case 'percent_1_2':
            state.data.alimony = data.replace('percent_', '').replace(/_/g, '/');
            state.step = 'court_name';
            await bot.sendMessage(chatId,
                `6. Судова інстанція:\n\n` +
                `• Повна назва суду, до якого подається заява (зазвичай – за місцем проживання відповідача або позивача, якщо дитина проживає з позивачем)`);
            break;

        // Ввод суммы алиментов
        case 'enter_amount':
            state.step = 'alimony_custom';
            await bot.sendMessage(chatId, 'Введіть суму аліментів у гривнях:');
            break;

        // Рішення суду
        case 'prev_yes':
            state.data.previous_decision = true;
            state.step = 'enforcement_period';
            await bot.sendMessage(chatId, '7. Чи потрібне стягнення аліментів за минулий період?', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Так', callback_data: 'enforcement_yes' }],
                        [{ text: 'Ні', callback_data: 'enforcement_no' }]
                    ]
                }
            });
            break;
        case 'prev_no':
            state.data.previous_decision = false;
            state.step = 'waiting_attachments';
            state.attachmentStep = 0;
            state.attachments = [];
            await bot.sendMessage(chatId, 'Додайте необхідні документи:');
            await bot.sendMessage(chatId, 'Свідоцтво про народження дитини (копія)');
            break;

        // Стягнення аліментів
        case 'enforcement_yes':
            state.step = 'enforcement_period';
            await bot.sendMessage(chatId, 'За який період?', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '1 рік', callback_data: 'period_1' }],
                        [{ text: '2 роки', callback_data: 'period_2' }],
                        [{ text: '3 роки', callback_data: 'period_3' }]
                    ]
                }
            });
            break;
        case 'enforcement_no':
            state.data.enforcement_period = null;
            state.step = 'waiting_attachments';
            state.attachmentStep = 0;
            state.attachments = [];
            await bot.sendMessage(chatId, 'Додайте необхідні документи:');
            await bot.sendMessage(chatId, 'Свідоцтво про народження дитини (копія)');
            break;

        // Вибір періоду стягнення
        case 'period_1':
        case 'period_2':
        case 'period_3':
            state.data.enforcement_period = data.replace('period_', '') + ' роки';
            state.step = 'waiting_attachments';
            state.attachmentStep = 0;
            state.attachments = [];
            await bot.sendMessage(chatId, 'Додайте необхідні документи:');
            await bot.sendMessage(chatId, 'Свідоцтво про народження дитини (копія)');
            break;

        default:
            // Неизвестные callback - игнор
            break;
    }

    await bot.answerCallbackQuery(query.id);
});

// Обработка текстовых сообщений по шагам
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    const state = userStates[chatId];
    if (!state || text?.startsWith('/')) return;

    const store = (key, value) => { state.data[key] = value; };

    switch (state.step) {
        case 'claimant_name':
            store('claimant_name', text);
            state.step = 'claimant_address';
            return bot.sendMessage(chatId, 'Адреса реєстрації позивача:');

        case 'claimant_address':
            store('claimant_address', text);
            state.step = 'claimant_phone';
            return bot.sendMessage(chatId, 'Контактний телефон позивача:', skipButton());

        case 'claimant_phone':
            if (!validatePhone(text)) return bot.sendMessage(chatId, 'Введіть номер у форматі +380123456789');
            store('claimant_phone', text);
            state.step = 'claimant_ipn';
            return bot.sendMessage(chatId, 'ІПН позивача:', skipButton());

        case 'claimant_ipn':
            if (!validateIPN(text)) return bot.sendMessage(chatId, 'ІПН має складатися з 10 цифр.');
            store('claimant_ipn', text);
            state.step = 'respondent_name';
            return bot.sendMessage(chatId, '2. ПІБ відповідача:');

        case 'respondent_name':
            store('respondent_name', text);
            state.step = 'respondent_address';
            return bot.sendMessage(chatId, 'Адреса відповідача:', skipButton());

        case 'respondent_address':
            store('respondent_address', text);
            state.step = 'respondent_phone';
            return bot.sendMessage(chatId, 'Контактний номер відповідача:', skipButton());

        case 'respondent_phone':
            if (!validatePhone(text)) return bot.sendMessage(chatId, 'Невірний формат. Приклад: +380123456789');
            store('respondent_phone', text);
            state.step = 'respondent_work';
            return bot.sendMessage(chatId, 'Місце роботи відповідача:', skipButton());

        case 'respondent_work':
            store('respondent_work', text);
            state.step = 'respondent_ipn';
            return bot.sendMessage(chatId, 'ІПН відповідача:', skipButton());

        case 'respondent_ipn':
            if (!validateIPN(text)) return bot.sendMessage(chatId, 'ІПН має складатися з 10 цифр.');
            store('respondent_ipn', text);
            state.step = 'children_count';
            return bot.sendMessage(chatId, '3. Скільки у вас дітей?');

        case 'children_count': {
            const count = parseInt(text);
            if (isNaN(count) || count <= 0) return bot.sendMessage(chatId, 'Введіть число більше нуля.');
            state.childrenTotal = count;
            state.childIndex = 0;
            state.children = [];
            state.step = 'child_name';
            return bot.sendMessage(chatId, `Введіть ПІБ дитини №1:`);
        }

        case 'child_name':
            state.children.push({ name: text });
            state.step = 'child_dob';
            return bot.sendMessage(chatId, 'Дата народження дитини (наприклад 12.05.1999):');

        case 'child_dob':
            if (!validateDOB(text)) return bot.sendMessage(chatId, 'Введіть дату у форматі ДД.ММ.РРРР');
            state.children[state.childIndex].dob = text;
            state.step = 'child_lives_with';
            return bot.sendMessage(chatId, 'З ким проживає дитина?', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Мати', callback_data: 'lives_mother' }],
                        [{ text: 'Батько', callback_data: 'lives_father' }],
                        [{ text: 'Інше', callback_data: 'lives_other' }]
                    ]
                }
            });

        case 'alimony_custom':
            if (!validateAmount(text)) return bot.sendMessage(chatId, 'Введіть лише число без букв (наприклад 5000):');
            store('alimony', text);
            state.step = 'court_name';
            return bot.sendMessage(chatId,
                `6. Судова інстанція:\n\n` +
                `• Повна назва суду, до якого подається заява (зазвичай – за місцем проживання відповідача або позивача, якщо дитина проживає з позивачем)`);

        case 'marriage_date':
            if (!validateDOB(text)) return bot.sendMessage(chatId, 'Введіть дату у форматі ДД.ММ.РРРР');
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
            if (!validateDOB(text)) return bot.sendMessage(chatId, 'Введіть дату у форматі ДД.ММ.РРРР');
            store('divorce_date', text);
            state.step = 'alimony_choice';
            return bot.sendMessage(chatId, '5. Сума аліментів або спосіб визначення:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '1/4 від доходу', callback_data: 'percent_1_4' }],
                        [{ text: '1/3 від доходу', callback_data: 'percent_1_3' }],
                        [{ text: '1/2 від доходу', callback_data: 'percent_1_2' }],
                        [{ text: 'Ввести суму', callback_data: 'enter_amount' }]
                    ]
                }
            });

        case 'court_name':
            store('court_name', text);
            state.step = 'previous_decision';
            return bot.sendMessage(chatId, '7. Чи були вже рішення суду щодо аліментів?', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Так', callback_data: 'prev_yes' }],
                        [{ text: 'Ні', callback_data: 'prev_no' }]
                    ]
                }
            });

        case 'waiting_attachments': {
            const photoTitles = [
                'Свідоцтво про народження дитини (копія)',
                'Свідоцтво про шлюб/про розірвання шлюбу (якщо є)',
                'Довідка про склад сім’ї або місце проживання дитини',
                'Квитанція про сплату судового збору'
            ];

            if (msg.photo) {
                if (msg.media_group_id) {
                    return bot.sendMessage(chatId, '⚠️ Будь ласка, надсилайте фото по одному, а не альбомом.');
                }

                const largest = msg.photo[msg.photo.length - 1];
                // Записываем фото по текущему шагу
                state.attachments[state.attachmentStep] = largest.file_id;
                state.attachmentStep++;

                if (state.attachmentStep < photoTitles.length) {
                    const nextDoc = photoTitles[state.attachmentStep];

                    if (nextDoc === 'Свідоцтво про шлюб/про розірвання шлюбу (якщо є)') {
                        return bot.sendMessage(chatId, `Додайте: ${nextDoc}`, {
                            reply_markup: {
                                inline_keyboard: [[{ text: 'Пропустити', callback_data: 'skip' }]]
                            }
                        });
                    } else {
                        return bot.sendMessage(chatId, `Додайте: ${nextDoc}`);
                    }
                } else {
                    state.step = 'submit_ready';
                    return bot.sendMessage(chatId, '✅ Усі документи отримано. Натисніть нижче, щоб надіслати заяву:', {
                        reply_markup: {
                            inline_keyboard: [[{ text: '📨 Надіслати заяву', callback_data: 'submit_form' }]]
                        }
                    });
                }
            } else {
                return bot.sendMessage(chatId, 'Будь ласка, надішліть фото документів.');
            }
        }

        default:
            return bot.sendMessage(chatId, 'Невідомий крок. Введіть /start для початку.');
    }
});

// Запуск express (если нужен)
const app = express();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
