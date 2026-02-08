const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    try {
        console.log('Lanzando navegador...');
        const browser = await chromium.launch();
        const page = await browser.newPage();

        console.log('Navegando a SUTRA...');
        // Navegar y esperar network idle para asegurar carga
        await page.goto('http://sutra.oslpr.org/osl/esutra/MedidaReg.aspx', { waitUntil: 'networkidle', timeout: 60000 });

        console.log('Capturando screenshot...');
        await page.screenshot({ path: 'sutra-home.png', fullPage: false });

        // Analizar estructura
        const structure = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input')).map(el => ({
                id: el.id,
                name: el.name,
                placeholder: el.placeholder,
                type: el.type
            }));

            const links = Array.from(document.querySelectorAll('a')).map(el => ({
                text: el.innerText.trim(),
                href: el.href,
                className: el.className,
                parentElementClass: el.parentElement ? el.parentElement.className : ''
            }));

            // Filtrar posibles medidas en sidebar
            const potentialMeasures = links.filter(l => /^[A-Z]{2,4}\d+$/.test(l.text));

            return { inputs, potentialMeasures };
        });

        console.log('ENLACES DE MEDIDAS DETECTADOS:');
        console.log(JSON.stringify(structure.potentialMeasures, null, 2));

        await browser.close();
    } catch (error) {
        console.error('Error durante la inspección:', error);
    }
})();
