"""
PDF Report Service
==================
Converts an AnalyzeResponse into a professional consulting-grade PDF.

Layout:
  Page 1  — Title page (full-page navy background)
  Page 2  — Table of contents
  Page 3  — Market Overview
  Page 4  — Competitor Analysis
  Page 5  — Pricing Insights
  Page 6  — Demand Analysis
  Page 7  — Risk Analysis
  Page 8  — Break-Even Estimate
  Page 9  — Opportunity Score  (computed + arc gauge)

Dependencies:
    pip install reportlab
"""
from __future__ import annotations

import io
import re
from datetime import date
from typing import List, Tuple

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.flowables import Flowable

from app.schemas.analyze import AnalyzeResponse

# ---------------------------------------------------------------------------
# Brand palette
# ---------------------------------------------------------------------------

NAVY      = HexColor("#0F2044")
BLUE      = HexColor("#2563EB")
TEAL      = HexColor("#0D9488")
SLATE     = HexColor("#64748B")
LIGHT_BG  = HexColor("#F1F5F9")
BORDER    = HexColor("#E2E8F0")
DARK_TEXT = HexColor("#1E293B")
WHITE     = colors.white
GREEN     = HexColor("#10B981")
AMBER     = HexColor("#F59E0B")
RED       = HexColor("#EF4444")

# ---------------------------------------------------------------------------
# Page geometry  (A4 = 595.28 × 841.89 pts)
# ---------------------------------------------------------------------------

PAGE_W, PAGE_H = A4
MARGIN_L = 0.85 * inch
MARGIN_R = 0.85 * inch
MARGIN_T = 0.75 * inch
MARGIN_B = 0.75 * inch
FOOTER_H = 24           # points reserved at bottom for footer
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R


# ---------------------------------------------------------------------------
# Paragraph styles
# ---------------------------------------------------------------------------

def _make_styles() -> dict:
    base = dict(fontName="Helvetica", textColor=DARK_TEXT, alignment=TA_JUSTIFY)

    return {
        "body": ParagraphStyle(
            "body", fontSize=10, leading=15, spaceAfter=8, **base
        ),
        "body_bullet": ParagraphStyle(
            "body_bullet", fontSize=10, leading=15, spaceAfter=5,
            leftIndent=14, firstLineIndent=-10, **base
        ),
        "section_hdr_text": ParagraphStyle(
            "section_hdr_text", fontName="Helvetica-Bold", fontSize=13,
            leading=17, textColor=WHITE, alignment=TA_LEFT
        ),
        "toc_heading": ParagraphStyle(
            "toc_heading", fontName="Helvetica-Bold", fontSize=18,
            leading=24, textColor=NAVY, spaceAfter=20, alignment=TA_LEFT
        ),
        "toc_entry": ParagraphStyle(
            "toc_entry", fontName="Helvetica", fontSize=11, leading=20,
            textColor=DARK_TEXT, alignment=TA_LEFT
        ),
        "toc_num": ParagraphStyle(
            "toc_num", fontName="Helvetica-Bold", fontSize=11, leading=20,
            textColor=TEAL, alignment=TA_LEFT
        ),
        "score_label": ParagraphStyle(
            "score_label", fontName="Helvetica-Bold", fontSize=14, leading=20,
            textColor=NAVY, alignment=TA_CENTER, spaceAfter=6
        ),
        "score_rationale": ParagraphStyle(
            "score_rationale", fontName="Helvetica-Oblique", fontSize=10,
            leading=15, textColor=SLATE, alignment=TA_CENTER, spaceAfter=12
        ),
        "caption": ParagraphStyle(
            "caption", fontName="Helvetica-Oblique", fontSize=8, leading=12,
            textColor=SLATE, alignment=TA_CENTER
        ),
    }


# ---------------------------------------------------------------------------
# Custom flowables
# ---------------------------------------------------------------------------

