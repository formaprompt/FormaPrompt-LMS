from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from generate_guide_ia_generative import (
    AMBER,
    AMBER_PALE,
    BORDER,
    CROPPED_LOGO,
    GREEN,
    GREEN_LINE,
    GREEN_PALE,
    LIGHT,
    MUTED,
    NAVY,
    RED,
    ROOT,
    SLATE,
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


OUTPUT = ROOT / "output" / "pdf" / "guide-pratique-prompt-engineering-niveau-1-formaprompt.pdf"
PUBLIC_COPY = ROOT / "webapp" / "public" / "assets" / "guide-pratique-prompt-engineering-niveau-1-formaprompt.pdf"

PAGE_WIDTH, PAGE_HEIGHT = A4

prompt_compact_style = ParagraphStyle(
    "PromptCompact",
    parent=styles["prompt"],
    fontSize=7.4,
    leading=9.9,
    textColor=NAVY,
)

cover_note_style = ParagraphStyle(
    "CoverNote",
    parent=styles["cover_subtitle"],
    fontSize=10,
    leading=14,
    textColor=MUTED,
    alignment=TA_CENTER,
)


def prompt_box(text):
    content = text.replace("\n", "<br/>")
    box = Table([[Paragraph(content, prompt_compact_style)]], colWidths=[171 * mm])
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


def cover_page(canvas, doc):
    canvas.saveState()
    canvas.setTitle("Guide pratique - Prompt Engineering - Niveau 1")
    canvas.setAuthor("FormaPrompt - Thierry FREZARD")
    canvas.setSubject("Support pédagogique de la formation Prompt Engineering - Niveau 1")
    canvas.setKeywords("prompt engineering, formation, prompt, vérification, FormaPrompt")
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
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, PAGE_HEIGHT - 12 * mm, "Guide pratique - Prompt Engineering - Niveau 1")
    canvas.setStrokeColor(BORDER)
    canvas.line(20 * mm, 15 * mm, PAGE_WIDTH - 20 * mm, 15 * mm)
    canvas.setFont("Arial", 8)
    canvas.drawString(20 * mm, 10 * mm, "Version juillet 2026")
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def module_page(number, duration, title, objective, method, demonstration, expected, checks):
    result = page_title(
        f"Module {number} - {duration}",
        title,
        objective,
    )
    result.append(p("Méthode guidée", "h2"))
    result.extend(numbered(method))
    result.append(p("Démonstration professionnelle", "h2"))
    result.append(callout(demonstration[0], demonstration[1], demonstration[2]))
    result.append(p("Production attendue dans l'exercice", "h2"))
    result.extend(bullets(expected))
    result.append(callout("Avant de déclarer l'exercice terminé", checks, "amber"))
    result.append(PageBreak())
    return result


