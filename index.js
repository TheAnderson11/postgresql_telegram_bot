const TELEGRAMAPI = '8050196668:AAEst8DfLTC72AYdaMuu9KzfxF23Ly9w3Us';
const telegramApi = require('node-telegram-bot-api')
const sequelize = require('./db')
const UserModel = require('./modules')
const {againOption, gameOptions} = require('./options')
const bot = new telegramApi(TELEGRAMAPI, {polling: true})

const chats = {}

const startGame = async (chatId) => {
    await bot.sendMessage(chatId, 'Сейчас загадаю число от 0 до 9, а ты должен отгадать')
    const randomNumber = Math.floor(Math.random() * 10)
    chats[chatId] = randomNumber
    await bot.sendMessage(chatId, 'Отгадай число', gameOptions)
}

const start = async () => {
    try {
        await sequelize.authenticate()
        await sequelize.sync()
    } catch (error) {
        console.log(error);
    }
    bot.setMyCommands([
        {command: '/start', description: 'Start wellcome'},
        {command: '/info', description: 'Get information'},
        {command: '/game', description: 'Playing game'},
    ])

    bot.on('message', async msg => {
        const text = msg.text;
        const chatId = msg.chat.id;

        try {
            if (text === '/start') {
                await UserModel.create({chatId})
                await bot.sendSticker(chatId,'https://tlgrm.eu/_/stickers/b0d/85f/b0d85fbf-de1b-4aaf-836c-1cddaa16e002/1.webp')
                return bot.sendMessage(chatId, `Wellcome in the shop ${msg.from.first_name} ${msg.from.last_name}`)
            } if(text === '/info'){
                const user = await UserModel.findOne({where: {chatId: chatId.toString()}})
                return bot.sendMessage(chatId, `Your name ${msg.from.first_name} ${msg.from.last_name}, в игре у тебя правильных ответов ${user.right}, неправильных ${user.wrong}`)
            } if(text === '/game') {
                return startGame(chatId)
            }
            return bot.sendMessage(chatId, "I don't understand your message")
        } catch (error) {
            return bot.sendMessage(chatId, `Возникла ошибка ${error}`)
        }

    })
}

    bot.on('callback_query',async msg => {
        const data = msg.data;
        const chatId = msg.message.chat.id
        if (data === '/again') {
            return startGame(chatId)
        }
        const user = await UserModel.findOne({where: {chatId:chatId.toString()}})
        if(data === chats[chatId].toString()){
            user.right += 1
            await bot.sendMessage(chatId, `Поздравляю, ты отгадал цифру ${chats[chatId]}`, againOption)
        } else {
            user.wrong += 1
            await bot.sendMessage(chatId, `К сожалению ты не угадал, бот загадал цифру ${chats[chatId]}`, againOption)
        }
        await user.save()
    })
start()