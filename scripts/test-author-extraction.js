const { chromium } = require('playwright');

async function testScrape() {
    console.log('🚀 Launching browser...');
    const browser = await chromium.launch({ headless: true }); // Headless true for speed, change to false if debugging needed
    const page = await browser.newPage();

    try {
        console.log('🌐 Navigating to SUTRA...');
        await page.goto('http://sutra.oslpr.org/osl/esutra/MedidaReg.aspx', { waitUntil: 'networkidle', timeout: 60000 });

        // Click the first measure link found in the sidebar (or main area if structure differs)
        // Based on scraper code: page.$$eval('a', ...)
        console.log('🔍 Finding a measure link...');
        const link = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const measureRegex = /^[A-Z]{2,4}\d+$/;
            // Find a link that looks like a measure number
            const target = links.find(l => measureRegex.test(l.innerText.trim()));
            return target ? target.href : null;
        });

        if (!link) {
            console.error('❌ No measure link found on home page.');
            return;
        }

        console.log(`🔗 Navigating to measure details: ${link}`);
        await page.goto(link, { waitUntil: 'domcontentloaded' });

        console.log('📄 Extracting details...');
        const data = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const titleMatch = bodyText.match(/Título:?\s*(.+)(\n|$)/i);
            const commissionMatch = bodyText.match(/Comisión:?\s*(.+)(\n|$)/i);
            const authorMatch = bodyText.match(/(?:Autor|Autores|Presentado por):?\s*(.+)(\n|$)/i);

            return {
                titulo: titleMatch ? titleMatch[1].trim() : 'N/A',
                comision: commissionMatch ? commissionMatch[1].trim() : 'N/A',
                author: authorMatch ? authorMatch[1].trim() : 'NOT FOUND',
                raw_preview: bodyText.substring(0, 500) // First 500 chars to debug if not found
            };
        });

        console.log('✅ Extraction Results:');
        console.log(JSON.stringify(data, null, 2));

        if (data.author !== 'NOT FOUND') {
            console.log('🎉 SUCCESS: Author extracted!');
        } else {
            console.log('⚠️ WARNING: Author not found. Check regex or page content.');
        }

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await browser.close();
    }
}

testScrape();
