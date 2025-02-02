const {Sequelize} = require('sequelize')

module.exports = new Sequelize(
    'railway',
    'postgres',
    'BDwusxYRWdGgeMngINNxgzFfOrPuecyt',
    {
        host: 'autorack.proxy.rlwy.net',
        port: '49119',
        dialect: 'postgres'
    }
)