def build_story():
    story = []

    # 1 - Couverture
    story.extend(
        [
            Spacer(1, 24 * mm),
            Image(str(CROPPED_LOGO), width=66 * mm, height=45 * mm, kind="proportional"),
            Spacer(1, 8 * mm),
            p("GUIDE PRATIQUE", "cover_eyebrow"),
            p("Prompt Engineering<br/>Niveau 1", "cover_title"),
            p("Construire, tester et améliorer des prompts professionnels", "cover_subtitle"),
            callout(
                "À quoi sert ce guide ?",
                "À suivre les six modules, préparer les exercices, retrouver les prompts complets et contrôler chaque résultat avant son utilisation. Il complète l'espace apprenant et la bibliothèque Notion ; il ne remplace ni les échanges avec le formateur ni les règles de votre organisation.",
            ),
            Spacer(1, 4 * mm),
            Paragraph("Formation de 6 h 30 - support pour adultes débutants ou utilisateurs occasionnels", cover_note_style),
        ]
    )
    story.append(PageBreak())

    # 2 - Parcours
    story.extend(
        page_title(
            "Mode d'emploi",
            "Votre parcours en six modules",
            "Avancez dans l'ordre. Chaque module apporte une méthode, une démonstration et un exercice enregistré dans l'espace apprenant.",
        )
    )
    story.append(
        content_table(
            ["Module", "Compétence travaillée", "Production attendue"],
            [
                ["1 - Cadrer", "Transformer un besoin en consigne professionnelle vérifiable.", "Un prompt structuré et une amélioration justifiée."],
                ["2 - Ancrer", "Produire une synthèse fidèle à une source autorisée.", "Une synthèse contrôlée dans le document d'origine."],
                ["3 - Adapter", "Adapter un même message à deux publics sans changer le sens.", "Deux versions comparées avec les mêmes critères."],
                ["4 - Concevoir", "Préparer une activité pédagogique observable et réaliste.", "Une activité, un corrigé et quatre critères."],
                ["5 - Spécifier", "Définir une page HTML avant toute production de code.", "Un cahier des charges et une arborescence validés."],
                ["6 - Organiser", "Découper une tâche en étapes contrôlées et réutilisables.", "Un workflow testé avec ses conditions d'arrêt."],
            ],
            [30 * mm, 77 * mm, 64 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.extend(
        numbered(
            [
                "Lisez l'objectif et la démonstration avant de personnaliser le prompt.",
                "Utilisez uniquement un cas fictif ou des informations explicitement autorisées.",
                "Enregistrez un brouillon, testez votre prompt puis comparez le résultat à des critères observables.",
                "Déclarez l'exercice terminé lorsque votre réponse montre le prompt, le test, le contrôle et l'amélioration.",
                "Consultez le retour du formateur et créez une nouvelle version si une reprise est demandée.",
            ]
        )
    )
    story.append(callout("Règle commune", "Une réponse fluide n'est pas une preuve de fiabilité. Vérifiez les faits, les sources, les données, les limites et la validation humaine avant toute utilisation.", "red"))
    story.append(PageBreak())

    # 3 - Anatomie
    story.extend(page_title("Méthode commune", "Les sept blocs d'un prompt professionnel", "La qualité vient d'un besoin bien cadré et de contrôles explicites, pas d'une formule secrète."))
    story.append(
        content_table(
            ["Bloc", "Question à se poser", "Exemple"],
            [
                ["1. Objectif", "Quel résultat concret faut-il obtenir ?", "Rédiger un e-mail de confirmation."],
                ["2. Contexte", "Quelle situation faut-il comprendre ?", "Atelier à distance pour adultes débutants."],
                ["3. Public", "Qui utilisera ou lira le résultat ?", "Participants peu à l'aise avec le numérique."],
                ["4. Informations", "Quels faits sont utiles et autorisés ?", "Date, durée et consignes validées."],
                ["5. Contraintes", "Que faut-il respecter ou éviter ?", "180 mots, ton clair, aucune invention."],
                ["6. Format", "Sous quelle forme livrer la réponse ?", "Objet, trois paragraphes et action finale."],
                ["7. Critères", "Comment contrôler le résultat ?", "Exact, lisible, complet et adapté au public."],
            ],
            [29 * mm, 72 * mm, 70 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(p("Trame rapide", "h2"))
    story.append(
        prompt_box(
            "Objectif : [résultat attendu].\n"
            "Contexte : [situation utile].\n"
            "Public : [destinataire, niveau et besoin].\n"
            "Informations autorisées : [faits ou source].\n"
            "Contraintes : [ton, longueur, limites et éléments interdits].\n"
            "Format attendu : [structure du résultat].\n"
            "Critères de réussite : [trois à cinq points observables].\n"
            "Avant de produire, pose des questions si une information essentielle manque."
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Trois questions avant le test", "Le résultat sera-t-il réellement utile ? Les informations sont-elles autorisées et nécessaires ? Qui vérifiera et décidera avant diffusion ?"))
    story.append(PageBreak())

    # 4 à 9 - Modules
    story.extend(
        module_page(
            1,
            "1 h 15",
            "Cadrer le besoin et construire un prompt professionnel",
            "Transformer une demande vague en consigne claire, contrôlable et adaptée à une situation professionnelle.",
            [
                "Nommer le livrable et l'action attendue.",
                "Décrire le contexte utile et le destinataire.",
                "Sélectionner uniquement les informations autorisées.",
                "Fixer les contraintes, le format et trois critères.",
                "Tester, repérer un écart et corriger le prompt.",
            ],
            ("E-mail de confirmation", "Une demande vague devient une consigne qui précise la date fictive, le ton, la structure, l'action demandée et l'interdiction d'inventer. Si une donnée manque, l'IA doit d'abord poser une question.", "green"),
            [
                "La demande initiale et le prompt structuré.",
                "Le résultat obtenu et les trois critères utilisés.",
                "Au moins un écart observé et une correction ciblée.",
            ],
            "Le public, les informations autorisées, le format et les critères sont-ils suffisamment précis pour qu'une autre personne puisse contrôler le résultat ?",
        )
    )
    story.extend(
        module_page(
            2,
            "1 h 15",
            "Ancrer la réponse dans une source",
            "Obtenir une synthèse fidèle sans laisser l'IA inventer, déduire ou masquer les informations absentes.",
            [
                "Définir l'usage et le destinataire de la synthèse.",
                "Préparer une source courte, autorisée et clairement délimitée.",
                "Demander des catégories distinctes : faits, décisions, actions et points à confirmer.",
                "Interdire les compléments inventés et afficher « non précisé ».",
                "Retrouver chaque information importante dans la source.",
            ],
            ("Compte rendu fictif", "La source contient un fait, une décision, une action et une échéance volontairement absente. Une bonne synthèse conserve cette absence au lieu d'inventer une date crédible.", "green"),
            [
                "La source fictive ou autorisée et le prompt testé.",
                "La synthèse organisée selon les catégories demandées.",
                "La trace d'au moins un contrôle dans le document d'origine.",
            ],
            "Chaque fait peut-il être retrouvé dans la source ? Les informations absentes ou ambiguës restent-elles visibles ?",
        )
    )
    story.extend(
        module_page(
            3,
            "1 h 30",
            "Adapter un contenu à différents publics",
            "Faire varier le vocabulaire, les exemples et le niveau de détail tout en conservant les informations essentielles.",
            [
                "Définir trois messages invariants à conserver.",
                "Décrire les connaissances, le besoin et l'action de chaque public.",
                "Choisir les adaptations de vocabulaire, d'exemple et de détail.",
                "Produire les deux versions à partir des mêmes références.",
                "Comparer les versions avec les mêmes critères.",
            ],
            ("Authentification à deux facteurs", "La version débutante explique simplement l'action à réaliser ; la version professionnelle détaille les conditions d'usage. La règle de sécurité reste identique dans les deux textes.", "green"),
            [
                "Les trois informations qui doivent rester stables.",
                "La description des deux publics et les deux versions.",
                "Une comparaison et au moins une correction justifiée.",
            ],
            "Le sens, les réserves et les faits sont-ils identiques ? Les différences viennent-elles bien des besoins des publics ?",
        )
    )
    story.extend(
        module_page(
            4,
            "1 h",
            "Concevoir une activité pédagogique observable",
            "Utiliser l'IA pour préparer une activité cohérente tout en laissant au formateur la validation du contenu, de la durée et des adaptations.",
            [
                "Cadrer le public, les prérequis, la modalité et la durée.",
                "Formuler un objectif avec une action observable.",
                "Faire produire une trace directement liée à l'objectif.",
                "Préparer les réponses attendues et quatre critères.",
                "Simuler le déroulé puis corriger un problème de faisabilité.",
            ],
            ("Repérer un e-mail suspect", "Les apprenants analysent un message fictif, relèvent trois indices et justifient leur décision. Le corrigé s'appuie uniquement sur les références fournies et l'adaptation reste à valider avec la personne concernée.", "green"),
            [
                "Le prompt et la première proposition d'activité.",
                "La production attendue, le corrigé et les quatre critères.",
                "Le contrôle de faisabilité et l'amélioration apportée.",
            ],
            "L'objectif, l'activité, la production, le corrigé et les critères évaluent-ils bien la même compétence ?",
        )
    )
    story.extend(
        module_page(
            5,
            "45 min",
            "Préparer le cahier des charges d'une page HTML",
            "Décrire le public, les contenus, la structure et les contrôles avant de demander une production technique.",
            [
                "Définir le public, son besoin et l'action principale.",
                "Lister les contenus et médias réellement autorisés.",
                "Organiser les sections et leurs priorités sur écran étroit.",
                "Décrire les interactions, le clavier et les règles d'accessibilité.",
                "Faire valider le cahier des charges avant tout code.",
            ],
            ("Page d'un atelier", "La première réponse propose uniquement l'arborescence, l'ordre mobile et les points à confirmer. Elle n'invente aucun contenu, aucune collecte de données et aucune dépendance externe.", "green"),
            [
                "Le prompt de cadrage et l'arborescence proposée.",
                "Les choix à confirmer avant la production de code.",
                "Les tests prévus : clavier, titres, libellés, contrastes et mobile.",
            ],
            "La page peut-elle être comprise et validée avant le code ? Les contenus absents sont-ils signalés au lieu d'être inventés ?",
        )
    )
    story.extend(
        module_page(
            6,
            "45 min",
            "Construire un processus de travail contrôlé",
            "Décomposer une tâche en étapes simples, chacune associée à une entrée, un résultat, des critères et une validation humaine.",
            [
                "Définir le livrable final et son destinataire.",
                "Recenser les entrées autorisées et les données interdites.",
                "Découper le travail en trois à cinq étapes.",
                "Ajouter les validations et les conditions d'arrêt.",
                "Tester avec un cas fictif et corriger uniquement l'étape défaillante.",
            ],
            ("Compte rendu à partir de notes", "Les notes fictives sont structurées, contrôlées puis transformées. Seul un résultat validé devient l'entrée de l'étape suivante ; aucun envoi ou publication n'est déclenché automatiquement.", "green"),
            [
                "Le tableau du workflow, ses entrées, sorties et validations.",
                "Les prompts réutilisables avec leurs variables.",
                "Le test, l'écart constaté et la correction apportée.",
            ],
            "Chaque étape possède-t-elle un critère, une validation et une condition d'arrêt ? Les actions externes restent-elles humaines ?",
        )
    )

    # 10 - Prompt 1
    story.extend(page_title("Bibliothèque - Prompt 1", "Cadrer une demande professionnelle", "Remplacez les éléments entre crochets. Conservez uniquement des informations nécessaires et autorisées."))
    story.append(prompt_box(
        "Je souhaite rédiger un e-mail professionnel.\n\n"
        "Objectif : [indiquer le résultat recherché].\n"
        "Contexte : [préciser la situation utile].\n"
        "Destinataire : [fonction, niveau de connaissance et attentes].\n"
        "Informations autorisées : [faits ou éléments non confidentiels que l'IA peut utiliser].\n"
        "Contraintes : [ton, longueur, informations obligatoires et éléments à éviter].\n"
        "Format attendu : [objet, formule d'appel, paragraphes, appel à l'action et signature].\n"
        "Critères de réussite : [indiquer trois points observables permettant de contrôler le résultat].\n\n"
        "Avant de rédiger, pose-moi jusqu'à trois questions si une information essentielle manque."
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Contrôles", "Destinataire, faits, dates, données transmises, format et trois critères de réussite."))
    story.append(p("Trace à conserver", "h2"))
    story.append(worksheet([("Demande initiale", "La version spontanée avant structuration"), ("Écart observé", "Le point précis à corriger"), ("Amélioration", "La modification apportée au prompt")]))
    story.append(PageBreak())

    # 11 - Prompt 2
    story.extend(page_title("Bibliothèque - Prompt 2", "Produire une synthèse fidèle", "Délimitez clairement la source et ne demandez aucun complément extérieur."))
    story.append(prompt_box(
        "À partir du texte placé entre &lt;source&gt; et &lt;/source&gt;, produis une synthèse destinée à [public].\n\n"
        "Usage de la synthèse : [informer, préparer une décision, organiser des actions ou autre usage précis].\n\n"
        "&lt;source&gt;\n[coller ici une courte source fictive ou explicitement autorisée]\n&lt;/source&gt;\n\n"
        "Format attendu :\n"
        "1. faits établis ;\n2. décisions prises ;\n3. actions à réaliser, avec responsable et échéance uniquement s'ils sont précisés ;\n4. points à confirmer.\n\n"
        "Contraintes : ne rien inventer ; conserver le sens et les réserves ; écrire « non précisé » lorsqu'une information manque ; signaler toute ambiguïté ; terminer par une liste de vérifications dans la source."
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Contrôles", "Retrouver chaque fait, décision, responsable et échéance dans le document d'origine. Une absence doit rester une absence."))
    story.append(PageBreak())

    # 12 - Prompt 3
    story.extend(page_title("Bibliothèque - Prompt 3", "Adapter un contenu à deux publics", "Définissez ce qui doit changer et ce qui doit rester strictement identique."))
    story.append(prompt_box(
        "Sujet : [sujet].\n\n"
        "Informations de référence autorisées :\n- [fait ou idée essentielle 1] ;\n- [fait ou idée essentielle 2] ;\n- [limite ou réserve à conserver].\n\n"
        "Public 1 : [profil débutant, besoin et action attendue].\n"
        "Public 2 : [profil professionnel, niveau de connaissance et action attendue].\n\n"
        "Pour chaque public, fournis : une explication courte ; un exemple adapté ; une erreur fréquente ; une question de vérification ; l'action à retenir.\n\n"
        "Contraintes : conserver les trois informations de référence ; ne rien inventer ; expliquer le vocabulaire technique au public débutant ; préciser les conditions et limites pour le public professionnel.\n\n"
        "Termine par un tableau comparant le vocabulaire, l'exemple, le niveau de détail et le message conservé."
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Contrôles", "Comparer le sens, les faits, les réserves, le vocabulaire, les exemples et le niveau de détail."))
    story.append(PageBreak())

    # 13 - Prompt 4
    story.extend(page_title("Bibliothèque - Prompt 4", "Construire une ressource pédagogique", "Le formateur reste responsable du contenu, de la faisabilité et des adaptations."))
    story.append(prompt_box(
        "Conçois une activité pédagogique à partir des informations suivantes.\n\n"
        "Compétence travaillée : [compétence]. Public : [profil, niveau et besoin]. Prérequis : [prérequis]. Modalité : [modalité]. Durée totale : [durée].\n"
        "Objectif observable : à la fin, l'apprenant sera capable de [verbe d'action et résultat attendu].\n"
        "Informations de référence autorisées : [faits, procédure ou source]. Matériel : [liste]. Adaptations déjà validées : [éléments connus ou aucune].\n\n"
        "Propose : 1. titre et objectif ; 2. étapes minutées ; 3. consignes ; 4. exemple fondé sur les références ; 5. production attendue ; 6. corrigé commenté ; 7. quatre critères observables ; 8. variante d'accessibilité à confirmer ; 9. points à valider avant l'animation.\n\n"
        "Contraintes : activité réalisable dans la durée ; aucune invention ; écrire « à confirmer par le formateur » si une information manque ; aucune adaptation individuelle non validée ; aucune donnée personnelle, sensible ou confidentielle demandée."
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Contrôles", "Alignement entre objectif, activité, production, corrigé et critères ; durée réaliste ; références fiables ; adaptation validée."))
    story.append(PageBreak())

    # 14 - Prompt 5
    story.extend(page_title("Bibliothèque - Prompt 5", "Préparer une page HTML en deux phases", "La première phase s'arrête au cahier des charges. Aucun code ne doit être produit avant validation."))
    story.append(prompt_box(
        "Nous allons préparer une page HTML en deux phases. Ne produis aucun code pendant la première phase.\n\n"
        "Sujet : [sujet]. Public : [profil, niveau et besoin]. Objectif : [ce que le public doit comprendre]. Action principale : [action]. Contenus autorisés : [textes, faits et médias]. Sections obligatoires : [liste]. Identité visuelle : [éléments ou non précisée]. Interactions : [liste ou aucune]. Dépendances autorisées : [liste ou aucune]. Données à ne pas collecter : [liste].\n\n"
        "Phase 1 : reformule le besoin ; pose jusqu'à cinq questions ; propose l'arborescence ; précise le rôle de chaque section ; indique l'ordre sur écran étroit ; décris les interactions au clavier ; prévois libellés, focus, alternatives et contrastes ; termine par un tableau des points à confirmer ; attends ma validation.\n\n"
        "Phase 2, uniquement après validation : produis un HTML autonome et un CSS simple ; utilise une structure sémantique ; n'ajoute aucune dépendance, collecte ou donnée non autorisée ; remplace les informations absentes par « contenu à fournir » ; fournis les tests clavier, liens, titres, images, contrastes, téléphone, ordinateur et absence de défilement horizontal."
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Contrôles", "Valider l'arborescence avant le code, puis tester le clavier, les titres, les libellés, les contrastes et l'affichage mobile."))
    story.append(PageBreak())

    # 15 - Prompt 6
    story.extend(page_title("Bibliothèque - Prompt 6", "Construire un workflow contrôlé", "Le processus reste manuel : aucune automatisation, publication ou décision externe n'est déclenchée."))
    story.append(prompt_box(
        "Nous allons construire un processus de travail manuel et contrôlé. Il ne doit déclencher aucune automatisation ni action externe.\n\n"
        "Tâche : [tâche]. Livrable final : [résultat et format]. Destinataire et usage : [public et action préparée]. Entrées autorisées : [sources]. Données interdites : [liste]. Critères du livrable : [trois à cinq critères]. Responsable de validation : [fonction]. Actions interdites à l'IA : [envoi, publication, décision ou autre].\n\n"
        "Phase 1 : reformule l'objectif ; signale les informations manquantes ; propose trois à cinq étapes avec objectif, entrée, résultat, critères, validation et condition d'arrêt ; vérifie que seul un résultat validé alimente l'étape suivante ; attends ma validation.\n\n"
        "Phase 2 : rédige un prompt par étape avec des variables ; demande uniquement le nécessaire ; impose le format et les critères ; écris « information manquante » au lieu d'inventer ; termine par une pause de validation ; arrête en cas de donnée interdite, source absente ou décision humaine.\n\n"
        "Phase 3 : propose un cas fictif ; indique les traces à conserver ; fournis une grille pour noter le résultat, l'écart, la correction et la décision de poursuivre ou d'arrêter."
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Contrôles", "Valider chaque étape, minimiser les données, appliquer les conditions d'arrêt et conserver la trace des corrections."))
    story.append(PageBreak())

    # 16 - Itération
    story.extend(page_title("Méthode de test", "Améliorer sans tout recommencer", "Une bonne itération nomme un écart observable et modifie uniquement ce qui doit l'être."))
    story.append(
        content_table(
            ["Écart", "Relance ciblée"],
            [
                ["Information manquante", "Pose-moi trois questions sur les informations indispensables avant de poursuivre."],
                ["Ton trop technique", "Réécris pour un débutant et explique chaque terme spécialisé lors de sa première utilisation."],
                ["Réponse trop longue", "Conserve uniquement les faits et actions indispensables dans 150 mots maximum."],
                ["Fait non justifié", "Indique la phrase de la source qui confirme ce fait. Si aucune phrase ne le confirme, retire-le."],
                ["Format incorrect", "Reprends uniquement la présentation selon [structure], sans modifier le contenu déjà validé."],
                ["Processus bloqué", "Arrête l'étape, signale l'entrée manquante et précise la validation humaine nécessaire."],
            ],
            [48 * mm, 123 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Journal de trois versions", "h2"))
    story.append(
        content_table(
            ["Version", "Écart observé", "Correction demandée", "Décision"],
            [["1", "", "", ""], ["2", "", "", ""], ["3", "", "", ""]],
            [22 * mm, 51 * mm, 61 * mm, 37 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(callout("Condition d'arrêt", "Arrêtez lorsque les critères sont atteints ou lorsqu'une source, une donnée autorisée ou une décision humaine manque. La multiplication des relances ne remplace pas la vérification."))
    story.append(PageBreak())

    # 17 - Final
    story.extend(page_title("Évaluation finale", "Concevoir, tester et présenter un prompt maîtrisé", "Réutilisez un travail commencé pendant les exercices. Le formateur évalue la méthode et les contrôles, pas un résultat parfait du premier coup."))
    story.append(
        content_table(
            ["Livrable", "Contenu attendu", "Preuve"],
            [
                ["1. Prompt final", "Prompt initial, écart, amélioration et version finale.", "Journal d'itération ou description."],
                ["2. Résultat", "Résultat final ou maquette adapté au besoin.", "Document, texte ou lien sécurisé."],
                ["3. Contrôles", "Critères, sources, données, limites et décision d'usage.", "Grille ou synthèse de vérification."],
                ["4. Réutilisation", "Variables, prochain usage et contrôle humain à conserver.", "Modèle réutilisable expliqué."],
            ],
            [36 * mm, 80 * mm, 55 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(p("Les quatre critères", "h2"))
    story.extend(bullets([
        "<b>Cadrage :</b> besoin, public, résultat, informations autorisées et contraintes.",
        "<b>Prompt :</b> structure, critères de réussite et amélioration justifiée.",
        "<b>Contrôles :</b> sources, données, limites, décision et validation humaine.",
        "<b>Explication :</b> choix, correction, conditions de réutilisation et transfert.",
    ]))
    story.append(callout("Règle de validation", "Les quatre critères doivent atteindre au minimum le niveau <b>Acquis</b>. Le niveau <b>Maîtrisé</b> valorise une autonomie supplémentaire mais n'est pas obligatoire.", "amber"))
    story.append(p("Mon cas", "h2"))
    story.append(worksheet([("Besoin et public", "Situation et utilisateur du résultat"), ("Résultat attendu", "Livrable concret"), ("Risque principal", "Point de vigilance ou condition d'arrêt"), ("Validation", "Personne et sources de contrôle")]))
    story.append(PageBreak())

    # 18 - Lexique
    story.extend(page_title("Lexique essentiel", "Douze notions pour se repérer", "Retrouvez les 36 définitions illustrées dans le lexique de l'espace apprenant."))
    glossary = [
        ("Ancrage dans une source", "Consigne qui limite la réponse à un document clairement identifié."),
        ("Condition d'arrêt", "Situation qui interrompt le processus pour éviter une erreur ou demander une décision humaine."),
        ("Contexte", "Informations utiles pour comprendre la situation, le public et l'usage."),
        ("Critère de réussite", "Condition observable permettant de contrôler le résultat."),
        ("Format de sortie", "Forme précise demandée pour présenter la réponse."),
        ("Hallucination", "Information fausse, inventée ou non vérifiée produite par une IA."),
        ("Itération", "Nouvel essai après analyse d'un écart et correction ciblée."),
        ("Message invariant", "Information qui doit conserver le même sens dans toutes les versions."),
        ("Prompt", "Instruction ou ensemble de consignes fourni à une IA."),
        ("Source de référence", "Document dans lequel les faits doivent être vérifiés."),
        ("Validation humaine", "Contrôle réalisé par une personne compétente avant utilisation."),
        ("Workflow", "Enchaînement d'étapes, d'entrées, de résultats et de contrôles."),
    ]
    cells = [[Paragraph(f"<b><font color='{GREEN.hexval()}'>{term}</font></b><br/>{definition}", styles["callout"])] for term, definition in glossary]
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
    story.append(callout("Bibliothèque Notion", "Les six prompts complets, leurs variables et leurs contrôles sont également disponibles depuis l'onglet <b>Supports et liens</b> de l'espace apprenant."))
    story.append(PageBreak())

    # 19 - Checklist
    story.extend(page_title("Avant utilisation", "Checklist finale", "Cochez chaque ligne avant d'utiliser ou de diffuser un résultat préparé avec une IA."))
    checks = [
        "☐ Le besoin, le public et le résultat attendu sont explicites.",
        "☐ L'outil utilisé est autorisé pour cette tâche.",
        "☐ Les informations transmises sont nécessaires, autorisées et minimisées.",
        "☐ Les sources de référence sont clairement identifiées.",
        "☐ Le résultat respecte le format et les critères de réussite.",
        "☐ Les faits, chiffres, dates, noms, liens et citations ont été vérifiés.",
        "☐ Les informations absentes ou incertaines restent visibles.",
        "☐ Le ton, le vocabulaire et les exemples conviennent au public.",
        "☐ Aucune action externe ou décision sensible n'est déclenchée automatiquement.",
        "☐ Les limites et conditions d'arrêt ont été respectées.",
        "☐ Une personne compétente a validé le résultat avant utilisation.",
        "☐ Les versions et contrôles utiles ont été conservés si l'enjeu le justifie.",
    ]
    checklist = Table([[p(item, "body")] for item in checks], colWidths=[171 * mm])
    checklist.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, LIGHT]),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2 * mm),
    ]))
    story.append(checklist)
    story.append(Spacer(1, 5 * mm))
    story.append(p("Ma prochaine amélioration", "h2"))
    story.append(worksheet([("Écart repéré", "Ce qui ne répond pas encore au besoin"), ("Correction ciblée", "Le changement à apporter au prompt"), ("Contrôle humain", "La personne, la source et la décision finale")]))
    story.append(Spacer(1, 5 * mm))
    story.append(callout("Responsabilité humaine", "L'IA peut accélérer une préparation. Elle ne remplace ni l'expertise métier, ni la vérification des sources, ni la décision de la personne responsable."))

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
        title="Guide pratique - Prompt Engineering - Niveau 1",
        author="FormaPrompt - Thierry FREZARD",
        subject="Support pédagogique de la formation Prompt Engineering - Niveau 1",
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
