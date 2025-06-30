import fontkit from '@pdf-lib/fontkit';
import fetch from 'node-fetch';
import pkg, { StandardFonts } from 'pdf-lib';
const { PDFDocument, rgb } = pkg;

export async function createPdf(state, bot) {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    let page = pdfDoc.addPage([600, 800]);
    const { width, height } = page.getSize();
    const fontSize = 12;

    const fontUrl = 'https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf';

    let customFont;
    try {
        const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
        customFont = await pdfDoc.embedFont(fontBytes);
    } catch (e) {
        console.error("❌ Помилка завантаження шрифту:", e);
        customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        page.drawText('❗ Не вдалося завантажити шрифт', {
            x: 50, y: height - 50, size: 10, color: rgb(1, 0, 0)
        });
    }

    let y = height - 30;
    const drawText = (text, options = {}) => {
        if (y < 50) {
            page = pdfDoc.addPage([600, 800]);
            y = height - 30;
        }
        page.drawText(text, {
            x: options.x || 50,
            y,
            size: options.size || fontSize,
            font: customFont,
            color: options.color || rgb(0, 0, 0),
        });
        y -= (options.size || fontSize) + 5;
    };

    drawText('Дані зібрано:');
    drawText('');

    drawText(`Позивач: ${state.data.claimant_name || '-'}`);
    drawText(`Адреса: ${state.data.claimant_address || '-'}`);
    drawText(`Телефон: ${state.data.claimant_phone || '-'}`);
    drawText(`ІПН: ${state.data.claimant_ipn || '-'}`);
    drawText('');

    drawText(`Відповідач: ${state.data.respondent_name || '-'}`);
    drawText(`Адреса: ${state.data.respondent_address || '-'}`);
    drawText(`Телефон: ${state.data.respondent_phone || '-'}`);
    drawText(`Місце роботи: ${state.data.respondent_work || '-'}`);
    drawText(`ІПН: ${state.data.respondent_ipn || '-'}`);
    drawText('');

    const livesWithMap = {
        father: 'батьком',
        mother: 'матір\'ю',
        other: 'іншим'
    };

    drawText('Діти:');

    state.children.forEach((child, index) => {
        drawText(`№${index + 1}`);
        drawText(`• ПІБ: ${child.name || '-'}`);
        drawText(`• Дата народження: ${child.dob || '-'}`);
        drawText(`• Проживає з: ${livesWithMap[child.lives_with] || '-'}`);
        drawText('');
    });

    if (state.data.marriage_date) drawText(`Шлюб: ${state.data.marriage_date}`);
    if (state.data.divorce_date) drawText(`Розлучення: ${state.data.divorce_date}`);
    if (!state.data.marriage_date) drawText(`Шлюб: не був укладений`);

    drawText('');
    drawText(`Аліменти: ${state.data.alimony || '-'}`);
    drawText(`Суд: ${state.data.court_name || '-'}`);
    drawText(`Рішення раніше: ${state.data.previous_decision === true ? 'Так' : state.data.previous_decision === false ? 'Ні' : '-'}`);
    drawText(`Стягнення за минулий період: ${state.data.enforcement_period || '-'}`);
    drawText('');
    drawText('Додатки:');

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
            font: customFont,
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
            x: 50, y: 750, size: fontSize, font: customFont, color: rgb(1, 0, 0),
        });
    }
}

    return await pdfDoc.save();
}