class TitlePageFlowable(Flowable):
    """Full-page title page drawn entirely on the canvas."""

    def __init__(self, business_idea: str, location: str, report_date: str):
        super().__init__()
        self.business_idea = business_idea
        self.location = location
        self.report_date = report_date
        # Fill the entire page — frame origin is (0,0) for the title template
        self.width  = PAGE_W
        self.height = PAGE_H

    def draw(self):
        c = self.canv

        # ── Full-page navy background ──────────────────────────────────────
        c.setFillColor(NAVY)
        c.rect(0, 0, PAGE_W, PAGE_H, fill=True, stroke=False)

        # ── Teal accent bars (top + bottom edges) ─────────────────────────
        c.setFillColor(TEAL)
        c.rect(0, PAGE_H - 5, PAGE_W, 5,  fill=True, stroke=False)
        c.rect(0, 0,          PAGE_W, 5,  fill=True, stroke=False)

        # ── Branding (top-left) ───────────────────────────────────────────
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(MARGIN_L, PAGE_H - 38, "Valixa")

        c.setFillColor(TEAL)
        c.setFont("Helvetica", 10)
        c.drawString(MARGIN_L, PAGE_H - 54, "Market Research Report")

        # ── Decorative line ───────────────────────────────────────────────
        c.setStrokeColor(BLUE)
        c.setLineWidth(0.75)
        c.line(MARGIN_L, PAGE_H * 0.67, PAGE_W - MARGIN_R, PAGE_H * 0.67)

        # ── Business idea title ───────────────────────────────────────────
        font_size = 36 if len(self.business_idea) <= 30 else (
            28 if len(self.business_idea) <= 50 else 22
        )
        self._draw_centered_wrapped(c, self.business_idea, "Helvetica-Bold",
                                    font_size, WHITE, PAGE_H * 0.60)

        # ── Location ──────────────────────────────────────────────────────
        c.setFillColor(TEAL)
        c.setFont("Helvetica", 15)
        c.drawCentredString(PAGE_W / 2, PAGE_H * 0.46, self.location)

        # ── Second decorative line ────────────────────────────────────────
        c.setStrokeColor(HexColor("#1E3A6E"))
        c.setLineWidth(0.75)
        c.line(MARGIN_L, PAGE_H * 0.43, PAGE_W - MARGIN_R, PAGE_H * 0.43)

        # ── Date + confidential ───────────────────────────────────────────
        c.setFillColor(HexColor("#94A3B8"))
        c.setFont("Helvetica", 10)
        c.drawCentredString(PAGE_W / 2, PAGE_H * 0.395, f"Prepared: {self.report_date}")
        c.drawCentredString(PAGE_W / 2, PAGE_H * 0.366, "CONFIDENTIAL — For internal use only")

        # ── Bottom credit ─────────────────────────────────────────────────
        c.setFillColor(HexColor("#475569"))
        c.setFont("Helvetica", 8)
        c.drawCentredString(PAGE_W / 2, 20,
                            "Generated by Valixa  •  Powered by Google Gemini")

    def _draw_centered_wrapped(self, c, text: str, font: str,
                                size: float, color, y_start: float):
        """Word-wrap text and center each line around y_start."""
        c.setFont(font, size)
        words = text.split()
        lines: List[str] = []
        current: List[str] = []
        max_w = PAGE_W - 2 * MARGIN_L

        for word in words:
            candidate = " ".join(current + [word])
            if c.stringWidth(candidate, font, size) <= max_w:
                current.append(word)
            else:
                if current:
                    lines.append(" ".join(current))
                current = [word]
        if current:
            lines.append(" ".join(current))

        line_h = size * 1.3
        total_h = len(lines) * line_h
        y = y_start + total_h / 2

        c.setFillColor(color)
        for line in lines:
            c.drawCentredString(PAGE_W / 2, y, line)
            y -= line_h


