# LW2026 — Tareas Pendientes

> Última actualización: 2026-03-10 (TAREA 1 completada)
> Este documento se actualiza cada vez que se completa una tarea.

---

## TAREA 1 — Reimplementación sutra-monitor

### ✅ Completado

| Tarea | Descripción | Fecha |
|---|---|---|
| Scraper legislators | LegislatorsScraper (senado.pr.gov + camara.pr.gov, axios + cheerio) | 2026-03-10 |
| Scraper committees | CommitteesScraper (comisiones + membresía) | 2026-03-10 |
| Scraper bills | BillsScraper (SUTRA con Playwright, paginación) | 2026-03-10 |
| Scraper votes | VotesScraper (votaciones por medida) | 2026-03-10 |
| Scraper bill-text | BillTextScraper (pdf-parse → Gemini OCR fallback) | 2026-03-10 |
| Pipeline | PipelineService: Legislators→Committees→Bills→Votes→BillText | 2026-03-10 |
| BullMQ queues | QueueModule con workers y schedule por cola | 2026-03-10 |
| Cron scheduler | ScraperSchedulerService (@Cron fallback, auto-enable sin Redis) | 2026-03-10 |
| Bills API | GET /api/bills, /api/bills/summary, /api/bills/:id | 2026-03-10 |
| Legislators API | GET /api/legislators | 2026-03-10 |
| Committees API | GET /api/committees | 2026-03-10 |
| Votes API | GET /api/votes/:billId | 2026-03-10 |
| Scraper admin API | POST /api/scraper/trigger, GET /api/scraper/status | 2026-03-10 |
| Dashboard medidas | /medidas con filtros, búsqueda, paginación, stats | 2026-03-10 |
| Dashboard medidas/[id] | Detalle con 4 tabs: Info, Historial, Versiones, Votaciones | 2026-03-10 |
| Comparator ↔ bills | Auto-load PDFs desde query params source_pdf/target_pdf | 2026-03-10 |
| Tests scheduler | 17 tests ScraperSchedulerService (enable/disable, concurrencia) | 2026-03-10 |
| Tests scrapers | 72 tests para 5 scrapers (legislators, committees, bills, votes, bill-text) | 2026-03-10 |
| **Eventos de cambio** | ChangeEventService (DB + Node EventEmitter), integrado en 5 scrapers, GET /api/change-events, 14 tests | 2026-03-10 |
| **Entities + migraciones** | Interfaces en `@lwbeta/types`, 6 repositorios en `packages/db` (legislators, committees, votes, bill-versions, scraper-runs, change-events), migración `1773113600000_add-change-events.js` | 2026-03-10 |
| **README sutra-monitor** | Documentación completa: arquitectura, scrapers, API, env vars, setup, tests, estructura de archivos | 2026-03-10 |

---

## Otros / Infraestructura

| # | Tarea | Descripción | Estado |
|---|---|---|---|
| INF-01 | Redis en producción | BullMQ requiere Redis. En dev local funciona en modo cron-only sin Redis. | Pendiente deploy |
| INF-02 | Migraciones pendientes de aplicar | Tablas nuevas: legislators, committees, committee_memberships, votes, individual_votes, bill_versions, scraper_runs | Aplicar en staging/prod |
| INF-03 | GEMINI_API_KEY en sutra-monitor | Necesaria para OCR de PDFs escaneados. Opcional — funciona sin ella. | Pendiente configurar |
