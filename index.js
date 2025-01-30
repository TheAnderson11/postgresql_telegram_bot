const TELEGRAMAPI = '7946745300:AAGlA-YMWtLCQ0dElFGCpTJzxGirgPCH7qM';
const telegramApi = require('node-telegram-bot-api')
const {Sequelize} = require('sequelize')

const sequelize = new Sequelize(
    process.env.DB_URL,
    {
    dialect: "sqlite",
    storage: "./database.sqlite",
    logging: false
})
sequelize.sync().then(() => {
    console.log("Database connected");
}).catch((err) => {
    console.log(err);
})

const {againOption, gameOptions} = require('./options')
const bot = new telegramApi(TELEGRAMAPI, {polling: true})

const chats = {}

const startGame = async (chatId) => {
    await bot.sendMessage(chatId, 'Сейчас загадаю число от 0 до 9, а ты должен отгадать')
    const randomNumber = Math.floor(Math.random() * 10)
    chats[chatId] = randomNumber
    await bot.sendMessage(chatId, 'Отгадай число', gameOptions)
}

const start = () => {
    bot.setMyCommands([
        {command: '/start', description: 'Start wellcome'},
        {command: '/info', description: 'Get information'},
        {command: '/game', description: 'Playing game'},
    ])

    bot.on('message', async msg => {
        const text = msg.text;
        const chatId = msg.chat.id;
        if (text === '/start') {
            await bot.sendSticker(chatId,'https://tlgrm.eu/_/stickers/b0d/85f/b0d85fbf-de1b-4aaf-836c-1cddaa16e002/1.webp')
            return bot.sendMessage(chatId, `Wellcome in the shop ${msg.from.first_name} ${msg.from.last_name}`)
        } if(text === '/info'){
            return bot.sendMessage(chatId, `Your name ${msg.from.first_name} ${msg.from.last_name}`)
        } if(text === '/game') {
            return startGame(chatId)
        }
        return bot.sendMessage(chatId, "I don't understand your message")
    })
}

    bot.on('callback_query',msg => {
        const data = msg.data;
        const chatId = msg.message.chat.id
        if (data === '/again') {
            return startGame(chatId)
        }
        if(data === chats[chatId].toString()){
            return bot.sendMessage(chatId, `Поздравляю, ты отгадал цифру ${chats[chatId]}`, againOption)
        } else {
            return bot.sendMessage(chatId, `К сожалению ты не угадал, бот загадал цифру ${chats[chatId]}`, againOption)
        }
    })
start()