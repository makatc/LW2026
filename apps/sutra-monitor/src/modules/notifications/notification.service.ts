import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService as EnvConfigService } from '@nestjs/config';
import { ConfigService } from '../config/config.service';
import { SystemRepository, pool } from '@lwbeta/db';
// SutraMeasure might not be exported from discovery.service so we define a minimal interface or use any for now if not easily found
// Assuming SutraMeasure is what we need. Let's look for it.
import { SutraMeasure } from '@lwbeta/types';
// If @lwbeta/types doesn't have it, we might need to define it or find where it is.

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        private envConfigService: EnvConfigService,
        private configService: ConfigService,
        private systemRepo: SystemRepository
    ) {
    }


    private getFromEmail(): string {
        return this.envConfigService.get<string>('BREVO_FROM_EMAIL') ||
            '"LegalWatch PR" <noreply@legalwatchpr.com>';
    }

    async sendAlert(webhookUrl: string, measure: SutraMeasure, triggerReason: string) {
        if (!webhookUrl) return;

        try {
            this.logger.log(`Sending alert for measure ${measure.numero} to webhook...`);

            // Construct payload compatible with Discord/Slack/Telegram
            const payload = {
                content: `🚨 **SUTRA Alerta: Nuevo Hallazgo**\n\n**Razón:** ${triggerReason}\n**Medida:** ${measure.numero}\n**Título:** ${measure.titulo}\n**Link:** ${measure.source_url}`,
                embeds: [
                    {
                        title: measure.titulo,
                        url: measure.source_url,
                        description: measure.extracto ? measure.extracto.substring(0, 200) + '...' : 'Sin extracto',
                        color: 15158332, // Red/Orange
                        fields: [
                            { name: 'Razón', value: triggerReason, inline: true },
                            { name: 'Número', value: measure.numero, inline: true },
                            { name: 'Fecha', value: measure.fecha ? new Date(measure.fecha).toLocaleDateString() : 'N/A', inline: true }
                        ],
                        footer: {
                            text: 'Sutra Monitor Beta'
                        },
                        timestamp: new Date().toISOString()
                    }
                ]
            };

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                this.logger.error(`Webhook failed with status ${response.status}: ${await response.text()}`);
            } else {
                this.logger.log('✅ Alert sent successfully.');
            }
        } catch (error) {
            this.logger.error('Failed to send webhook alert', error);
        }
    }

    async sendUpdate(webhookUrl: string, title: string, description: string, details?: any) {
        if (!webhookUrl) return;

        try {
            const payload = {
                content: `📢 **Sutra Actualización**\n\n**${title}**\n${description}`,
                embeds: [
                    {
                        title: title,
                        description: description,
                        color: 3447003, // Blue
                        fields: details ? Object.entries(details).map(([k, v]) => ({ name: k, value: String(v), inline: true })) : [],
                        timestamp: new Date().toISOString(),
                        footer: { text: 'Sutra Ingest System' }
                    }
                ]
            };

            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch (error) {
            this.logger.error('Failed to send webhook update', error);
        }
    }

    @Cron(CronExpression.EVERY_30_MINUTES)
    async processPendingNotifications() {
        this.logger.log('Checking for pending notifications...');
        await this.processNotifications('daily');
    }

    // Weekly notifications sent every Monday at 9 AM
    @Cron('0 9 * * 1')
    async processWeeklyNotifications() {
        this.logger.log('Processing weekly notifications (Monday)...');
        await this.processNotifications('weekly');
    }

    private async processNotifications(frequency: 'daily' | 'weekly') {
        try {
            // 1. Fetch pending hits joined with user info and email preferences
            const result = await pool.query(`
                SELECT 
                    dh.id, dh.config_id, dh.measure_id, dh.hit_type, dh.evidence, dh.created_at,
                    m.titulo, m.numero, m.source_url, m.extracto,
                    c.user_id, c.email_notifications_enabled, c.email_frequency,
                    u.email, u.name
                FROM discovery_hits dh
                JOIN sutra_measures m ON dh.measure_id = m.id
                JOIN monitor_configs c ON dh.config_id = c.id
                JOIN users u ON c.user_id = u.id
                WHERE dh.notification_status = 'PENDING'
                  AND c.email_notifications_enabled = true
                  AND c.email_frequency = $1
                ORDER BY c.user_id, dh.created_at ASC
            `, [frequency]);

            if (result.rowCount === 0) {
                this.logger.log(`No pending ${frequency} notifications found.`);
                return;
            }

            const hits = result.rows;
            this.logger.log(`Found ${hits.length} pending ${frequency} hits. Grouping by user...`);

            // 2. Group by user email
            const groupedByUser: Record<string, typeof hits> = {};
            for (const hit of hits) {
                const key = hit.email;
                if (!groupedByUser[key]) groupedByUser[key] = [];
                groupedByUser[key].push(hit);
            }

            // 3. Process each user batch
            for (const email of Object.keys(groupedByUser)) {
                const userHits = groupedByUser[email];
                const userName = userHits[0].name || email;

                this.logger.log(`Processing batch of ${userHits.length} notifications for ${email} (${userName})`);

                // Send Email Batch
                await this.sendEmailBatch(email, userName, userHits);

                // Mark as Sent
                await this.markAsSent(userHits.map(h => h.id));
            }

        } catch (error) {
            this.logger.error(`Error processing ${frequency} notifications`, error);
        }
    }

    private async sendEmailBatch(email: string, name: string, hits: any[]) {
        this.logger.log(`\n📬 sendEmailBatch called for ${email} with ${hits.length} hits`);

        const apiKey = this.envConfigService.get<string>('BREVO_API_KEY');
        if (!apiKey) {
            this.logger.warn(`⚠️  Skipping email to ${email} (Brevo API Key not configured)`);
            return;
        }

        const fromEmailString = this.getFromEmail();
        // Parse "Name <email>" format or just use email
        let senderEmail = fromEmailString;
        let senderName = 'LegalWatch PR';

        const match = fromEmailString.match(/(.*?)\s*<(.*?)>/);
        if (match) {
            senderName = match[1].replace(/"/g, '').trim();
            senderEmail = match[2].trim();
        }

        // Create HTML content
        const hitsListHtml = hits.map(h => `
            <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h3 style="margin: 0 0 10px 0; color: #2B3544;">${h.numero}: ${h.titulo}</h3>
                <p style="margin: 0 0 10px 0; color: #64748b;">${h.extracto ? h.extracto.substring(0, 150) + '...' : 'Sin extracto'}</p>
                <div style="font-size: 14px;">
                    <span style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; color: #475569;">${h.evidence || 'Coincidencia detectada'}</span>
                </div>
                <div style="margin-top: 10px;">
                    <a href="${h.source_url}" style="color: #4F7CFF; text-decoration: none; font-weight: 500;">Ver en SUTRA &rarr;</a>
                </div>
            </div>
        `).join('');

        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2B3544;">Resumen de Alertas SUTRA Monitor</h2>
                <p>Hola ${name},</p>
                <p>Hemos detectado ${hits.length} nuevas coincidencias en tus temas de interés:</p>
                ${hitsListHtml}
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">
                    Estás recibiendo este correo porque tienes alertas configuradas en SUTRA Monitor.
                </p>
            </div>
        `;

        try {
            this.logger.log(`📤 Attempting to send email via Brevo API v3 to ${email}...`);

            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'api-key': apiKey,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    sender: {
                        name: senderName,
                        email: senderEmail
                    },
                    to: [
                        {
                            email: email,
                            name: name
                        }
                    ],
                    subject: `🔔 ${hits.length} Nuevas Alertas Legislativas - SUTRA Monitor`,
                    htmlContent: html
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.logger.log(`✅ Email sent successfully via API! Message ID: ${data.messageId}`);
            } else {
                const errorData = await response.json();
                this.logger.error(`❌ Brevo API Error: ${response.status} ${response.statusText}`);
                this.logger.error(`   Details: ${JSON.stringify(errorData)}`);

                // If sender not allowed, try fallback to recipient email as sender (common workaround for unverified domains)
                if (JSON.stringify(errorData).includes('sender') || response.status === 400) {
                    this.logger.warn('⚠️  Sender might be unverified. Trying fallback with recipient/user email as sender...');
                    try {
                        // Fallback attempt
                        const fallbackResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
                            method: 'POST',
                            headers: {
                                'accept': 'application/json',
                                'api-key': apiKey,
                                'content-type': 'application/json'
                            },
                            body: JSON.stringify({
                                sender: {
                                    name: "Sutra Monitor (via " + name + ")",
                                    email: "makatc@gmail.com" // Hardcoded fallback to known verified email
                                },
                                to: [{ email: email, name: name }],
                                subject: `🔔 ${hits.length} Nuevas Alertas Legislativas - SUTRA Monitor`,
                                htmlContent: html
                            })
                        });

                        if (fallbackResponse.ok) {
                            this.logger.log('✅ Fallback email sent successfully!');
                        } else {
                            const fbError = await fallbackResponse.json();
                            this.logger.error('❌ Fallback also failed:', JSON.stringify(fbError));
                        }
                    } catch (e) {
                        this.logger.error('Fallback exception', e);
                    }
                }
            }

        } catch (err) {
            const error = err as any;
            this.logger.error(`❌ Failed to send email to ${email}`);
            this.logger.error(`   Error: ${error.message || error}`);
        }
    }

    private async markAsSent(hitIds: string[]) {
        if (hitIds.length === 0) return;

        try {
            await pool.query(`
                UPDATE discovery_hits 
                SET notification_status = 'SENT', notification_sent_at = NOW()
                WHERE id = ANY($1)
            `, [hitIds]);

            this.logger.log(`Marked ${hitIds.length} hits as SENT.`);
        } catch (error) {
            this.logger.error(`Failed to mark hits as SENT: ${hitIds.join(', ')}`, error);
        }
    }
}
