"""
Docling Worker — FastAPI microservice for structured document parsing.

Exposes:
  GET  /health           → {"status": "ok", "docling_version": "..."}
  POST /parse            → multipart/form-data with 'file' field
                           Returns structured JSON with sections/hierarchy

Usage:
  python3 docling-worker/main.py
  (or) uvicorn main:app --host 0.0.0.0 --port 8099

Environment:
  DOCLING_PORT     Port to listen on (default: 8099)
  DOCLING_HOST     Host to bind to   (default: 127.0.0.1)
"""

import os
import sys
import tempfile
import logging
from pathlib import Path
from typing import Any

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("docling-worker")

app = FastAPI(title="Docling Worker", version="1.0.0")

# Lazy-load converter so startup is fast even if models aren't cached yet
_converter = None

def get_converter():
    global _converter
    if _converter is None:
        from docling.document_converter import DocumentConverter
        logger.info("Initializing DocumentConverter (first request may be slow)...")
        _converter = DocumentConverter()
        logger.info("DocumentConverter ready")
    return _converter


@app.get("/health")
def health():
    try:
        import docling
        version = getattr(docling, "__version__", "unknown")
    except Exception:
        version = "unknown"
    return {"status": "ok", "docling_version": version}


@app.post("/parse")
async def parse_document(file: UploadFile = File(...)):
    """
    Parse a document (PDF, DOCX) and return its structured content.

    Returns a JSON object with:
      - chunks: list of {label, type, content, level, orderIndex}
      - metadata: {pageCount, title, fileType}
      - rawText: full plain text (fallback)
    """
    suffix = Path(file.filename or "document").suffix.lower()
    if suffix not in {".pdf", ".docx", ".doc", ".txt"}:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {suffix}. Supported: .pdf .docx .doc .txt",
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        converter = get_converter()
        result = converter.convert(tmp_path)
        doc = result.document

        chunks = []
        order = 0

        # Export to markdown to get clean text, then also get structured sections
        try:
            md_text = doc.export_to_markdown()
        except Exception:
            md_text = ""

        # Extract structured elements from the document
        try:
            for element, _level in doc.iterate_items():
                element_dict = _element_to_dict(element, order)
                if element_dict:
                    chunks.append(element_dict)
                    order += 1
        except Exception as e:
            logger.warning(f"iterate_items failed: {e} — falling back to markdown")

        # If no chunks extracted, fall back to markdown-based splitting
        if not chunks and md_text:
            chunks = _split_markdown(md_text)

        # Page count
        page_count = None
        try:
            page_count = len(doc.pages) if hasattr(doc, "pages") else None
        except Exception:
            pass

        # Title
        title = None
        try:
            title = doc.name or None
        except Exception:
            pass

        return JSONResponse({
            "chunks": chunks,
            "metadata": {
                "pageCount": page_count,
                "title": title,
                "fileType": suffix.lstrip("."),
                "chunkCount": len(chunks),
            },
            "rawText": md_text,
        })

    except Exception as e:
        logger.error(f"Parsing failed for {file.filename}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Parsing failed: {str(e)[:200]}")
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


def _element_to_dict(element: Any, order: int) -> dict | None:
    """Convert a Docling document element to our chunk format."""
    try:
        # Get element type name
        type_name = type(element).__name__.lower()

        # Get text content
        text = ""
        if hasattr(element, "text"):
            text = element.text or ""
        elif hasattr(element, "export_to_markdown"):
            text = element.export_to_markdown() or ""

        text = text.strip()
        if not text or len(text) < 2:
            return None

        # Map Docling types to our chunk types
        chunk_type = "paragraph"
        label = f"Párrafo {order + 1}"

        if "sectionheader" in type_name or "heading" in type_name:
            chunk_type = "section"
            label = text[:80]
        elif "title" in type_name:
            chunk_type = "section"
            label = text[:80]
        elif "table" in type_name:
            chunk_type = "paragraph"
            label = f"Tabla {order + 1}"
        elif "listitem" in type_name or "list" in type_name:
            chunk_type = "paragraph"
            label = f"Lista {order + 1}"

        # Try to detect article/section patterns in the label
        import re
        art_match = re.match(r"^(ART[ÍI]CULO|Art\.?|ARTICULO)\s+(\d+[A-Za-z]?)", label, re.I)
        cap_match = re.match(r"^(CAP[ÍI]TULO|CAPITULO)\s+([IVX]+|\d+)", label, re.I)
        sec_match = re.match(r"^(SECCI[ÓO]N|SECCION)\s+([IVX]+|\d+)", label, re.I)

        if art_match:
            chunk_type = "article"
            label = f"Artículo {art_match.group(2).upper()}"
        elif cap_match:
            chunk_type = "chapter"
            label = f"Capítulo {cap_match.group(2).upper()}"
        elif sec_match:
            chunk_type = "section"
            label = f"Sección {sec_match.group(2)}"

        # Level (heading hierarchy)
        level = 0
        if hasattr(element, "level"):
            level = element.level or 0

        return {
            "label": label,
            "type": chunk_type,
            "content": text,
            "level": level,
            "orderIndex": order,
        }
    except Exception:
        return None


def _split_markdown(md: str) -> list[dict]:
    """Fallback: split markdown text by headings into chunks."""
    import re
    chunks = []
    current_label = "Documento"
    current_lines: list[str] = []
    order = 0

    for line in md.split("\n"):
        heading = re.match(r"^(#{1,4})\s+(.+)$", line)
        if heading:
            if current_lines:
                chunks.append({
                    "label": current_label,
                    "type": "section",
                    "content": "\n".join(current_lines).strip(),
                    "level": 0,
                    "orderIndex": order,
                })
                order += 1
                current_lines = []
            current_label = heading.group(2).strip()[:80]
        else:
            current_lines.append(line)

    if current_lines:
        chunks.append({
            "label": current_label,
            "type": "section",
            "content": "\n".join(current_lines).strip(),
            "level": 0,
            "orderIndex": order,
        })

    return [c for c in chunks if c["content"].strip()]


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("DOCLING_HOST", "127.0.0.1")
    port = int(os.environ.get("DOCLING_PORT", "8099"))
    logger.info(f"Starting Docling Worker on {host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")
