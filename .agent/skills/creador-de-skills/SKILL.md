---
name: creador-de-skills
description: Genera nuevos skills estandarizados para Antigravity. Úsalo cuando el usuario pida crear, diseñar o estructurar una nueva habilidad.
---
# Skill: Creador de Skills (Meta-Skill)

Este skill estandariza la creación de nuevas habilidades en el entorno de Antigravity, asegurando consistencia, mantenibilidad y calidad.

## Cuándo usar este skill
- Cuando el usuario pida explícitamente "crea un skill para X".
- Cuando se necesite convertir un proceso repetitivo en una herramienta reutilizable.
- Cuando se quiera estandarizar un flujo de trabajo complejo.

## Inputs necesarios
1. **Objetivo del Skill:** ¿Qué problema resuelve?
2. **Contexto:** ¿Quién lo va a usar y para qué?
3. **Restricciones:** ¿Qué no debe hacer? ¿Qué formato es obligatorio?
4. **Material fuente (opcional):** Documentos, guías o prompts existentes.

## Workflow
1. **Analizar Solicitud:** Identificar el propósito, inputs y outputs deseados.
2. **Consultar Guía Maestra:** Leer `recursos/creador-de-skills-antigravity.md` para asegurar cumplimiento de estándares.
3. **Planificar Estructura:** Definir nombre, carpetas y archivos necesarios.
4. **Generar Contenido:**
   - Crear directorio `.agent/skills/<nombre-skill>`.
   - Redactar `SKILL.md` con YAML, triggers, workflow y output.
   - Crear recursos adicionales si son necesarios.
5. **Validar:** Verificar contra la checklist de calidad (ver `recursos/creador-de-skills-antigravity.md`).

## Checklist de Calidad (Auto-evaluación)
- [ ] ¿El nombre es corto, en minúsculas y con guiones?
- [ ] ¿Tiene frontmatter YAML correcto?
- [ ] ¿La descripción es clara y en tercera persona?
- [ ] ¿Define claramente los triggers (cuándo usarlo)?
- [ ] ¿El output está estandarizado y es predecible?

## Formato de Salida
Tu respuesta final al usuario debe confirmar la creación de:
- Carpeta: `.agent/skills/<nombre-skill>/`
- Archivo: `.agent/skills/<nombre-skill>/SKILL.md`
- Otros recursos generados.

Y debe solicitar al usuario que revise el `SKILL.md` generado.
