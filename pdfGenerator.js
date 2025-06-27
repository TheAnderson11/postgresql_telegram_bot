import fontkit from '@pdf-lib/fontkit';
import fetch from 'node-fetch';
import pkg, { StandardFonts } from 'pdf-lib';
const { PDFDocument, rgb } = pkg;

export async function createPdf(state, bot) {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    console.log(state)
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
            font: customFont,  // Используем fontUrl шрифт здесь
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
    for (const [i, child] of state.children.entries()) {
        drawText(`  №${i + 1}: ${child.name}, ${child.dob}, проживає з ${livesWithMap[child.lives_with] || '-'}`);
    }
    drawText('');

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

    for (const fileId of (state.attachments || [])) {
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

            const scale = Math.min((width - 100) / img.width, (height - 100) / img.height, 0.4);
            const dims = img.scale(scale);

            if (y < dims.height + 20) {
                page = pdfDoc.addPage([600, 800]);
                y = height - 30;
            }
            y -= dims.height + 10;

            page.drawImage(img, {
                x: 50,
                y,
                width: dims.width,
                height: dims.height,
            });
            y -= 20;
        } catch (e) {
            drawText(`❌ Не вдалося додати зображення: ${e.message || e}`);
        }
    }

    return await pdfDoc.save();
}
