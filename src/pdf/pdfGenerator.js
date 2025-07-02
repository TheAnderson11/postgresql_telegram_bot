import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import fetch from 'node-fetch';
import path, { dirname } from 'path';
import pkg from 'pdf-lib';
import { fileURLToPath } from 'url';
import parseDate from './utils/parseDate.js';

const { PDFDocument, rgb } = pkg;

export async function createPdf(state, bot) {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    
    const fontRegularBytes = fs.readFileSync(path.resolve(__dirname, '../assets/fonts/Merriweather_24pt_SemiCondensed-Light.ttf'));
    const fontSemiBoldBytes = fs.readFileSync(path.resolve(__dirname, '../assets/fonts/Merriweather_24pt_SemiCondensed-SemiBoldItalic.ttf'));
    const fontBoldBytes = fs.readFileSync(path.resolve(__dirname, '../assets/fonts/Merriweather_24pt_SemiCondensed-Bold.ttf'));

    const fontRegular = await pdfDoc.embedFont(fontRegularBytes);
    const fontSemiBold = await pdfDoc.embedFont(fontSemiBoldBytes);
    const fontBold = await pdfDoc.embedFont(fontBoldBytes);


    const dateObj = parseDate(state.data.claimant_years_old)

    function wrapText(text, maxWidth, font, fontSize) {
    const words = text.split(' ');
    const lines = [];
    let line = '';

    for (const word of words) {
        const testLine = line ? line + ' ' + word : word;
        const width = font.widthOfTextAtSize(testLine, fontSize);
        if (width > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = testLine;
        }
    }
    if (line) lines.push(line);
    return lines;
}

    let page = pdfDoc.addPage([600, 800]);
    const { width, height } = page.getSize();
    const fontSize = 11;
    const lineHeight = 16;
    let y = height - 50;


    const drawText = (text, options = {}) => {
    const font = options.font || fontRegular;
    const size = options.size || fontSize;
    const color = options.color || rgb(0, 0, 0);
    const align = options.align;
    const x = options.x !== undefined ? options.x : 50;
    const maxWidth = options.maxWidth || (width - 100); // по умолчанию 50px от каждого края
    const lineHeight = options.lineHeight || 16;
    const indent = options.indent || 20; // Отступ для первой строки

    // Разбиваем текст на строки по ширине maxWidth
    const lines = wrapText(text, maxWidth, font, size);

        for (let i = 0; i < lines.length; i++) {
        if (y < 60) {
            page = pdfDoc.addPage([600, 800]);
            y = height - 50;
        }

        const line = lines[i];

        let drawX = x;
        if (i === 0) {
            drawX += indent; // Отступ только первой строки
        }

        if (align === 'center') {
            const textWidth = font.widthOfTextAtSize(line, size);
            drawX = (width - textWidth) / 2;
        } else if (align === 'right') {
            const textWidth = font.widthOfTextAtSize(line, size);
            drawX = width - textWidth - 50;
        }

        page.drawText(line, {
            x: drawX,
            y,
            size,
            font,
            color,
        });
        y -= lineHeight;
    }
};
    const livesWithMap = {
        father: 'батьком',
        mother: 'матір\'ю',
        other: 'іншим'
    };

    // 📍 Заголовок суда
    drawText('До Соборного районного суду м. Дніпропетровська', { align: 'right', font: fontBold });
    drawText('адреса: 49005, м. Дніпро,', { align: 'right' });
    drawText('вул.Гусенка, 13', { align: 'right' });
    y -= 20;

    // 📍 Позивач
    drawText(`Позивач: ${state.data.claimant_name || '-'}`, { align: 'right', font: fontBold });
    drawText(`${state.data.claimant_years_old || '-'} року народження`, { align: 'right' });
    drawText(`паспорт ${state.data.claimant_passport || '-'}, виданий ${state.data.claimant_passport_issued || '-'}`, { align: 'right' });
    drawText(`адреса реєстрації: ${state.data.claimant_address || '-'}`, { align: 'right' });
    drawText(`Адреса для листування : ${state.data.claimant_mailing || '-'}`, { align: 'right' });
    drawText(`реєстраційний номер облікової картки платника податків: ${state.data.claimant_ipn || '-'}`, { align: 'right' });
    drawText(`адреса електронної пошти: ${state.data.claimant_email || '-'}`, { align: 'right' });
    drawText(`засоби зв’язку: тел.: ${state.data.claimant_phone || '-'}`, { align: 'right' });
    y -= 20;

    // 📍 Відповідач
    drawText(`Відповідач: ${state.data.respondent_name || '-'}`, { align: 'right', font: fontBold });
    drawText(`${state.data.respondent_dob || '-'} року народження`, { align: 'right' });
    drawText(`паспорт ${state.data.respondent_passport || '-'}, виданий ${state.data.respondent_passport_issued || '-'}`, { align: 'right' });
    drawText(`адреса реєстрації: ${state.data.respondent_address || '-'}`, { align: 'right' });
    drawText(`реєстраційний номер облікової картки платника податків: ${state.data.respondent_ipn || '-'}`, { align: 'right' });
    drawText(`адреса електронної пошти: ${state.data.respondent_email || '-'}`, { align: 'right' });
    drawText(`засоби зв’язку: тел.: ${state.data.respondent_phone || '-'}`, { align: 'right' });
    y -= 20;

    // 👉 Блок справа
    drawText('Позов немайнового характеру', { align: 'right', font: fontBold });
    y -= 20;

    // 📍 Заголовок по центру
    drawText('Позовна заява', { align: 'center', size: 13, font: fontBold });
    drawText('про розірвання шлюбу', { align: 'center', size: 12 });
    y -= 20;

    drawText(`«${dateObj.day}» ${dateObj.monthName} ${dateObj.year} року між мною ${state.data.claimant_name || '-'} та ${state.data.respondent_name || '-'}, було укладено шлюб.`, {x: 70, maxWidth: width - 120, indent: 20});
    drawText(`Шлюб було реєстровано у ${state.data.marriage_registry || '__________________'}, актовий запис №${state.data.marriage_record || '170'}.`, {x: 70, maxWidth: width - 120, indent: 20});
    drawText('Спочатку наше сімейне життя складалось добре, проте протягом останніх 2-х років сімейні стосунки між нами погіршились, що в кінцевому результаті призвело до постійних сварок та, як наслідок, до фактичного припинення між нами будь-яких шлюбних відносин.', {x: 70, maxWidth: width - 120, indent: 20});
    drawText(`Від цього шлюбу ${state.children?.length > 0 ? 'ми маємо дітей' : 'ми не маємо спільних дітей'}.`);
        state.children.forEach((child, index) => {
        drawText(`№${index + 1}`);
        drawText(`• ПІБ: ${child.name || '-'}`);
        drawText(`• Дата народження: ${child.dob || '-'}`);
        drawText(`• Проживає з: ${livesWithMap[child.lives_with] || '-'}`);
        drawText('');
    });
    drawText('Підставою для розірвання шлюбу є ті обставини, що у нас відсутні спільні інтереси з чоловіком. Наявні різні погляди на життя , відсутнє взаєморозуміння. Ми втратили почуття любові та поваги один до одного. З відповідачем спільного господарства не ведемо, сумісно нажите спірне майно відсутнє.', {x: 70, maxWidth: width - 120});
    drawText('Вважаю, що наш з відповідачем шлюб фактично припинив існування декількох років, подальше спільне життя і збереження шлюбу суперечить моїм інтересам, у звʼязку з чим наполягаю на його розірванні. Подальше сумісне життя і збереження сімʼї вважаю неможливим.');
    drawText('Шлюб ми розриваємо вперше.');
    drawText('Майнового спору не маємо.');
    drawText('За моїм глибоким переконанням подальшого сенсу підтримувати сімейні відносини немає, Вважаю що за таких умов шлюб необхідно розірвати без надання будь якого терміну на примирення.', {font: fontSemiBold,x: 70, maxWidth: width - 120});
    ////////
    drawText('Згідно зі ст.24 Сімейного кодексу України шлюб грунтується на вільній згоді жінки і чоловіка. Примушування жінки та чоловіка до шлюбу не допускається.', {x: 70, maxWidth: width - 120});
    drawText('Майнового спору не маємо.');
    drawText('Відповідно до ч.2 ст.104 Сімейного Кодексу України (далі – СК України), шлюб припиняється внаслідок його розірвання.');
    drawText('Відповідно до ч.3 ст.105 СК України, шлюб припиняється внаслідок його розірвання за позовом одного з подружжя на підставі рішення суду, відповідно до статті 110 цього Кодексу');
    drawText('Відповідно до ч.1 ст.110 СК України, позов про розірвання шлюбу може бути пред`явлений одним із подружжя.');
    drawText('Відповідно до ч.1 ст.27 Цивільного процесуального кодексу України (далі – ЦПК України), позови до фізичної особи пред’являються в суд за зареєстрованим у встановленому законом порядку місцем її проживання або перебування, якщо інше не передбачено законом.');
    drawText(`Підтверджую, що мною, ${state.data.claimant_name || '-'}, не подавалось іншого позову до ${state.data.respondent_name || '-'} чи до будь якої іншої особи з тим самим предметом та з тих самих підстав.`);
    drawText(`Повідомляю, що позивачка понесла судові витрати в розмірі: ${state.data.fee || '1211,20'} грн, інших судових витрат позивачка не понесла та не очікує понести`);
    drawText('Щодо вжиття заходів для досудового врегулювання спору, зазначаю, що заходи для досудового врегулювання спору не вживались.');
    drawText('Заходи забезпечення доказів або позову до подання позовної заяви не вживались.');
    drawText(`Додатково зазначаю, що оригінали письмових доказів, а саме: свідоцтво про шлюб І-КИ №270417 знаходиться у Позивача; паспорт: ${state.data.respondent_passport || ''} та ІПН: ${state.data.respondent_ipn || ''} Круглого Андрія Васильовича у Відповідача.`);
    drawText('Оригінал паспорту та ІПН Круглой Анни Миколаївни знаходяться в позивача.');
    y -= 20;
    drawText('На основі вищенаведеного та керуючись ст.ст.104, 105, 110, 112 та інших норм Сімейного Кодексу України, ст.ст.4, 19, 23, 27, 175, 177 та інших норм Цивільного процесуального кодексу України, інших норм діючого законодавства України.');
    y -= 20;
    drawText('ПРОШУ СУД:', { align: 'center', font: fontBold });
    y -= 20;
    drawText(`1. Розірвати шлюб між мною, ${state.data.claimant_name || '-'} та ${state.data.respondent_name || '-'}`);
    drawText(`зареєстрований ${dateObj.day} ${dateObj.monthName} ${dateObj.year} року ${state.data.marriage_registry || '__________________'}, актовий запис №${state.data.marriage_record || '___'}.`);
    drawText('2. Судові витрати покласти на позивача.');
    y -= 20;
    drawText(`«${state.data.today_date || '___'}» ${state.data.today_month || '___________'} ${state.data.today_year || '____'} року`, { font: fontBold });
    y -= 30;
    drawText(`З повагою`,{font: fontBold});
    drawText(`Позивач: _____________________ ${state.data.claimant_signature || '-'}  Кругла А.М`,{align: 'center',font: fontBold});
    drawText('');
    drawText('Додатки:',{font: fontBold});

    const photoTitles = [
        'Свідоцтво про народження дитини (копія)',
        'Свідоцтво про шлюб/про розірвання шлюбу (якщо є)',
        'Довідка про склад сім’ї або місце проживання дитини',
        'Квитанція про сплату судового збору (у деяких випадках аліменти звільнені від судового збору)'
    ];

    for (let i = 0; i < (state.attachments || []).length; i++) {
        const fileId = state.attachments[i];
        const title = photoTitles[i] || `Документ №${i + 1}`;

        if (!fileId) continue;

        try {
            const url = await bot.getFileLink(fileId);
            const res = await fetch(url);
            const imgBytes = await res.arrayBuffer();

            let img;
            try {
                img = await pdfDoc.embedPng(imgBytes);
            } catch {
                img = await pdfDoc.embedJpg(imgBytes);
            }

            const newPage = pdfDoc.addPage([600, 800]);
            const { width, height } = newPage.getSize();
            let y = height - 50;

            newPage.drawText(`• ${title}`, {
                x: 50,
                y,
                size: fontSize,
                font: fontRegular,
                color: rgb(0, 0, 0),
            });

            const scale = Math.min((width - 100) / img.width, (height - 150) / img.height, 0.7);
            const dims = img.scale(scale);

            newPage.drawImage(img, {
                x: 50,
                y: y - dims.height - 20,
                width: dims.width,
                height: dims.height,
            });
        } catch (e) {
            const errorPage = pdfDoc.addPage([600, 800]);
            errorPage.drawText(`❌ Не вдалося додати зображення (${title}): ${e.message || e}`, {
                x: 50, y: 750, size: fontSize, font: fontRegular, color: rgb(1, 0, 0),
            });
        }
    }

    return await pdfDoc.save();
}