class OpportunityScoreFlowable(Flowable):
    """Semi-circular arc gauge + score number for the Opportunity Score page."""

    def __init__(self, score: int, verdict: str, width: float):
        super().__init__()
        self.score   = score
        self.verdict = verdict
        self.width   = width
        self.height  = 210

    def draw(self):
        c   = self.canv
        cx  = self.width / 2
        cy  = 120
        r   = 95

        arc_color = GREEN if self.score >= 7 else (AMBER if self.score >= 5 else RED)
        fraction  = self.score / 10.0

        # ── Background track ─────────────────────────────────────────────
        c.setStrokeColor(LIGHT_BG)
        c.setLineWidth(20)
        p = c.beginPath()
        p.arc(cx - r, cy - r, cx + r, cy + r, startAng=180, extent=180)
        c.drawPath(p, stroke=1, fill=0)

        # ── Score arc ─────────────────────────────────────────────────────
        c.setStrokeColor(arc_color)
        c.setLineWidth(18)
        p = c.beginPath()
        p.arc(cx - r, cy - r, cx + r, cy + r, startAng=180, extent=fraction * 180)
        c.drawPath(p, stroke=1, fill=0)

        # ── Score number ──────────────────────────────────────────────────
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 52)
        c.drawCentredString(cx, cy - 18, str(self.score))

        c.setFillColor(SLATE)
        c.setFont("Helvetica", 11)
        c.drawCentredString(cx, cy - 36, "/ 10")

        # ── Axis labels ───────────────────────────────────────────────────
        c.setFont("Helvetica", 9)
        c.setFillColor(SLATE)
        c.drawCentredString(cx - r - 12, cy - 4, "0")
        c.drawCentredString(cx + r + 12, cy - 4, "10")

        # ── Color legend bar (below gauge) ────────────────────────────────
        bar_y  = cy - 60
        bar_w  = 180
        bar_h  = 8
        bx     = cx - bar_w / 2
        # gradient: red → amber → green (draw 3 rects)
        seg = bar_w / 3
        c.setFillColor(RED)
        c.rect(bx,          bar_y, seg,   bar_h, fill=True, stroke=False)
        c.setFillColor(AMBER)
        c.rect(bx + seg,    bar_y, seg,   bar_h, fill=True, stroke=False)
        c.setFillColor(GREEN)
        c.rect(bx + 2*seg,  bar_y, seg,   bar_h, fill=True, stroke=False)

        c.setFont("Helvetica", 7)
        c.setFillColor(SLATE)
        c.drawCentredString(bx,           bar_y - 8, "Low")
        c.drawCentredString(bx + bar_w/2, bar_y - 8, "Moderate")
        c.drawCentredString(bx + bar_w,   bar_y - 8, "High")

        # ── Verdict label ─────────────────────────────────────────────────
        c.setFillColor(arc_color)
        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(cx, 28, self.verdict)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _escape_xml(text: str) -> str:
    text = text.replace("&", "&amp;")
    text = text.replace("<", "&lt;")
    text = text.replace(">", "&gt;")
    # Convert **bold** → <b>…</b>
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"\*(.+?)\*",     r"<i>\1</i>", text)
    return text


def _text_to_paragraphs(text: str, styles: dict) -> List[Paragraph]:
    """Split AI-generated text into styled Paragraphs, handling bullets."""
    raw_blocks = re.split(r"\n{2,}", text.strip())
    result: List[Paragraph] = []

    for block in raw_blocks:
        block = block.strip()
        if not block:
            continue

        lines = block.split("\n")
        if re.match(r"^[\-•*]\s", lines[0]) or re.match(r"^\d+\.\s", lines[0]):
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                clean = re.sub(r"^[\-•*\d]+\.?\s+", "", line)
                result.append(Paragraph(f"• {_escape_xml(clean)}", styles["body_bullet"]))
        else:
            result.append(Paragraph(_escape_xml(block.replace("\n", " ")), styles["body"]))

    return result


def _section_header(title: str, icon: str, styles: dict) -> List:
    """Returns a list of flowables that form a styled section header."""
    label = f"{icon}  {title}" if icon else title
    hdr_table = Table(
        [[Paragraph(label, styles["section_hdr_text"])]],
        colWidths=[CONTENT_W],
    )
    hdr_table.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), NAVY),
        ("TOPPADDING",    (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
    ]))
    return [
        Spacer(1, 18),
        hdr_table,
        HRFlowable(width="100%", thickness=2.5, color=TEAL, spaceAfter=14),
    ]


