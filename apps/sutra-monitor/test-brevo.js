// Simple test to send email directly with Brevo
const nodemailer = require('nodemailer');
require('dotenv/config');

const apiKey = process.env.BREVO_API_KEY;
const smtpUser = process.env.BREVO_SMTP_USER;
const fromEmail = process.env.BREVO_FROM_EMAIL || '"Test" <test@example.com>';

console.log('🔧 Brevo Test Email Sender\n');
console.log('Config:');
console.log(`- API Key: ${apiKey ? apiKey.substring(0, 15) + '...' : 'NOT SET'}`);
console.log(`- SMTP User: ${smtpUser}`);
console.log(`- From Email: ${fromEmail}\n`);

if (!apiKey || !smtpUser) {
    console.error('❌ Credentials not configured!');
    process.exit(1);
}

const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
        user: smtpUser,
        pass: apiKey
    }
});

async function sendTestEmail() {
    try {
        console.log('📤 Sending test email...\n');

        const info = await transporter.sendMail({
            from: fromEmail,
            to: 'makatc@gmail.com',
            subject: '🧪 Test Email from Brevo',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Test Email</h2>
                    <p>This is a test email sent directly from Node.js using Brevo SMTP.</p>
                    <p>If you received this, Brevo is working correctly!</p>
                </div>
            `
        });

        console.log('✅ Email sent successfully!');
        console.log(`   Message ID: ${info.messageId}`);
        console.log(`   Response: ${info.response}\n`);

    } catch (error) {
        console.error('❌ Failed to send email:');
        console.error(`   Error: ${error.message}`);
        console.error(`   Code: ${error.code || 'N/A'}`);
        console.error(`   Command: ${error.command || 'N/A'}`);
        console.error(`   Response: ${error.response || 'N/A'}\n`);
    }
}

sendTestEmail();
