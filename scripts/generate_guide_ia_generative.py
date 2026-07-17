from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "guide-pratique-ia-generative-formaprompt.pdf"
PUBLIC_COPY = ROOT / "webapp" / "public" / "assets" / "guide-pratique-ia-generative-formaprompt.pdf"
LOGO = ROOT / "webapp" / "public" / "assets" / "logo-new.png"
CROPPED_LOGO = ROOT / "tmp" / "pdfs" / "guide-ia" / "logo-formaprompt-cropped.png"

PAGE_WIDTH, PAGE_HEIGHT = A4
GREEN = colors.HexColor("#047857")
GREEN_BRIGHT = colors.HexColor("#059669")
GREEN_PALE = colors.HexColor("#ECFDF5")
GREEN_LINE = colors.HexColor("#A7F3D0")
NAVY = colors.HexColor("#0F172A")
SLATE = colors.HexColor("#334155")
MUTED = colors.HexColor("#64748B")
LIGHT = colors.HexColor("#F8FAFC")
BORDER = colors.HexColor("#CBD5E1")
AMBER = colors.HexColor("#92400E")
AMBER_PALE = colors.HexColor("#FFFBEB")
RED = colors.HexColor("#991B1B")
RED_PALE = colors.HexColor("#FEF2F2")
WHITE = colors.white


def register_fonts():
    font_dir = Path("C:/Windows/Fonts")
    pdfmetrics.registerFont(TTFont("Arial", str(font_dir / "arial.ttf")))
    pdfmetrics.registerFont(TTFont("Arial-Bold", str(font_dir / "arialbd.ttf")))
    pdfmetrics.registerFont(TTFont("Arial-Italic", str(font_dir / "ariali.ttf")))
    pdfmetrics.registerFontFamily(
        "Arial",
        normal="Arial",
        bold="Arial-Bold",
        italic="Arial-Italic",
        boldItalic="Arial-Bold",
    )


register_fonts()

sample = getSampleStyleSheet()
styles = {
    "cover_title": ParagraphStyle(
        "CoverTitle",
        parent=sample["Title"],
        fontName="Arial-Bold",
        fontSize=27,
        leading=32,
        textColor=NAVY,
        alignment=TA_CENTER,
        spaceAfter=7 * mm,
    ),
    "cover_subtitle": ParagraphStyle(
        "CoverSubtitle",
        parent=sample["BodyText"],
        fontName="Arial",
        fontSize=14,
        leading=20,
        textColor=SLATE,
        alignment=TA_CENTER,
        spaceAfter=5 * mm,
    ),
    "cover_eyebrow": ParagraphStyle(
        "CoverEyebrow",
        parent=sample["BodyText"],
        fontName="Arial-Bold",
        fontSize=9,
        leading=12,
        textColor=GREEN,
        alignment=TA_CENTER,
        spaceAfter=4 * mm,
    ),
    "h1": ParagraphStyle(
        "H1",
        parent=sample["Heading1"],
        fontName="Arial-Bold",
        fontSize=21,
        leading=25,
        textColor=NAVY,
        spaceAfter=5 * mm,
    ),
    "eyebrow": ParagraphStyle(
        "Eyebrow",
        parent=sample["BodyText"],
        fontName="Arial-Bold",
        fontSize=9,
        leading=12,
        textColor=GREEN,
        spaceAfter=1.5 * mm,
    ),
    "h2": ParagraphStyle(
        "H2",
        parent=sample["Heading2"],
        fontName="Arial-Bold",
        fontSize=13.5,
        leading=17,
        textColor=GREEN,
        spaceBefore=2.5 * mm,
        spaceAfter=2.5 * mm,
    ),
    "h3": ParagraphStyle(
        "H3",
        parent=sample["Heading3"],
        fontName="Arial-Bold",
        fontSize=10.5,
        leading=14,
        textColor=NAVY,
        spaceAfter=1.5 * mm,
    ),
    "body": ParagraphStyle(
        "Body",
        parent=sample["BodyText"],
        fontName="Arial",
        fontSize=9.5,
        leading=13.6,
        textColor=SLATE,
        spaceAfter=2.4 * mm,
    ),
    "small": ParagraphStyle(
        "Small",
        parent=sample["BodyText"],
        fontName="Arial",
        fontSize=8.2,
        leading=11.2,
        textColor=MUTED,
    ),
    "bullet": ParagraphStyle(
        "Bullet",
        parent=sample["BodyText"],
        fontName="Arial",
        fontSize=9.2,
        leading=13.2,
        leftIndent=5 * mm,
        firstLineIndent=-4 * mm,
        textColor=SLATE,
        spaceAfter=1.6 * mm,
    ),
    "number": ParagraphStyle(
        "Number",
        parent=sample["BodyText"],
        fontName="Arial",
        fontSize=9.2,
        leading=13.2,
        leftIndent=7 * mm,
        firstLineIndent=-6 * mm,
        textColor=SLATE,
        spaceAfter=1.8 * mm,
    ),
    "table_header": ParagraphStyle(
        "TableHeader",
        parent=sample["BodyText"],
        fontName="Arial-Bold",
        fontSize=8.5,
        leading=11,
        textColor=WHITE,
    ),
    "table_cell": ParagraphStyle(
        "TableCell",
        parent=sample["BodyText"],
        fontName="Arial",
        fontSize=8.1,
        leading=11,
        textColor=SLATE,
    ),
    "table_cell_bold": ParagraphStyle(
        "TableCellBold",
        parent=sample["BodyText"],
        fontName="Arial-Bold",
        fontSize=8.1,
        leading=11,
        textColor=NAVY,
    ),
    "callout": ParagraphStyle(
        "Callout",
        parent=sample["BodyText"],
        fontName="Arial",
        fontSize=9.2,
        leading=13.2,
        textColor=SLATE,
    ),
    "prompt": ParagraphStyle(
        "Prompt",
        parent=sample["Code"],
        fontName="Arial",
        fontSize=8.5,
        leading=12.2,
        textColor=NAVY,
    ),
}


