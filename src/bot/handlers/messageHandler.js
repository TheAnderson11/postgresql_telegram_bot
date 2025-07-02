import { skipButton } from "../utils/skipButton.js";
import { validateAmount, validateDOB, validateIPN, validatePhone } from "../utils/validators.js";


export const handleMessage = async (bot, msg, userStates) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    const state = userStates[chatId];
    if (!state || text?.startsWith('/')) return;

    const store = (key, value) => { state.data[key] = value; };

    switch (state.step) {
        case 'claimant_name':
            store('claimant_name', text);
            state.step = 'claimant_years_old'
            return bot.sendMessage(chatId, 'Рік народження позивача:')
            
        case 'claimant_years_old':
            if (!validateDOB(text)) return bot.sendMessage(chatId, 'Введіть дату у форматі ДД.ММ.РРРР');
            store('claimant_years_old', text);
            state.step = 'claimant_passport'
            return bot.sendMessage(chatId, 'Паспорт позивача:')
            
        case 'claimant_passport':
            store('claimant_passport', text);
            state.step = 'marriage_registry';
            return bot.sendMessage(chatId, 'Шлюб було реєстровано (Адреса):');

            
        case 'marriage_registry':
            store('marriage_registry', text);
            state.step = 'claimant_address';
            return bot.sendMessage(chatId, 'Адреса реєстрації позивача:');
        
        case 'claimant_address':
            store('claimant_address', text);
            state.step = 'claimant_phone';
            return bot.sendMessage(chatId, 'Контактний телефон позивача:', skipButton());

        case 'claimant_phone':
            if (!validatePhone(text)) return bot.sendMessage(chatId, 'Введіть номер у форматі 0995553333');
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
            if (!validatePhone(text)) return bot.sendMessage(chatId, 'Невірний формат. Приклад: 0995553333');
            store('respondent_phone', text);
            state.step = 'respondent_work';
            return bot.sendMessage(chatId, 'Місце роботи відповідача:', skipButton());

        case 'respondent_work':
            store('respondent_work', text);
            state.step = 'respondent_passport';
            return bot.sendMessage(chatId, 'Паспорт відповідача:', skipButton());

            
        case 'respondent_passport':
            store('respondent_passport', text);
            state.step = 'respondent_ipn';
            return bot.sendMessage(chatId, 'ІПН відповідача:', skipButton());
        
        case 'respondent_ipn':
            if (!validateIPN(text)) return bot.sendMessage(chatId, 'ІПН має складатися з 10 цифр.');
            store('respondent_ipn', text);
            state.step = 'children_count';
            return bot.sendMessage(chatId, '3. Скільки у вас дітей?',skipButton());

        case 'children_count': {
            const count = parseInt(text);
            if (isNaN(count) || count <= 0) return bot.sendMessage(chatId, 'Введіть число більше нуля,або Пропустити',skipButton());
            state.childrenTotal = count;
            state.childIndex = 0;
            state.children = [];
            state.step = 'child_name';
            return bot.sendMessage(chatId, `Введіть ПІБ дитини №1:`);
        }

        case 'child_name':
            state.children.push({ name: text });
            state.step = 'child_dob';
            return bot.sendMessage(chatId, 'Дата народження дитини (наприклад 12.05.2005):');

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
};
