function parseDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    // Массив месяцев в родительном падеже (для документов)
    const months = [
        'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
        'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
    ];

    // Разбиваем строку "24.03.1999" по точкам
    const [dayStr, monthStr, yearStr] = dateStr.split('.');

    const day = parseInt(dayStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1; // для массива 0-based индекс
    const year = parseInt(yearStr, 10);

    // Проверка корректности даты
    if (
        isNaN(day) || isNaN(monthIndex) || isNaN(year) ||
        monthIndex < 0 || monthIndex > 11 ||
        day < 1 || day > 31
    ) {
        return null; // или выбросить ошибку
    }

    return {
        day,
        monthName: months[monthIndex],
        year,
    };
}

export default parseDate;