def _toc_page(styles: dict) -> List:
    """Build the Table of Contents page."""
    sections = [
        ("01", "Market Overview"),
        ("02", "Competitor Analysis"),
        ("03", "Pricing Insights"),
        ("04", "Demand Analysis"),
        ("05", "Risk Analysis"),
        ("06", "Break-Even Estimate"),
        ("07", "Opportunity Score"),
    ]

    story: List = [
        Spacer(1, 8),
        Paragraph("Contents", styles["toc_heading"]),
        HRFlowable(width="100%", thickness=2, color=TEAL, spaceAfter=20),
    ]

    for num, title in sections:
        row_data = [[
            Paragraph(num, styles["toc_num"]),
            Paragraph(title, styles["toc_entry"]),
        ]]
        t = Table(row_data, colWidths=[36, CONTENT_W - 36])
        t.setStyle(TableStyle([
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING",    (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ]))
        story.append(t)

    story.append(PageBreak())
    return story


# ---------------------------------------------------------------------------
# Opportunity Score computation
# ---------------------------------------------------------------------------

def _compute_opportunity_score(response: AnalyzeResponse) -> Tuple[int, str, str]:
    """
    Derive a 1–10 score from keyword density in the AI-generated sections.
    Returns (score, verdict_label, one_sentence_rationale).
    """
    corpus = " ".join([
        response.market_overview,
        response.competitor_analysis,
        response.pricing_insights,
        response.demand_analysis,
        response.risk_analysis,
        response.break_even_estimate,
    ]).lower()

    positive = [
        "growing", "growth", "opportunity", "underserved", "rising demand",
        "strong demand", "favorable", "potential", "expanding", "trend",
        "increasing", "low competition", "niche",
    ]
    negative = [
        "saturated", "declining", "high risk", "barrier", "difficult",
        "challenging", "oversaturated", "shrinking", "highly competitive",
        "intense competition", "risky", "unfavorable",
    ]

    score = 5.0
    for kw in positive:
        if kw in corpus:
            score += 0.3
    for kw in negative:
        if kw in corpus:
            score -= 0.25

    score = max(1, min(10, round(score)))

    if score >= 8:
        verdict   = "Strong Opportunity"
        rationale = ("Favorable market dynamics, positive demand signals, and manageable "
                     "competition indicate a compelling entry opportunity.")
    elif score >= 6:
        verdict   = "Moderate Opportunity"
        rationale = ("Decent market potential exists. Differentiation and strong execution "
                     "will determine success against established players.")
    elif score >= 4:
        verdict   = "Cautious Opportunity"
        rationale = ("The market presents meaningful challenges. A highly differentiated "
                     "approach and disciplined cost management are essential.")
    else:
        verdict   = "High-Risk Market"
        rationale = ("Significant barriers and risk factors make this a challenging market "
                     "to enter profitably without a clear, durable competitive advantage.")

    return score, verdict, rationale


# ---------------------------------------------------------------------------
# Page callbacks
# ---------------------------------------------------------------------------

def _draw_footer(canvas, doc) -> None:
    canvas.saveState()
    y = MARGIN_B - 10
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN_L, y + 14, PAGE_W - MARGIN_R, y + 14)

    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(SLATE)
    canvas.drawString(MARGIN_L, y, "Valixa  •  Confidential")
    canvas.drawRightString(PAGE_W - MARGIN_R, y, f"Page {doc.page - 1}")
    canvas.restoreState()


# ---------------------------------------------------------------------------
# Story builder
# ---------------------------------------------------------------------------

def _build_story(response: AnalyzeResponse, styles: dict) -> List:
    report_date = date.today().strftime("%B %d, %Y")
    score, verdict, rationale = _compute_opportunity_score(response)

    story: List = []

    # ── Page 1: Title page ────────────────────────────────────────────────
    story.append(TitlePageFlowable(
        business_idea=response.business_idea.title(),
        location=response.location,
        report_date=report_date,
    ))
    story.append(NextPageTemplate("ContentPage"))
    story.append(PageBreak())

    # ── Page 2: Table of contents ─────────────────────────────────────────
    story.extend(_toc_page(styles))

    # ── Pages 3–8: Report sections ────────────────────────────────────────
    sections = [
        ("Market Overview",      "01",  response.market_overview),
        ("Competitor Analysis",  "02",  response.competitor_analysis),
        ("Pricing Insights",     "03",  response.pricing_insights),
        ("Demand Analysis",      "04",  response.demand_analysis),
        ("Risk Analysis",        "05",  response.risk_analysis),
        ("Break-Even Estimate",  "06",  response.break_even_estimate),
    ]

    for title, num, content in sections:
        story.extend(_section_header(f"{num}  {title}", "", styles))
        story.extend(_text_to_paragraphs(content, styles))
        story.append(PageBreak())

    # ── Page 9: Opportunity Score ─────────────────────────────────────────
    story.extend(_section_header("07  Opportunity Score", "", styles))
    story.append(Spacer(1, 20))
    story.append(KeepTogether([
        OpportunityScoreFlowable(score, verdict, CONTENT_W),
        Spacer(1, 14),
        Paragraph(rationale, styles["score_rationale"]),
    ]))

    # ── Score breakdown table ─────────────────────────────────────────────
    story.append(Spacer(1, 24))
    story.extend(_section_header("Score Breakdown", "", styles))

    breakdown_items = [
        ("Market Growth",       "Based on growth signals and trend language in the market overview."),
        ("Competitive Density", "Derived from competitor analysis — fewer strong incumbents scores higher."),
        ("Pricing Potential",   "Evaluated from pricing insights — room for premium positioning adds points."),
        ("Demand Signals",      "Drawn from demand analysis — clear demand patterns add positive weight."),
        ("Risk Profile",        "Risk analysis — lower risk language correlates with a higher score."),
    ]

    rows = [["Factor", "Signal Source"]]
    for factor, source in breakdown_items:
        rows.append([factor, source])

    breakdown_table = Table(rows, colWidths=[CONTENT_W * 0.35, CONTENT_W * 0.65])
    breakdown_table.setStyle(TableStyle([
        # Header row
        ("BACKGROUND",    (0, 0), (-1, 0),  NAVY),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  WHITE),
        ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0),  9),
        ("TOPPADDING",    (0, 0), (-1, 0),  8),
        ("BOTTOMPADDING", (0, 0), (-1, 0),  8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        # Data rows
        ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 1), (-1, -1), 9),
        ("LEADING",       (0, 1), (-1, -1), 14),
        ("TOPPADDING",    (0, 1), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
        ("TEXTCOLOR",     (0, 1), (-1, -1), DARK_TEXT),
        # Alternating rows
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
        # Grid
        ("GRID",          (0, 0), (-1, -1), 0.4, BORDER),
        ("FONTNAME",      (0, 1), (0, -1),  "Helvetica-Bold"),
        ("TEXTCOLOR",     (0, 1), (0, -1),  NAVY),
    ]))
    story.append(breakdown_table)

    # ── Disclaimer ────────────────────────────────────────────────────────
    story.append(Spacer(1, 28))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=10))
    story.append(Paragraph(
        "This report was generated by Valixa using language model analysis. "
        "All figures and projections are estimates for informational purposes only and "
        "do not constitute professional financial, legal, or investment advice.",
        styles["caption"],
    ))

    return story


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def generate_pdf(response: AnalyzeResponse) -> bytes:
    """
    Generate a professional PDF market research report.

    Args:
        response: Fully-populated AnalyzeResponse from the report pipeline.

    Returns:
        Raw PDF bytes suitable for streaming or file write.
    """
    styles = _make_styles()
    buffer = io.BytesIO()

    # ── Two page templates ────────────────────────────────────────────────
    # Title page: zero-margin full-page frame (flowable draws the whole page)
    title_frame = Frame(
        0, 0, PAGE_W, PAGE_H,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        id="title",
    )
    # Content pages: normal margins + space for footer
    content_frame = Frame(
        MARGIN_L, MARGIN_B + FOOTER_H,
        CONTENT_W, PAGE_H - MARGIN_T - MARGIN_B - FOOTER_H,
        id="content",
    )

    doc = BaseDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=MARGIN_L, rightMargin=MARGIN_R,
        topMargin=MARGIN_T,  bottomMargin=MARGIN_B,
        title=f"Market Research — {response.business_idea.title()}",
        author="Valixa",
        subject=f"Market analysis for {response.business_idea} in {response.location}",
    )

    title_tpl   = PageTemplate(id="TitlePage",   frames=[title_frame],   onPage=lambda c, d: None)
    content_tpl = PageTemplate(id="ContentPage", frames=[content_frame], onPage=_draw_footer)
    doc.addPageTemplates([title_tpl, content_tpl])

    story = _build_story(response, styles)
    doc.build(story)

    return buffer.getvalue()
