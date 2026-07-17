from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Image, PageBreak, Paragraph, Spacer, Table, TableStyle

from generate_guide_ia_generative import (
    BORDER,
    CROPPED_LOGO,
    GREEN,
    GREEN_LINE,
    LIGHT,
    MUTED,
    NAVY,
    PAGE_HEIGHT,
    PAGE_WIDTH,
    ROOT,
    WHITE,
    GuideDocTemplate,
    bullets,
    callout,
    content_table,
    numbered,
    p,
    page_title,
    prepare_logo,
    styles,
    worksheet,
)


OUTPUT = ROOT / "output" / "pdf" / "cahier-activites-prompt-engineering-niveau-1-formaprompt.pdf"
PUBLIC_COPY = ROOT / "webapp" / "public" / "assets" / "cahier-activites-prompt-engineering-niveau-1-formaprompt.pdf"

prompt_activity_style = ParagraphStyle(
    "PromptActivity",
    parent=styles["prompt"],
    fontSize=6.9,
    leading=9.2,
    textColor=NAVY,
)


def activity_cover(canvas, doc):
    canvas.saveState()
    canvas.setTitle("Cahier d'activités - Prompt Engineering - Niveau 1")
    canvas.setAuthor("FormaPrompt - Thierry FREZARD")
    canvas.setSubject("Cahier des six exercices de la formation Prompt Engineering - Niveau 1")
    canvas.setKeywords("prompt engineering, exercices, activités, formation, FormaPrompt")
    canvas.setFillColor(GREEN)
    canvas.rect(0, PAGE_HEIGHT - 19 * mm, PAGE_WIDTH, 19 * mm, fill=1, stroke=0)
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_WIDTH, 24 * mm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Arial", 8.5)
    canvas.drawCentredString(PAGE_WIDTH / 2, 10 * mm, "FormaPrompt - Formation IA & Bureautique")
    canvas.restoreState()


def activity_page(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(GREEN_LINE)
    canvas.setLineWidth(0.7)
    canvas.line(20 * mm, PAGE_HEIGHT - 16 * mm, PAGE_WIDTH - 20 * mm, PAGE_HEIGHT - 16 * mm)
    canvas.setFont("Arial-Bold", 8)
    canvas.setFillColor(GREEN)
    canvas.drawString(20 * mm, PAGE_HEIGHT - 12 * mm, "FORMAPROMPT")
    canvas.setFont("Arial", 8)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, PAGE_HEIGHT - 12 * mm, "Cahier d'activités - Prompt Engineering - Niveau 1")
    canvas.setStrokeColor(BORDER)
    canvas.line(20 * mm, 15 * mm, PAGE_WIDTH - 20 * mm, 15 * mm)
    canvas.setFont("Arial", 8)
    canvas.drawString(20 * mm, 10 * mm, "Version juillet 2026")
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def lines_box(title, hint="", height=40 * mm, line_count=4):
    body = f"<b><font color='{GREEN.hexval()}'>{title}</font></b>"
    if hint:
        body += f"<br/><font color='{MUTED.hexval()}'>{hint}</font>"
    body += "<br/><br/>" + "<br/>".join(["........................................................................................................................"] * line_count)
    table = Table([[Paragraph(body, styles["callout"])]], colWidths=[171 * mm], rowHeights=[height])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), WHITE),
                ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    return table


def prompt_box(text):
    box = Table([[Paragraph(text.replace("\n", "<br/>"), prompt_activity_style)]], colWidths=[171 * mm])
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


def check_table(criteria):
    rows = [["☐", criterion, "À revoir / Acquis"] for criterion in criteria]
    return content_table(["", "Je vérifie", "Mon avis"], rows, [12 * mm, 118 * mm, 41 * mm])


def feedback_block():
    return [
        p("Retour du formateur", "h2"),
        worksheet(
            [
                ("Statut / date", "☐ Validé    ☐ Reprise demandée    Date : ……………………"),
                ("Point réussi", "Ce qui répond précisément aux attentes"),
                ("À améliorer", "La correction prioritaire pour la prochaine version"),
            ],
            label_width=36 * mm,
        ),
    ]


