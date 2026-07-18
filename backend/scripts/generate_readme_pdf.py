from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
README_PATH = ROOT / "README.md"
OUTPUT_PATH = ROOT / "README_Highlighted.pdf"

IMPORTANT_TOPICS = {
    "Why This Project Is AI-Powered",
    "Current AI Approach",
    "Tech Stack Used",
    "Toolkit Notes",
    "Features Implemented",
    "Approaches Used in This Project",
    "What Is Still Not Fully AI/ML Yet",
    "Future Improvements",
    "Q and A",
}


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="ProjectTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=15,
            textColor=colors.HexColor("#1f2937"),
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H1",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=10,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H2",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=17,
            textColor=colors.HexColor("#1d4ed8"),
            spaceBefore=8,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H3",
            parent=styles["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=15,
            textColor=colors.HexColor("#0f766e"),
            spaceBefore=6,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BulletText",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=14,
            leftIndent=0,
            textColor=colors.HexColor("#1f2937"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="CodeBlock",
            parent=styles["Code"],
            fontName="Courier",
            fontSize=8.8,
            leading=11,
            leftIndent=8,
            rightIndent=8,
            textColor=colors.HexColor("#111827"),
            backColor=colors.HexColor("#f3f4f6"),
            borderPadding=8,
            borderColor=colors.HexColor("#d1d5db"),
            borderWidth=0.5,
            borderRadius=4,
            spaceBefore=4,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Callout",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9.5,
            leading=12,
            textColor=colors.HexColor("#7c2d12"),
        )
    )
    return styles


def inline_markup(text):
    text = (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    text = re.sub(r"`([^`]+)`", r"<font face='Courier'>\1</font>", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    return text


def highlight_box(text, styles):
    table = Table(
        [[Paragraph("IMPORTANT TOPIC", styles["Callout"]), Paragraph(text, styles["H2"])]],
        colWidths=[38 * mm, 130 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff7ed")),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#fdba74")),
                ("LINEAFTER", (0, 0), (0, 0), 0.8, colors.HexColor("#fdba74")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return table


def parse_markdown(lines, styles):
    story = []
    in_code = False
    code_lines = []
    paragraph_lines = []
    bullet_lines = []

    def flush_paragraph():
        nonlocal paragraph_lines
        if paragraph_lines:
            text = " ".join(part.strip() for part in paragraph_lines if part.strip())
            if text:
                story.append(Paragraph(inline_markup(text), styles["Body"]))
            paragraph_lines = []

    def flush_bullets():
        nonlocal bullet_lines
        if bullet_lines:
            items = [
                ListItem(Paragraph(inline_markup(item), styles["BulletText"]))
                for item in bullet_lines
            ]
            story.append(
                ListFlowable(
                    items,
                    bulletType="bullet",
                    start="circle",
                    leftIndent=18,
                    bulletFontName="Helvetica",
                )
            )
            story.append(Spacer(1, 4))
            bullet_lines = []

    def flush_code():
        nonlocal code_lines
        if code_lines:
            story.append(Preformatted("\n".join(code_lines), styles["CodeBlock"]))
            code_lines = []

    for raw_line in lines:
        line = raw_line.rstrip("\n")

        if line.startswith("```"):
            flush_paragraph()
            flush_bullets()
            if in_code:
                flush_code()
                in_code = False
            else:
                in_code = True
            continue

        if in_code:
            code_lines.append(line)
            continue

        if not line.strip():
            flush_paragraph()
            flush_bullets()
            continue

        heading_match = re.match(r"^(#{1,6})\s+(.*)$", line)
        if heading_match:
            flush_paragraph()
            flush_bullets()
            level = len(heading_match.group(1))
            text = heading_match.group(2).strip()
            if level == 1:
                story.append(Paragraph(inline_markup(text), styles["ProjectTitle"]))
                story.append(Spacer(1, 4))
            elif text in IMPORTANT_TOPICS:
                story.append(Spacer(1, 6))
                story.append(highlight_box(inline_markup(text), styles))
                story.append(Spacer(1, 6))
            elif level == 2:
                story.append(Paragraph(inline_markup(text), styles["H1"]))
            elif level == 3:
                story.append(Paragraph(inline_markup(text), styles["H2"]))
            else:
                story.append(Paragraph(inline_markup(text), styles["H3"]))
            continue

        bullet_match = re.match(r"^\s*[-*]\s+(.*)$", line)
        numbered_match = re.match(r"^\s*\d+\.\s+(.*)$", line)
        if bullet_match:
            flush_paragraph()
            bullet_lines.append(bullet_match.group(1).strip())
            continue
        if numbered_match:
            flush_paragraph()
            bullet_lines.append(numbered_match.group(1).strip())
            continue

        paragraph_lines.append(line)

    flush_paragraph()
    flush_bullets()
    flush_code()
    return story


def add_page_decor(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(colors.HexColor("#eff6ff"))
    canvas.rect(0, height - 18 * mm, width, 18 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#0f172a"))
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(18 * mm, height - 11 * mm, "AI-Powered Crypto Market Project Notes")
    canvas.setFont("Helvetica", 9)
    canvas.drawRightString(width - 18 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def main():
    styles = build_styles()
    lines = README_PATH.read_text(encoding="utf-8").splitlines()
    story = parse_markdown(lines, styles)
    story.insert(
        1,
        Paragraph(
            "Highlighted PDF version of the project README with emphasis on core AI topics, toolkit notes, features, and revision Q&amp;A.",
            styles["Body"],
        ),
    )
    story.insert(2, Spacer(1, 8))

    doc = SimpleDocTemplate(
        str(OUTPUT_PATH),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=24 * mm,
        bottomMargin=16 * mm,
        title="AI-Powered Crypto Market Prediction and Portfolio Recommendation System",
        author="Codex",
    )
    doc.build(story, onFirstPage=add_page_decor, onLaterPages=add_page_decor)
    print(f"Generated PDF: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