class GuideDocTemplate(SimpleDocTemplate):
    """Ajoute des signets pour faciliter la navigation dans le guide."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._bookmark_index = 0

    def afterFlowable(self, flowable):
        if not isinstance(flowable, Paragraph):
            return
        levels = {"CoverTitle": 0, "H1": 0, "H2": 1}
        level = levels.get(flowable.style.name)
        if level is None:
            return
        self._bookmark_index += 1
        key = f"section-{self._bookmark_index}"
        title = flowable.getPlainText().replace("\n", " ").strip()
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(title, key, level=level, closed=False)


def p(text, style="body"):
    return Paragraph(text, styles[style])


def bullets(items):
    return [p(f"• {item}", "bullet") for item in items]


def numbered(items):
    return [p(f"<b>{index}.</b> {item}", "number") for index, item in enumerate(items, 1)]


def page_title(kicker, title, intro=None):
    result = [p(kicker.upper(), "eyebrow"), p(title, "h1")]
    if intro:
        result.append(p(intro))
    return result


def callout(title, body, tone="green"):
    palette = {
        "green": (GREEN_PALE, GREEN_LINE, GREEN),
        "amber": (AMBER_PALE, colors.HexColor("#FCD34D"), AMBER),
        "red": (RED_PALE, colors.HexColor("#FCA5A5"), RED),
        "gray": (LIGHT, BORDER, NAVY),
    }
    background, border, title_color = palette[tone]
    data = [[Paragraph(f"<b><font color='{title_color.hexval()}'>{title}</font></b><br/>{body}", styles["callout"])]]
    table = Table(data, colWidths=[171 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), background),
                ("BOX", (0, 0), (-1, -1), 0.8, border),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3.3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.3 * mm),
            ]
        )
    )
    return KeepTogether([table, Spacer(1, 3 * mm)])


def content_table(headers, rows, widths):
    data = [[p(cell, "table_header") for cell in headers]]
    for row in rows:
        data.append([p(cell, "table_cell_bold" if index == 0 else "table_cell") for index, cell in enumerate(row)])
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GREEN),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT]),
                ("LEFTPADDING", (0, 0), (-1, -1), 2.6 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2.6 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
            ]
        )
    )
    return table


def worksheet(rows, label_width=48 * mm):
    data = []
    for label, help_text in rows:
        data.append(
            [
                p(label, "table_cell_bold"),
                Paragraph(f"<font color='{MUTED.hexval()}'>{help_text}</font><br/><br/>................................................................................................", styles["table_cell"]),
            ]
        )
    table = Table(data, colWidths=[label_width, 171 * mm - label_width])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.6, BORDER),
                ("BACKGROUND", (0, 0), (0, -1), GREEN_PALE),
                ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    return table


def prompt_box(text):
    box = Table([[p(text.replace("\n", "<br/>"), "prompt")]], colWidths=[171 * mm])
    box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.8, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    return box


def prepare_logo():
    """Retire les grandes marges blanches du logo source pour la couverture."""
    CROPPED_LOGO.parent.mkdir(parents=True, exist_ok=True)
    image = PILImage.open(LOGO).convert("RGB")
    grayscale = image.convert("L")
    mask = grayscale.point(lambda value: 255 if value < 220 else 0)
    box = mask.getbbox()
    if box:
        left, top, right, bottom = box
        margin = 18
        box = (
            max(0, left - margin),
            max(0, top - margin),
            min(image.width, right + margin),
            min(image.height, bottom + margin),
        )
        image = image.crop(box)
    image.save(CROPPED_LOGO, optimize=True)


def cover_page(canvas, doc):
    canvas.saveState()
    canvas.setTitle("Guide pratique - IA générative")
    canvas.setAuthor("FormaPrompt - Thierry FREZARD")
    canvas.setSubject("Support pédagogique de la formation IA générative")
    canvas.setKeywords("IA générative, prompt, vérification, formation, FormaPrompt")
    canvas.setFillColor(GREEN)
    canvas.rect(0, PAGE_HEIGHT - 19 * mm, PAGE_WIDTH, 19 * mm, fill=1, stroke=0)
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_WIDTH, 24 * mm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Arial", 8.5)
    canvas.drawCentredString(PAGE_WIDTH / 2, 10 * mm, "FormaPrompt - Formation IA & Bureautique")
    canvas.restoreState()


def regular_page(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(GREEN_LINE)
    canvas.setLineWidth(0.7)
    canvas.line(20 * mm, PAGE_HEIGHT - 16 * mm, PAGE_WIDTH - 20 * mm, PAGE_HEIGHT - 16 * mm)
    canvas.setFont("Arial-Bold", 8)
    canvas.setFillColor(GREEN)
    canvas.drawString(20 * mm, PAGE_HEIGHT - 12 * mm, "FORMAPROMPT")
    canvas.setFont("Arial", 8)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, PAGE_HEIGHT - 12 * mm, "Guide pratique - IA générative")
    canvas.setStrokeColor(BORDER)
    canvas.line(20 * mm, 15 * mm, PAGE_WIDTH - 20 * mm, 15 * mm)
    canvas.setFont("Arial", 8)
    canvas.drawString(20 * mm, 10 * mm, "Version juillet 2026")
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_story():
    story = []

    # 1 - Couverture
    story.extend(
        [
            Spacer(1, 26 * mm),
            Image(str(CROPPED_LOGO), width=66 * mm, height=45 * mm, kind="proportional"),
            Spacer(1, 8 * mm),
            p("GUIDE PRATIQUE", "cover_eyebrow"),
            p("IA générative :<br/>comprendre, pratiquer et sécuriser ses usages", "cover_title"),
            p("Le support pas à pas de votre parcours de 10 heures", "cover_subtitle"),
            callout(
                "À quoi sert ce guide ?",
                "À préparer vos séances, structurer vos demandes, conserver vos essais et vérifier chaque résultat avant de l’utiliser. Il complète les cinq modules de l’espace apprenant ; il ne remplace ni les échanges avec le formateur ni les règles de votre organisation.",
            ),
            Spacer(1, 5 * mm),
            p("Conçu pour les adultes qui débutent avec les assistants d’IA", "cover_subtitle"),
        ]
    )
    story.append(PageBreak())

    # 2 - Parcours
    story.extend(page_title("Mode d’emploi", "Votre parcours en cinq modules", "Avancez dans l’ordre. Après chaque apport, testez la méthode sur un cas simple, puis enregistrez votre exercice dans l’espace apprenant."))
    story.append(
        content_table(
            ["Module", "Compétence travaillée", "Production attendue"],
            [
                ["1 · Comprendre", "Choisir une tâche adaptée et mesurer le niveau de vigilance.", "Une cartographie de cinq tâches."],
                ["2 · Dialoguer", "Transformer une demande vague en consigne claire et vérifiable.", "Une consigne structurée et comparée."],
                ["3 · Produire", "Créer deux versions, les comparer et finaliser un livrable.", "Un contenu professionnel vérifié."],
                ["4 · Vérifier", "Contrôler les faits, sources, données, droits, biais et décisions.", "Une grille de vérification complétée."],
                ["5 · Agir", "Préparer une expérimentation responsable et réaliste sous 30 jours.", "Une fiche action d’une page."],
            ],
            [28 * mm, 82 * mm, 61 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.extend(numbered([
        "Lisez l’explication du module avant la séance ou avec le formateur.",
        "Reproduisez la démonstration sur un exemple fictif ou non confidentiel.",
        "Réalisez l’exercice. Enregistrez d’abord un brouillon, puis déclarez-le terminé lorsqu’il respecte les critères.",
        "Consultez le retour du formateur et créez une nouvelle version si une reprise est demandée.",
        "Après les cinq modules, préparez les quatre livrables du cas pratique final.",
    ]))
    story.append(callout("Réflexe de départ", "N’entrez jamais de nom, d’adresse, de dossier client, de donnée de santé, de mot de passe ou d’information confidentielle dans un outil qui n’est pas explicitement autorisé par votre organisation.", "red"))
    story.append(p("Dans l’espace apprenant", "h2"))
    story.extend(bullets([
        "Les onglets <b>Supports et liens</b>, <b>Exercices pratiques</b> et <b>Lexique</b> restent accessibles en bas du cours.",
        "La progression compte les exercices déclarés terminés ; un brouillon reste simplement en cours.",
        "Les corrections conservent l’historique : une nouvelle version n’efface pas les précédentes.",
    ]))
    story.append(PageBreak())

    # 3 - Module 1
    story.extend(page_title("Module 1 · 2 h", "Comprendre l’IA générative et choisir le bon usage", "Une IA générative produit une réponse probable. Elle peut aider à préparer, reformuler ou organiser, mais elle ne garantit ni la vérité ni la pertinence de ses décisions."))
    story.append(p("Les trois questions avant d’ouvrir l’outil", "h2"))
    story.extend(numbered([
        "<b>Quel résultat concret est attendu ?</b> Un courriel, un plan, une synthèse, des idées ou un tableau.",
        "<b>Quelles informations sont nécessaires et autorisées ?</b> Retirez tout ce qui n’est pas indispensable.",
        "<b>Qui vérifiera et décidera ?</b> Plus l’erreur aurait de conséquences, plus le contrôle humain doit être renforcé.",
    ]))
    story.append(
        content_table(
            ["Situation", "Place possible de l’IA", "Vigilance"],
            [
                ["Invitation générique à une réunion", "Proposer une première rédaction à partir de faits fournis.", "Relire les dates, le ton et les consignes."],
                ["Résumé d’une note interne", "Possible seulement avec un outil autorisé et un document minimisé.", "Contrôler les idées et les données transmises."],
                ["Sanction, recrutement ou décision de santé", "Ne pas déléguer la décision à l’IA.", "Décision humaine selon les règles applicables."],
            ],
            [47 * mm, 73 * mm, 51 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(p("Mini-activité : cartographier vos usages", "h2"))
    story.extend(bullets([
        "Une tâche adaptée : simple, réversible, sans donnée sensible, résultat facile à vérifier.",
        "Une tâche à contrôle renforcé : faits importants, document interne ou conséquence possible pour une personne.",
        "Une tâche à ne pas déléguer : décision sensible, obligation réglementaire ou action impossible à corriger.",
    ]))
    story.append(callout("À retenir", "Une réponse bien rédigée peut être fausse. L’IA prépare une proposition ; une personne compétente vérifie, choisit et assume la diffusion."))
    story.append(p("Mes trois exemples", "h2"))
    story.append(worksheet([
        ("Usage adapté", "Tâche simple que je pourrais tester"),
        ("Contrôle renforcé", "Tâche pour laquelle je dois ajouter des vérifications"),
        ("À ne pas déléguer", "Décision qui doit rester entièrement humaine"),
    ]))
    story.append(PageBreak())

    # 4 - Module 2
    story.extend(page_title("Module 2 · 2 h", "Structurer une demande claire et testable", "Un prompt n’est pas une formule magique. C’est une consigne de travail que vous pouvez préciser, tester et améliorer."))
    story.append(p("Les sept repères d’une consigne utile", "h2"))
    story.append(
        content_table(
            ["Repère", "Question à se poser", "Exemple"],
            [
                ["1. Objectif", "Quel livrable dois-je obtenir ?", "Rédiger un courriel de rappel."],
                ["2. Contexte", "Que faut-il savoir pour comprendre ?", "Classe virtuelle pour adultes débutants."],
                ["3. Public", "Qui lira ou utilisera le résultat ?", "Participants peu à l’aise avec le numérique."],
                ["4. Informations", "Quels faits ou sources sont autorisés ?", "Horaire, durée et consignes validées."],
                ["5. Contraintes", "Que faut-il respecter ou éviter ?", "180 mots, ton rassurant, ne rien inventer."],
                ["6. Format", "Sous quelle forme livrer le résultat ?", "Objet, introduction, liste à puces, conclusion."],
                ["7. Critères", "Comment saurai-je que c’est réussi ?", "Exact, lisible et orienté vers trois actions."],
            ],
            [28 * mm, 72 * mm, 71 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(p("Avant / après", "h2"))
    story.append(callout("Demande trop vague", "« Fais-moi un bon mail pour rappeler la formation aux participants. »", "amber"))
    story.append(callout("Demande structurée", "« Rédige un courriel de rappel destiné à des adultes inscrits à une classe virtuelle. Ils doivent tester leur connexion et rejoindre la séance dix minutes avant. Utilise uniquement les informations que je fournirai. Ton professionnel et rassurant, 180 mots maximum, objet puis liste à puces. N’invente aucune date ni aucun lien ; pose-moi une question si une information essentielle manque. »"))
    story.append(p("Pourquoi la seconde version aide davantage", "h2"))
    story.extend(bullets([
        "Le livrable, le public et l’action attendue sont visibles.",
        "Le format et les critères facilitent la relecture.",
        "L’IA doit signaler les informations manquantes au lieu de les inventer.",
        "Aucun nom ni courriel de participant n’est nécessaire.",
    ]))
    story.append(PageBreak())

    # 5 - Fiche prompt
    story.extend(page_title("Outil imprimable", "Ma fiche pour préparer une consigne", "Complétez d’abord cette page. Copiez ensuite uniquement les rubriques utiles dans l’assistant autorisé."))
    story.append(worksheet([
        ("Objectif", "Je veux obtenir…"),
        ("Contexte utile", "La situation à comprendre, sans donnée inutile…"),
        ("Public", "La personne qui recevra le résultat et son niveau…"),
        ("Informations autorisées", "Les faits ou la source que l’IA peut utiliser…"),
        ("Contraintes", "Le ton, la longueur, les éléments obligatoires et ceux à éviter…"),
        ("Format attendu", "La structure précise du résultat…"),
        ("Critères de réussite", "Trois éléments observables qui permettront de juger le résultat…"),
        ("Contrôle humain", "La personne, les sources et les vérifications avant utilisation…"),
    ]))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Modèle à copier", "h2"))
    story.append(prompt_box(
        "Objectif : préparer [livrable attendu].\n"
        "Contexte utile : [situation, sans donnée personnelle ou confidentielle].\n"
        "Public destinataire : [fonction et niveau de connaissance].\n"
        "Informations à utiliser : [faits ou source autorisée].\n"
        "Contraintes : [ton, longueur, éléments obligatoires et éléments à éviter].\n"
        "Format attendu : [structure précise].\n"
        "Critères de réussite : [trois critères observables].\n\n"
        "Avant de produire le résultat, pose-moi jusqu’à trois questions si une information essentielle manque."
    ))
    story.append(PageBreak())

    # 6 - Module 3
    story.extend(page_title("Module 3 · 2 h", "Produire un contenu professionnel sans perdre la maîtrise", "Le résultat de l’IA est une version de travail. La version finale appartient à la personne qui la relit, la corrige et décide de la diffuser."))
    story.append(p("Le workflow en cinq étapes", "h2"))
    story.extend(numbered([
        "<b>Préparer la source.</b> Rassemblez les faits autorisés et signalez ce qui reste à confirmer.",
        "<b>Définir le destinataire.</b> Précisez ce qu’il doit comprendre ou faire.",
        "<b>Produire deux versions.</b> Par exemple, une version directe et une version pédagogique.",
        "<b>Comparer avec les mêmes critères.</b> Fidélité, clarté, adaptation au public et risque d’interprétation.",
        "<b>Assembler puis vérifier.</b> Conservez les meilleurs éléments et contrôlez chaque fait dans la source.",
    ]))
    story.append(
        content_table(
            ["Critère", "Version A", "Version B", "Décision"],
            [
                ["Fidélité", "Tous les faits fournis sont repris.", "Même contenu, sans ajout.", "Les deux sont conformes."],
                ["Clarté", "Annonce courte puis informations.", "Transitions plus développées.", "Garder l’annonce de A."],
                ["Public débutant", "Liste présente mais très brève.", "Actions dans l’ordre, mots simples.", "Garder le guidage de B."],
                ["Risque", "Aucun motif inventé.", "Aucun motif inventé.", "Ne rien ajouter sans source."],
            ],
            [30 * mm, 44 * mm, 52 * mm, 45 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(p("Modèle pour comparer deux versions", "h2"))
    story.append(prompt_box(
        "Prépare deux versions de [type de contenu] sur [sujet] pour [public].\n"
        "Version A : directe et synthétique. Version B : pédagogique, avec un exemple concret.\n"
        "Utilise uniquement [source ou faits autorisés]. Limite chaque version à [longueur]. N’invente aucun fait ni aucune source et signale les informations à confirmer.\n"
        "Termine par un tableau comparant clarté, précision, adaptation au public et risques d’interprétation."
    ))
    story.append(callout("Contrôle final", "Relisez le texte comme si vous ne connaissiez pas le sujet. Vérifiez les noms, chiffres, dates, liens, citations, consignes et actions attendues dans leur source d’origine.", "amber"))
    story.append(PageBreak())

    # 7 - Module 4
    story.extend(page_title("Module 4 · 2 h", "Vérifier, sécuriser et décider avant diffusion", "Quand un fait est important ou qu’une erreur peut affecter une personne, suspendez la diffusion jusqu’à la fin du contrôle."))
    story.append(p("La procédure d’audit", "h2"))
    story.extend(numbered([
        "<b>Cadrer.</b> Identifiez le contenu, son usage, son public et les conséquences possibles d’une erreur.",
        "<b>Repérer.</b> Surlignez les faits, chiffres, dates, références et formulations trop affirmatives.",
        "<b>Vérifier.</b> Ouvrez les sources d’origine. Une source proposée par l’IA n’est pas une preuve tant qu’elle n’a pas été consultée.",
        "<b>Examiner les risques.</b> Données, confidentialité, droits, biais, stéréotypes, personnes affectées et règles internes.",
        "<b>Décider et tracer.</b> Utiliser après contrôle, corriger ou rejeter ; notez qui a vérifié, quand et à partir de quelles sources.",
    ]))
    story.append(
        content_table(
            ["Contrôle", "Question simple", "Preuve à conserver"],
            [
                ["Faits et sources", "Puis-je retrouver l’information dans une source fiable et datée ?", "Lien, titre, auteur, date de consultation."],
                ["Données", "Ai-je transmis uniquement des données autorisées et nécessaires ?", "Règle interne ou validation obtenue."],
                ["Droits", "Puis-je réellement réutiliser ce texte, cette image ou ce document ?", "Licence, autorisation ou origine."],
                ["Biais", "Une personne ou un groupe est-il défavorisé ou stéréotypé ?", "Correction apportée et avis humain."],
                ["Décision", "Qui assume la validation et les conséquences ?", "Nom ou fonction du valideur, date et décision."],
            ],
            [37 * mm, 79 * mm, 55 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(callout("La grille complète", "Téléchargez la <b>Grille de vérification d’un contenu produit avec l’IA</b> depuis le module 4, l’exercice 4, le cas pratique final ou l’onglet Supports et liens. Complétez-la avant toute diffusion à enjeu."))
    story.append(callout("Doute non levé = diffusion suspendue", "Si vous ne pouvez pas confirmer une information importante, retirez-la, marquez-la clairement comme incertaine ou demandez la validation d’une personne compétente.", "red"))
    story.append(PageBreak())

    # 8 - Module 5
    story.extend(page_title("Module 5 · 2 h", "Passer à une expérimentation responsable", "Choisissez un seul usage utile, limité, réversible et mesurable. Le but est d’apprendre sans généraliser trop vite."))
    story.append(p("Une expérimentation maîtrisable", "h2"))
    story.extend(bullets([
        "porte sur une tâche précise, sans décision sensible ;",
        "décrit ce que l’IA prépare et ce qui reste humain ;",
        "limite les informations autorisées et interdit les données inutiles ;",
        "prévoit un responsable, une date et une validation ;",
        "utilise deux indicateurs simples pour décider de poursuivre, corriger ou arrêter.",
    ]))
    story.append(p("Fiche action à 30 jours", "h2"))
    story.append(worksheet([
        ("Usage testé", "Une tâche précise et réversible"),
        ("Bénéfice attendu", "Temps, clarté, qualité ou accessibilité à observer"),
        ("Rôle de l’IA", "Ce que l’outil peut préparer, sans décider"),
        ("Informations", "Ce qui est autorisé et ce qui est interdit"),
        ("Contrôles humains", "Qui vérifie quoi, avec quelles sources"),
        ("Échéance", "Première expérimentation réalisable sous 30 jours"),
        ("Indicateurs", "Deux mesures simples et leurs valeurs de départ"),
        ("Décision", "Poursuivre, corriger ou arrêter - qui tranche ?"),
    ]))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Exemple de périmètre réaliste", "Tester pendant 30 jours trois modèles génériques de courriels internes, sans donnée personnelle, avec relecture systématique avant envoi. Mesurer le temps de préparation et le nombre de corrections nécessaires."))
    story.append(PageBreak())

    # 9 - Modèles 1 et 2
    story.extend(page_title("Bibliothèque de départ", "Quatre modèles de prompts à personnaliser", "Remplacez les éléments entre crochets. Supprimez toute information inutile et utilisez uniquement un outil autorisé."))
    story.append(p("1. Rédiger un courriel professionnel", "h2"))
    story.append(prompt_box(
        "Rédige un courriel destiné à [public] afin de [action attendue].\n"
        "Contexte utile : [situation générique]. Informations validées : [faits].\n"
        "Ton : professionnel, clair et [rassurant/direct/pédagogique]. Longueur : [nombre] mots maximum.\n"
        "Structure : objet, phrase d’introduction, actions dans l’ordre, conclusion.\n"
        "N’invente aucune date, aucun lien ni aucun engagement. Signale toute information manquante avant de rédiger."
    ))
    story.append(p("Vérifier : destinataire, faits, dates, ton, action attendue et données personnelles.", "small"))
    story.append(Spacer(1, 4 * mm))
    story.append(p("2. Résumer une source autorisée", "h2"))
    story.append(prompt_box(
        "À partir uniquement du texte placé entre &lt;source&gt; et &lt;/source&gt;, prépare une synthèse pour [public].\n"
        "Objectif : [ce que le lecteur doit comprendre ou faire]. Format : [liste/tableau/texte], [longueur].\n"
        "Distingue : faits présents dans la source, points à confirmer et questions non traitées.\n"
        "N’ajoute aucune connaissance extérieure et ne transforme pas une hypothèse en fait.\n\n"
        "&lt;source&gt;[contenu autorisé et minimisé]&lt;/source&gt;"
    ))
    story.append(p("Vérifier : fidélité, omissions importantes, chiffres, citations et différence entre fait et hypothèse.", "small"))
    story.append(Spacer(1, 5 * mm))
    story.append(callout("Protéger les personnes", "Pour un exercice, utilisez de préférence un cas fictif. Dans une situation réelle, respectez les outils, contrats, consignes et durées de conservation définis par votre organisation.", "amber"))
    story.append(PageBreak())

    # 10 - Modèles 3 et 4
    story.extend(page_title("Bibliothèque de départ", "Deux autres modèles réutilisables", "Un modèle sert de point de départ. Adaptez toujours les critères au métier, au public et au niveau de risque."))
    story.append(p("3. Préparer un tableau comparatif", "h2"))
    story.append(prompt_box(
        "Compare [éléments] pour aider [public] à [objectif].\n"
        "Utilise uniquement [sources ou informations autorisées].\n"
        "Critères : [critère 1], [critère 2], [critère 3] et [critère 4].\n"
        "Présente un tableau avec une ligne par critère, puis une synthèse qui distingue les faits, les limites et les points à vérifier.\n"
        "Ne choisis pas à ma place. Pose une question si un critère ou une donnée manque."
    ))
    story.append(p("Vérifier : critères comparables, sources identiques, absence de fausse précision et décision laissée à l’utilisateur.", "small"))
    story.append(Spacer(1, 4 * mm))
    story.append(p("4. Expliquer une notion à un débutant", "h2"))
    story.append(prompt_box(
        "Explique [notion] à [public débutant] afin qu’il puisse [action observable].\n"
        "Commence par une définition en une phrase, utilise des mots simples, puis donne un exemple professionnel et un contre-exemple.\n"
        "Ajoute trois étapes à suivre, deux erreurs fréquentes et trois questions courtes d’autoévaluation.\n"
        "Longueur maximale : [nombre] mots. Signale les simplifications et les points qui demandent une validation experte."
    ))
    story.append(p("Vérifier : définition exacte, vocabulaire expliqué, exemple réaliste et absence de promesse exagérée.", "small"))
    story.append(Spacer(1, 5 * mm))
    story.append(p("Mes adaptations", "h2"))
    story.append(worksheet([
        ("Modèle choisi", "Courriel, synthèse, comparaison ou explication"),
        ("Variables remplacées", "Public, objectif, sources, format et critères"),
        ("Risque principal", "Ce qui doit faire l’objet d’un contrôle renforcé"),
        ("Validation prévue", "Personne, date et source de référence"),
    ]))
    story.append(PageBreak())

    # 11 - Itération
    story.extend(page_title("Méthode de dialogue", "Améliorer une réponse sans tout recommencer", "Après le premier résultat, nommez les écarts observables. Une correction ciblée est plus utile qu’un simple « fais mieux »."))
    story.append(
        content_table(
            ["Écart observé", "Relance ciblée"],
            [
                ["Une information manque", "« Avant de poursuivre, pose-moi trois questions ciblées sur les informations indispensables. »"],
                ["Le ton est trop technique", "« Réécris pour un débutant. Explique chaque terme spécialisé lors de sa première utilisation. »"],
                ["La réponse est trop longue", "« Conserve les faits et actions indispensables dans 150 mots maximum, avec une liste de trois points. »"],
                ["Un fait semble inventé", "« Indique la phrase concernée et la source fournie qui la justifie. Si aucune source ne la confirme, retire-la. »"],
                ["Le format n’est pas respecté", "« Reprends uniquement la présentation selon cette structure : [structure]. Ne change pas le contenu validé. »"],
                ["Deux versions sont proches", "« Accentue la différence : A très synthétique ; B pédagogique avec un exemple. Conserve les mêmes faits. »"],
            ],
            [48 * mm, 123 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Journal de trois essais", "h2"))
    story.append(
        content_table(
            ["Version", "Écart constaté", "Correction demandée", "Résultat"],
            [
                ["1", "", "", ""],
                ["2", "", "", ""],
                ["3", "", "", ""],
            ],
            [22 * mm, 51 * mm, 61 * mm, 37 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(callout("S’arrêter au bon moment", "Le but n’est pas d’obtenir une réponse parfaite par accumulation de relances. Arrêtez lorsque les critères sont atteints, puis passez à la vérification humaine et à la finalisation."))
    story.append(PageBreak())

    # 12 - Cas final
    story.extend(page_title("Évaluation finale", "Préparer le cas pratique final", "Choisissez une situation réelle ou réaliste de votre activité, sans donnée personnelle ni information confidentielle. Montrez votre méthode, vos contrôles et vos décisions humaines."))
    story.append(p("Les quatre livrables", "h2"))
    story.append(
        content_table(
            ["Livrable", "Contenu attendu", "Preuve"],
            [
                ["1. Consigne finale", "Objectif, contexte, public, informations, contraintes, format et critères.", "Première version, corrections et version finale."],
                ["2. Livrable", "Résultat ou maquette adapté au besoin et au public.", "Document ou lien sécurisé accessible au formateur."],
                ["3. Grille", "Faits, sources, données, droits, biais, décision et validation.", "Grille de vérification complétée."],
                ["4. Plan d’action", "Première expérimentation, échéance, responsables, contrôles et indicateurs.", "Fiche action d’une page."],
            ],
            [36 * mm, 80 * mm, 55 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(p("Les quatre critères du formateur", "h2"))
    story.extend(bullets([
        "<b>Adéquation :</b> le résultat répond au besoin, au public et aux contraintes.",
        "<b>Consigne :</b> la demande est claire et comporte des critères de réussite vérifiables.",
        "<b>Contrôles :</b> les faits, sources, données, droits, biais et validations sont traités.",
        "<b>Explication :</b> vous savez présenter vos essais, corrections, choix, limites et décisions humaines.",
    ]))
    story.append(callout("Règle de validation", "Les quatre critères doivent atteindre au minimum le niveau <b>Acquis</b>. Si un critère reste « Non acquis » ou « En cours d’acquisition », le formateur précise les améliorations attendues avant une nouvelle remise.", "amber"))
    story.append(p("Mon cas", "h2"))
    story.append(worksheet([
        ("Besoin et public", "La situation choisie et la personne qui utilisera le résultat"),
        ("Livrable attendu", "Le résultat observable à produire"),
        ("Limites", "Ce que l’IA ne doit pas faire ou recevoir"),
        ("Validation", "Qui contrôlera le résultat et à partir de quelles sources"),
    ]))
    story.append(PageBreak())

    # 13 - Glossaire
    story.extend(page_title("Lexique débutant", "Douze mots pour se repérer", "Ces définitions sont volontairement courtes. Retrouvez le lexique complet et actualisable dans l’espace apprenant."))
    glossary = [
        ("Assistant d’IA", "Interface permettant de demander à un modèle de générer, analyser ou transformer un contenu."),
        ("Biais", "Tendance d’un résultat à reproduire un déséquilibre, un stéréotype ou un choix injustifié."),
        ("Contexte", "Informations utiles pour adapter la réponse à la situation, au public et à l’objectif."),
        ("Critère de réussite", "Condition observable utilisée pour juger si le résultat répond au besoin."),
        ("Donnée personnelle", "Information concernant une personne identifiée ou identifiable."),
        ("Donnée sensible", "Donnée personnelle bénéficiant d’une protection renforcée, par exemple une donnée de santé."),
        ("Hallucination", "Information fausse, inventée ou imprécise produite par une IA, parfois avec assurance."),
        ("Itération", "Amélioration progressive d’une consigne ou d’un résultat après observation des écarts."),
        ("LLM", "Grand modèle de langage entraîné pour analyser et générer du texte."),
        ("Prompt", "Instruction, question ou ensemble de consignes fourni à une IA."),
        ("Source", "Document, page ou donnée d’origine permettant de contrôler une information."),
        ("Validation humaine", "Contrôle et décision réalisés par une personne compétente avant utilisation ou diffusion."),
    ]
    cells = []
    for term, definition in glossary:
        cells.append([
            Paragraph(f"<b><font color='{GREEN.hexval()}'>{term}</font></b><br/>{definition}", styles["callout"]),
        ])
    glossary_table = Table(cells, colWidths=[171 * mm])
    glossary_table.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, LIGHT]),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 3.5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3.5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
    ]))
    story.append(glossary_table)
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Un mot n’est pas clair ?", "Notez-le et demandez au formateur un exemple lié à votre activité. Comprendre le vocabulaire doit vous aider à agir ; il ne s’agit pas de mémoriser des termes techniques."))
    story.append(PageBreak())

    # 14 - Checklist
    story.extend(page_title("Avant utilisation", "Ma checklist finale", "Cochez chaque ligne avant de diffuser un contenu préparé avec une IA."))
    checks = [
        "☐ Le besoin, le public et le résultat attendu sont clairement définis.",
        "☐ L’outil utilisé est autorisé pour cette tâche.",
        "☐ Les données transmises sont nécessaires, minimisées et autorisées.",
        "☐ Le contenu a été comparé aux critères de réussite.",
        "☐ Les faits, chiffres, dates, noms, liens et citations ont été contrôlés dans leurs sources.",
        "☐ Les sources ont réellement été ouvertes ; aucune référence inventée n’est utilisée comme preuve.",
        "☐ Les droits d’utilisation des textes, images et documents ont été examinés.",
        "☐ Les biais, stéréotypes et effets possibles sur les personnes ont été recherchés.",
        "☐ Les incertitudes et limites restantes sont visibles.",
        "☐ Une personne compétente a relu et validé le résultat avant diffusion.",
        "☐ La décision, la date et les principales preuves ont été conservées si l’enjeu le justifie.",
    ]
    checklist_data = [[p(item, "body")] for item in checks]
    checklist = Table(checklist_data, colWidths=[171 * mm])
    checklist.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, LIGHT]),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2.3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.3 * mm),
    ]))
    story.append(checklist)
    story.append(Spacer(1, 5 * mm))
    story.append(p("Notes et question à reprendre avec le formateur", "h2"))
    story.append(worksheet([
        ("Mon prochain essai", "La tâche simple que je souhaite tester"),
        ("Mon point de vigilance", "Le contrôle que je dois renforcer"),
        ("Ma question", "Ce qui reste à clarifier pendant la prochaine séance"),
    ]))
    story.append(Spacer(1, 5 * mm))
    story.append(callout("Responsabilité humaine", "L’IA peut accélérer une préparation. Elle ne remplace ni l’expertise métier, ni la vérification des sources, ni la décision de la personne responsable."))

    return story


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_COPY.parent.mkdir(parents=True, exist_ok=True)
    prepare_logo()
    document = GuideDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=22 * mm,
        bottomMargin=20 * mm,
        title="Guide pratique - IA générative",
        author="FormaPrompt - Thierry FREZARD",
        subject="Support pédagogique de la formation IA générative",
        creator="FormaPrompt",
        lang="fr-FR",
        pageCompression=1,
    )
    document.build(build_story(), onFirstPage=cover_page, onLaterPages=regular_page)
    PUBLIC_COPY.write_bytes(OUTPUT.read_bytes())
    print(f"PDF créé : {OUTPUT}")
    print(f"Copie web : {PUBLIC_COPY}")


if __name__ == "__main__":
    main()