def exercise_header(number, title, objective, instructions):
    return page_title(f"Exercice {number} sur 6 - {objective}", title, instructions)


EXERCISES = [
    {
        "number": 1,
        "title": "Passer d'une demande vague à une consigne exploitable",
        "objective": "Module 1 - Cadrage du besoin",
        "instructions": "Choisissez une situation simple et non confidentielle. Conservez la demande initiale, le résultat testé et l'amélioration apportée.",
        "steps": [
            "Écrire la demande vague que vous auriez spontanément adressée à l'IA.",
            "Définir le résultat, le contexte, le destinataire, les informations autorisées, le format et trois critères.",
            "Tester la consigne structurée et conserver le résultat obtenu.",
            "Comparer le résultat aux critères puis corriger un écart précis.",
        ],
        "preparation": [
            ("Situation", "La tâche professionnelle choisie"),
            ("Résultat attendu", "Le livrable concret à obtenir"),
            ("Destinataire", "Fonction, niveau et besoin"),
            ("Informations autorisées", "Faits utiles, fictifs ou non confidentiels"),
        ],
        "prompt": "Je souhaite rédiger un e-mail professionnel.\n\nObjectif : [résultat recherché]. Contexte : [situation utile]. Destinataire : [fonction, niveau et attentes]. Informations autorisées : [faits non confidentiels]. Contraintes : [ton, longueur, informations obligatoires et éléments à éviter]. Format attendu : [objet, appel, paragraphes, action et signature]. Critères de réussite : [trois points observables].\n\nAvant de rédiger, pose-moi jusqu'à trois questions si une information essentielle manque.",
        "expected": "La réponse en ligne doit présenter la demande initiale, le prompt structuré, le résultat testé, trois critères et au moins une amélioration justifiée.",
        "criteria": [
            "L'objectif, le destinataire et l'action attendue sont formulés sans ambiguïté.",
            "Les informations transmises sont utiles, autorisées et non confidentielles.",
            "Le format, les contraintes et trois critères sont contrôlables.",
            "La réponse montre le test, l'écart et une amélioration ciblée.",
        ],
    },
    {
        "number": 2,
        "title": "Créer une synthèse fidèle et vérifiable",
        "objective": "Module 2 - Ancrage dans une source",
        "instructions": "Utilisez une source courte, fictive ou explicitement autorisée. Toute information importante doit pouvoir être retrouvée dans le document d'origine.",
        "steps": [
            "Préparer une source avec un fait, une décision, une action et une information volontairement absente.",
            "Définir le public et l'usage de la synthèse.",
            "Tester le prompt et vérifier les quatre catégories demandées.",
            "Retrouver chaque information dans la source et corriger tout ajout ou changement de sens.",
        ],
        "preparation": [
            ("Public", "La personne ou fonction qui utilisera la synthèse"),
            ("Usage", "Informer, préparer une décision ou organiser des actions"),
            ("Source", "Document fictif ou autorisé, clairement délimité"),
            ("Information absente", "Élément qui devra rester « non précisé »"),
        ],
        "prompt": "À partir du texte placé entre &lt;source&gt; et &lt;/source&gt;, produis une synthèse destinée à [public]. Usage : [usage précis].\n\n&lt;source&gt;[source fictive ou autorisée]&lt;/source&gt;\n\nFormat : 1. faits établis ; 2. décisions ; 3. actions avec responsable et échéance uniquement s'ils sont précisés ; 4. points à confirmer.\n\nNe rien inventer ; conserver le sens ; écrire « non précisé » si une information manque ; signaler les ambiguïtés ; terminer par les vérifications à effectuer dans la source.",
        "expected": "La réponse en ligne doit contenir le prompt, la synthèse, la source utilisée ou sa description et la trace d'au moins un contrôle dans le document.",
        "criteria": [
            "La source est fictive ou autorisée et clairement délimitée.",
            "Le public, l'usage et le format sont explicitement indiqués.",
            "Les faits, décisions, actions et absences sont distingués sans invention.",
            "La réponse montre au moins un contrôle réalisé dans la source.",
        ],
    },
    {
        "number": 3,
        "title": "Adapter un contenu à deux publics",
        "objective": "Module 3 - Publics et message invariant",
        "instructions": "Choisissez un sujet que vous maîtrisez et trois informations essentielles qui devront rester identiques dans les deux versions.",
        "steps": [
            "Noter trois faits, idées ou limites à conserver.",
            "Décrire les deux publics, leurs connaissances et l'action attendue.",
            "Tester le prompt et conserver les deux versions.",
            "Comparer la fidélité, le vocabulaire, les exemples et le niveau de détail, puis corriger un écart.",
        ],
        "preparation": [
            ("Sujet", "Un sujet professionnel non sensible et maîtrisé"),
            ("Message invariant", "Trois faits, idées ou limites à conserver"),
            ("Public 1", "Profil débutant, besoin et action attendue"),
            ("Public 2", "Profil professionnel, niveau et action attendue"),
        ],
        "prompt": "Sujet : [sujet]. Informations de référence : [fait 1], [fait 2], [limite]. Public 1 : [profil débutant]. Public 2 : [profil professionnel].\n\nPour chaque public, fournis une explication courte, un exemple, une erreur fréquente, une question de vérification et l'action à retenir.\n\nConserve les trois informations de référence ; ne rien inventer ; explique le vocabulaire technique au public débutant ; précise les limites utiles au public professionnel. Termine par un tableau comparant vocabulaire, exemple, détail et message conservé.",
        "expected": "La réponse en ligne doit présenter le message invariant, les deux publics, le prompt, les deux versions, leur comparaison et l'amélioration apportée.",
        "criteria": [
            "Les deux publics et les actions attendues sont décrits avec précision.",
            "Les trois informations essentielles apparaissent dans les deux versions.",
            "Le vocabulaire, les exemples et le niveau de détail sont réellement adaptés.",
            "La réponse contient la comparaison et une amélioration justifiée.",
        ],
    },
    {
        "number": 4,
        "title": "Construire une ressource pédagogique",
        "objective": "Module 4 - Alignement pédagogique",
        "instructions": "Choisissez une compétence que vous maîtrisez et une activité courte fondée sur des informations fiables et autorisées.",
        "steps": [
            "Décrire le public, les prérequis, la modalité, la durée et l'objectif observable.",
            "Préparer les références et les contraintes matérielles.",
            "Tester le prompt puis contrôler l'alignement entre objectif, consigne, production, corrigé et critères.",
            "Simuler le déroulé, corriger un problème de faisabilité et conserver les deux versions.",
        ],
        "preparation": [
            ("Compétence", "L'action que l'apprenant devra réaliser"),
            ("Public et prérequis", "Profil, niveau, besoin et acquis nécessaires"),
            ("Modalité et durée", "Présentiel, classe virtuelle, matériel et temps"),
            ("Références", "Faits, procédure ou source autorisée"),
        ],
        "prompt": "Conçois une activité pédagogique. Compétence : [compétence]. Public : [profil]. Prérequis : [prérequis]. Modalité : [modalité]. Durée : [durée]. Objectif observable : l'apprenant sera capable de [action]. Références autorisées : [source]. Matériel : [liste]. Adaptations validées : [éléments ou aucune].\n\nPropose : titre, étapes minutées, consignes, exemple, production attendue, corrigé commenté, quatre critères, variante d'accessibilité à confirmer et points à valider avant l'animation.\n\nL'activité doit tenir dans la durée ; ne rien inventer ; écrire « à confirmer par le formateur » si une information manque ; aucune adaptation individuelle non validée ; aucune donnée personnelle demandée.",
        "expected": "La réponse en ligne doit montrer le prompt, la première activité, le contrôle d'alignement, une amélioration et les points restant à valider par le formateur.",
        "criteria": [
            "Le public, les prérequis, la durée, la modalité et l'objectif sont définis.",
            "La production attendue est directement liée à la compétence.",
            "Le corrigé et quatre critères permettent de justifier l'évaluation.",
            "La réponse montre le contrôle, l'amélioration et les validations restantes.",
        ],
    },
    {
        "number": 5,
        "title": "Préparer une page HTML",
        "objective": "Module 5 - Cahier des charges",
        "instructions": "Travaillez sur une page simple et validez son organisation avant toute production de code.",
        "steps": [
            "Définir le sujet, le public, le besoin, l'action principale et les contenus disponibles.",
            "Demander uniquement le cahier des charges et l'arborescence pendant la première phase.",
            "Contrôler l'ordre, l'écran étroit, le clavier et les contenus inventés.",
            "Après validation seulement, produire le code et noter les tests manuels.",
        ],
        "preparation": [
            ("Sujet et objectif", "Ce que la page doit permettre de comprendre ou trouver"),
            ("Public", "Profil, besoin et action principale"),
            ("Contenus", "Textes, faits, médias et sections autorisés"),
            ("Contraintes", "Identité visuelle, interactions, dépendances et données interdites"),
        ],
        "prompt": "Prépare une page HTML en deux phases. Aucun code pendant la première phase. Sujet : [sujet]. Public : [profil]. Objectif : [objectif]. Action principale : [action]. Contenus autorisés : [liste]. Sections : [liste]. Identité visuelle : [éléments]. Interactions : [liste]. Dépendances : [liste ou aucune]. Données interdites : [liste].\n\nPhase 1 : reformule, pose jusqu'à cinq questions, propose l'arborescence, précise l'utilité de chaque section, l'ordre mobile, le clavier, les libellés, le focus, les alternatives et les contrastes ; termine par les points à confirmer ; attends ma validation.\n\nPhase 2 après validation : HTML autonome, CSS simple, structure sémantique, aucun ajout non autorisé, « contenu à fournir » si une information manque, puis tests clavier, liens, titres, images, contrastes et mobile.",
        "expected": "La réponse en ligne doit contenir le prompt, l'arborescence, les points à valider, le contrôle réalisé, une correction et les tests prévus ou effectués.",
        "criteria": [
            "Le public, le besoin, l'action et les contenus autorisés sont précis.",
            "L'arborescence décrit les sections et leur ordre sur écran étroit.",
            "La première réponse s'arrête aux choix à valider et n'invente rien.",
            "La réponse montre le contrôle, la correction et les tests prévus.",
        ],
    },
    {
        "number": 6,
        "title": "Créer un workflow de production contrôlé",
        "objective": "Module 6 - Étapes et validations",
        "instructions": "Choisissez une tâche simple et récurrente. Le processus reste manuel et ne déclenche aucune action externe.",
        "steps": [
            "Décrire le livrable, son destinataire, son usage, les entrées autorisées et les limites.",
            "Obtenir le tableau du processus puis contrôler les étapes, résultats, critères et arrêts.",
            "Après validation, tester chaque prompt avec un cas fictif sans transmission automatique.",
            "Repérer un écart, corriger uniquement l'étape concernée et conserver les deux versions.",
        ],
        "preparation": [
            ("Tâche et livrable", "Une tâche récurrente et le résultat final attendu"),
            ("Destinataire et usage", "Public et décision ou action préparée"),
            ("Entrées autorisées", "Sources et informations utilisables"),
            ("Limites", "Données et actions interdites, responsable de validation"),
        ],
        "prompt": "Construis un processus manuel et contrôlé, sans automatisation ni action externe. Tâche : [tâche]. Livrable : [résultat et format]. Destinataire : [public et usage]. Entrées : [sources]. Données interdites : [liste]. Critères : [trois à cinq]. Responsable : [fonction]. Actions interdites : [liste].\n\nPhase 1 : reformule, signale les manques, propose trois à cinq étapes avec objectif, entrée, résultat, critères, validation et condition d'arrêt ; seul un résultat validé alimente l'étape suivante ; attends ma validation.\n\nPhase 2 : un prompt par étape avec variables, données minimales, format, critères, « information manquante » au lieu d'inventer, pause de validation et arrêt si une source ou décision humaine manque.\n\nPhase 3 : cas fictif, traces à conserver et grille résultat / écart / correction / décision.",
        "expected": "La réponse en ligne doit contenir le workflow, les prompts testés, les validations, l'écart constaté et la correction ciblée.",
        "criteria": [
            "Le processus comporte trois à cinq étapes ordonnées avec entrée et résultat.",
            "Chaque étape possède des critères, une validation et une condition d'arrêt.",
            "Les prompts utilisent des variables et ne déclenchent aucune action externe.",
            "La réponse montre le test, l'écart et la correction justifiée.",
        ],
    },
]


