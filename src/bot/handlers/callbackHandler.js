import { skipButton } from '../utils/skipButton.js';


export const handleCallbackQuery = async (bot, query, userStates) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const state = userStates[chatId];

    if (!state) {
        const { restartFlow } = await import('../state/stateManager.js');
        return restartFlow(bot, chatId);
    }

    // Обработка "Пропустити"
    // Пропуск claimant_phone
    if (data === 'skip' && state.step === 'claimant_phone') {
        state.data.claimant_phone = null;
        state.step = 'claimant_ipn';
        await bot.sendMessage(chatId, 'ІПН позивача:', skipButton());
        return bot.answerCallbackQuery(query.id);
    }

    // Пропуск claimant_ipn
    if (data === 'skip' && state.step === 'claimant_ipn') {
        state.data.claimant_ipn = null;
        state.step = 'respondent_name';
        await bot.sendMessage(chatId, '2. ПІБ відповідача:');
        return bot.answerCallbackQuery(query.id);
    }

    // Пропуск respondent_address
    if (data === 'skip' && state.step === 'respondent_address') {
        state.data.respondent_address = null;
        state.step = 'respondent_phone';
        await bot.sendMessage(chatId, 'Контактний номер відповідача:', skipButton());
        return bot.answerCallbackQuery(query.id);
    }

    // Пропуск respondent_phone
    if (data === 'skip' && state.step === 'respondent_phone') {
        state.data.respondent_phone = null;
        state.step = 'respondent_work';
        await bot.sendMessage(chatId, 'Місце роботи відповідача:', skipButton());
        return bot.answerCallbackQuery(query.id);
    }

    // Пропуск respondent_work
    if (data === 'skip' && state.step === 'respondent_work') {
        state.data.respondent_work = null;
        state.step = 'respondent_ipn';
        await bot.sendMessage(chatId, 'ІПН відповідача:', skipButton());
        return bot.answerCallbackQuery(query.id);
    }

    // Пропуск respondent_ipn
    if (data === 'skip' && state.step === 'respondent_ipn') {
        state.data.respondent_ipn = null;
        state.step = 'children_count';
        await bot.sendMessage(chatId, '3. Скільки у вас дітей?', skipButton());
        return bot.answerCallbackQuery(query.id);
    }

    // Пропуск children_count
    if (data === 'skip' && state.step === 'children_count') {
        state.childrenTotal = 0;
        state.children = [];
        state.step = 'marriage_check';
        await bot.sendMessage(chatId, '4. Чи перебували в офіційному шлюбі?', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Так', callback_data: 'marriage_yes' }],
                    [{ text: 'Ні', callback_data: 'marriage_no' }]
                ]
            }
        });
        return bot.answerCallbackQuery(query.id);
    };

    // Пропуск waiting_attachments
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
    };

    // Обработка отправки формы (создание PDF)
    if (data === 'submit_form') {
        const { createPdf } = await import('../../pdf/pdfGenerator.js');
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

};
