export const AI_SUMMARIES_CONSTANTS = {
  GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  GEMINI_MODEL: 'gemini-2.0-flash',
  SUMMARY_CACHE_HOURS: 24,
  AUDIO_BRIEFING_CRON: '0 6 * * *', // 6:00 AM Puerto Rico (UTC-4, so 10:00 AM UTC)
  QUEUE_AI_SUMMARY: 'ai-summary-queue',
  QUEUE_AUDIO_BRIEFING: 'audio-briefing-queue',
} as const;

export type SummaryType = 'executive' | 'technical_legal' | 'tweet';