def preparation_page(exercise):
    story = exercise_header(
        exercise["number"],
        exercise["title"],
        exercise["objective"],
        exercise["instructions"],
    )
    story.append(p("Les quatre étapes", "h2"))
    story.extend(numbered(exercise["steps"]))
    story.append(p("Préparer mon cas", "h2"))
    story.append(worksheet(exercise["preparation"], label_width=42 * mm))
    story.append(Spacer(1, 3 * mm))
    story.append(p("Modèle à personnaliser", "h2"))
    story.append(prompt_box(exercise["prompt"]))
    story.append(PageBreak())
    return story


def realization_page(exercise):
    number = exercise["number"]
    title = exercise["title"]
    story = page_title(f"Exercice {number} - Réalisation", "Tester et conserver les preuves", f"{title}. Notez les résultats utiles sans recopier de donnée personnelle ou confidentielle.")

    if number == 1:
        story.extend([
            lines_box("Ma demande initiale", "La formulation vague avant structuration.", 34 * mm, 3),
            Spacer(1, 3 * mm),
            lines_box("Le résultat obtenu avec le prompt structuré", "Court extrait ou caractéristiques principales.", 40 * mm, 4),
            Spacer(1, 3 * mm),
            content_table(["Critère", "Observation", "Écart à corriger"], [["Objectif et public", "", ""], ["Format", "", ""], ["Exactitude", "", ""]], [48 * mm, 62 * mm, 61 * mm]),
            Spacer(1, 3 * mm),
            lines_box("Mon amélioration ciblée", "La modification du prompt et sa justification.", 32 * mm, 2),
        ])
    elif number == 2:
        story.extend([
            content_table(["Catégorie", "Élément de la synthèse", "Preuve dans la source"], [["Fait", "", ""], ["Décision", "", ""], ["Action", "", ""], ["Point à confirmer", "", ""]], [42 * mm, 70 * mm, 59 * mm]),
            Spacer(1, 4 * mm),
            lines_box("Ajout, omission ou changement de sens repéré", "Décrivez le problème et la phrase de la source concernée.", 44 * mm, 4),
            Spacer(1, 4 * mm),
            lines_box("Correction réalisée", "Ce qui a été retiré, rétabli ou signalé comme non précisé.", 42 * mm, 4),
        ])
    elif number == 3:
        story.extend([
            content_table(["Critère", "Public 1", "Public 2", "Message conservé"], [["Vocabulaire", "", "", ""], ["Exemple", "", "", ""], ["Niveau de détail", "", "", ""], ["Action attendue", "", "", ""]], [38 * mm, 42 * mm, 42 * mm, 49 * mm]),
            Spacer(1, 4 * mm),
            lines_box("Écart constaté", "Information oubliée, ajoutée ou modifiée entre les deux versions.", 42 * mm, 4),
            Spacer(1, 4 * mm),
            lines_box("Correction apportée", "Modification ciblée et raison du choix.", 42 * mm, 4),
        ])
    elif number == 4:
        story.extend([
            content_table(["Élément", "Première proposition", "Contrôle / correction"], [["Objectif observable", "", ""], ["Activité et durée", "", ""], ["Production attendue", "", ""], ["Corrigé", "", ""], ["Quatre critères", "", ""]], [46 * mm, 62 * mm, 63 * mm]),
            Spacer(1, 4 * mm),
            lines_box("Problème repéré pendant la simulation", "Faisabilité, consigne, durée, correction ou accessibilité.", 42 * mm, 4),
            Spacer(1, 4 * mm),
            lines_box("Version améliorée", "La modification apportée et les points restant à valider.", 40 * mm, 4),
        ])
    elif number == 5:
        story.extend([
            content_table(["Section", "Contenu et utilité", "Priorité mobile", "À confirmer"], [["1", "", "", ""], ["2", "", "", ""], ["3", "", "", ""], ["4", "", "", ""], ["5", "", "", ""]], [31 * mm, 65 * mm, 39 * mm, 36 * mm]),
            Spacer(1, 4 * mm),
            p("Contrôles avant le code", "h2"),
            check_table(["Un titre principal et des titres ordonnés sont prévus.", "L'ordre sur écran étroit reste compréhensible.", "Les interactions sont utilisables au clavier.", "Les contenus absents sont signalés, pas inventés."]),
            Spacer(1, 4 * mm),
            lines_box("Correction du cahier des charges", "Le choix modifié avant de demander du code.", 35 * mm, 3),
        ])
    else:
        story.extend([
            content_table(["Étape", "Entrée", "Résultat", "Critère / arrêt"], [[str(i), "", "", ""] for i in range(1, 6)], [24 * mm, 49 * mm, 49 * mm, 49 * mm]),
            Spacer(1, 4 * mm),
            lines_box("Test fictif et écart observé", "Indiquez l'étape concernée et ce qui ne respecte pas le critère.", 42 * mm, 4),
            Spacer(1, 4 * mm),
            lines_box("Correction ciblée", "Modifiez uniquement le prompt ou le contrôle de l'étape concernée.", 42 * mm, 4),
        ])

    story.append(PageBreak())
    return story


