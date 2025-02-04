const {Sequelize} = require('sequelize')

module.exports = new Sequelize(
    'railway',
    'postgres',
    'OxSQGFNbpPGucvrtIUpgyrqnDBduYROc',
    {
        host: 'autorack.proxy.rlwy.net',
        port: '53351',
        dialect: 'postgres'
    }
)