def bilan_page(exercise):
    number = exercise["number"]
    story = page_title(f"Exercice {number} - Bilan", "Analyser et préparer la remise", "Appuyez chaque réponse sur un élément précis de votre travail.")
    story.append(callout("Réponse attendue par le formateur", exercise["expected"], "green"))
    story.append(p("Autoévaluation", "h2"))
    story.append(check_table(exercise["criteria"]))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Ce que j'ai appris", "Une méthode, un contrôle ou une limite que je saurai réutiliser.", 30 * mm, 2))
    story.append(Spacer(1, 3 * mm))
    story.extend(feedback_block())
    if number == 6:
        story.append(Spacer(1, 4 * mm))
        story.append(callout("Prochaine étape", "Lorsque les six exercices sont terminés et relus, préparez les quatre livrables du cas pratique final : prompt final, résultat, contrôles et modèle réutilisable."))
    story.append(PageBreak() if number < 6 else Spacer(1, 1))
    return story


def build_story():
    story = []

    # 1 - Couverture
    story.extend(
        [
            Spacer(1, 24 * mm),
            Image(str(CROPPED_LOGO), width=66 * mm, height=45 * mm, kind="proportional"),
            Spacer(1, 8 * mm),
            p("CAHIER D'ACTIVITÉS", "cover_eyebrow"),
            p("Prompt Engineering<br/>mes six exercices pratiques", "cover_title"),
            p("Un support pour préparer, tester, contrôler et expliquer votre démarche", "cover_subtitle"),
            callout(
                "À utiliser avec l'espace apprenant",
                "Posez vos idées dans ce cahier, puis enregistrez votre réponse dans l'exercice correspondant afin de conserver les versions et de recevoir le retour du formateur. Le cahier imprimé ne remplace pas la remise en ligne.",
            ),
            Spacer(1, 5 * mm),
            worksheet(
                [
                    ("Participant", "Nom et prénom"),
                    ("Session", "Dates ou période de la formation"),
                    ("Modalité", "☐ Présentiel    ☐ Classe virtuelle"),
                ],
                label_width=38 * mm,
            ),
        ]
    )
    story.append(PageBreak())

    # 2 - Mode d'emploi
    story.extend(page_title("Avant de commencer", "Comment utiliser ce cahier ?", "Chaque exercice suit le même chemin : préparer, tester, analyser, s'autoévaluer, puis enregistrer une version dans l'espace apprenant."))
    story.extend(numbered([
        "<b>Préparez le cas.</b> Choisissez un exemple fictif, générique ou expressément autorisé.",
        "<b>Personnalisez le prompt.</b> Remplacez les éléments entre crochets et supprimez les informations inutiles.",
        "<b>Testez dans un assistant autorisé.</b> Conservez le prompt et le résultat obtenu.",
        "<b>Contrôlez avec les critères.</b> Appuyez chaque appréciation sur un élément précis du travail.",
        "<b>Enregistrez dans l'espace apprenant.</b> Gardez le statut brouillon pendant le travail ; déclarez la réponse terminée lorsqu'elle est prête pour le formateur.",
    ]))
    story.append(callout("Données et confidentialité", "N'inscrivez ni nom de client ou de salarié, ni adresse, dossier, donnée de santé, identifiant, mot de passe ou information interne non autorisée. Utilisez des fonctions génériques et des faits fictifs.", "red"))
    story.append(p("Ce que le formateur regarde", "h2"))
    story.extend(bullets([
        "le cadrage du besoin, du public et du résultat attendu ;",
        "la qualité du prompt, des variables et des critères ;",
        "la fidélité aux sources et la protection des informations ;",
        "la comparaison, les contrôles et les corrections ciblées ;",
        "la capacité à expliquer les limites et la validation humaine.",
    ]))
    story.append(callout("Historique officiel", "Le cahier est un support personnel et imprimable. Les réponses, versions, corrections et validations officielles restent celles enregistrées dans l'espace apprenant."))
    story.append(PageBreak())

    # 3 - Suivi
    story.extend(page_title("Tableau de bord personnel", "Suivre les six exercices", "Complétez une ligne après chaque séance. Le statut officiel reste celui affiché dans l'espace apprenant."))
    story.append(
        content_table(
            ["Exercice", "Préparé", "Testé", "Enregistré", "Retour formateur"],
            [
                ["1. Cadrer une demande", "☐", "☐", "☐ Brouillon  ☐ Terminé", "☐ Validé  ☐ Reprise"],
                ["2. Synthétiser une source", "☐", "☐", "☐ Brouillon  ☐ Terminé", "☐ Validé  ☐ Reprise"],
                ["3. Adapter à deux publics", "☐", "☐", "☐ Brouillon  ☐ Terminé", "☐ Validé  ☐ Reprise"],
                ["4. Ressource pédagogique", "☐", "☐", "☐ Brouillon  ☐ Terminé", "☐ Validé  ☐ Reprise"],
                ["5. Préparer une page HTML", "☐", "☐", "☐ Brouillon  ☐ Terminé", "☐ Validé  ☐ Reprise"],
                ["6. Workflow contrôlé", "☐", "☐", "☐ Brouillon  ☐ Terminé", "☐ Validé  ☐ Reprise"],
            ],
            [52 * mm, 20 * mm, 20 * mm, 42 * mm, 37 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(lines_box("Ce que je souhaite savoir faire", "Deux ou trois compétences concrètes.", 45 * mm, 4))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Ma principale difficulté avec les prompts", "Cadrage, source, public, format, contrôle ou réutilisation.", 40 * mm, 3))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Ma question de départ", "Une question à reprendre avec le formateur.", 34 * mm, 2))
    story.append(PageBreak())

    for exercise in EXERCISES:
        story.extend(preparation_page(exercise))
        story.extend(realization_page(exercise))
        story.extend(bilan_page(exercise))

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
        title="Cahier d'activités - Prompt Engineering - Niveau 1",
        author="FormaPrompt - Thierry FREZARD",
        subject="Cahier des six exercices de la formation Prompt Engineering - Niveau 1",
        creator="FormaPrompt",
        lang="fr-FR",
        pageCompression=1,
    )
    document.build(build_story(), onFirstPage=activity_cover, onLaterPages=activity_page)
    PUBLIC_COPY.write_bytes(OUTPUT.read_bytes())
    print(f"PDF créé : {OUTPUT}")
    print(f"Copie web : {PUBLIC_COPY}")


if __name__ == "__main__":
    main()
