from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import Image, PageBreak, Paragraph, Spacer, Table, TableStyle

from generate_guide_ia_generative import (
    AMBER_PALE,
    BORDER,
    CROPPED_LOGO,
    GREEN,
    GREEN_LINE,
    GREEN_PALE,
    LIGHT,
    MUTED,
    NAVY,
    PAGE_HEIGHT,
    PAGE_WIDTH,
    SLATE,
    WHITE,
    GuideDocTemplate,
    bullets,
    callout,
    content_table,
    p,
    page_title,
    prepare_logo,
    styles,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "guide-formateur-ia-generative-formaprompt.pdf"
PUBLIC_COPY = ROOT / "webapp" / "public" / "assets" / "guide-formateur-ia-generative-formaprompt.pdf"


def trainer_table(headers, rows, widths, font_size=7.7):
    cell_style = styles["table_cell"].clone("TrainerTableCell")
    cell_style.fontSize = font_size
    cell_style.leading = font_size + 2.4
    bold_style = styles["table_cell_bold"].clone("TrainerTableCellBold")
    bold_style.fontSize = font_size
    bold_style.leading = font_size + 2.4
    header_style = styles["table_header"].clone("TrainerTableHeader")
    header_style.fontSize = font_size
    header_style.leading = font_size + 2.4

    data = [[Paragraph(value, header_style) for value in headers]]
    for row in rows:
        data.append([
            Paragraph(value, bold_style if index == 0 else cell_style)
            for index, value in enumerate(row)
        ])
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GREEN),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.45, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT]),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.1 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.1 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2.0 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.0 * mm),
    ]))
    return table


def checklist(items):
    data = [[p(f"[ ] {item}", "small")] for item in items]
    table = Table(data, colWidths=[171 * mm])
    table.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, LIGHT]),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2.1 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.1 * mm),
    ]))
    return table


def page(story, kicker, title, intro=None):
    story.extend(page_title(kicker, title, intro))


def next_page(story):
    story.append(PageBreak())


def session_page(story, kicker, title, objective, rows, evidence, trainer_note):
    page(story, kicker, title, objective)
    story.append(trainer_table(
        ["Temps", "Séquence", "Conduite et résultat attendu"],
        rows,
        [23 * mm, 45 * mm, 103 * mm],
    ))
    story.append(Spacer(1, 3.5 * mm))
    story.append(p("À conserver après la séance", "h2"))
    story.extend(bullets(evidence))
    story.append(callout("Repère formateur", trainer_note, "gray"))


def cover_page(canvas, doc):
    canvas.saveState()
    canvas.setTitle("Guide formateur - Formation IA générative")
    canvas.setAuthor("FormaPrompt - Thierry FREZARD")
    canvas.setSubject("Déroulés pédagogiques, animation, évaluation et preuves de la formation IA générative")
    canvas.setKeywords("guide formateur, IA générative, déroulé pédagogique, évaluation, Qualiopi, FormaPrompt")
    canvas.setFillColor(GREEN)
    canvas.rect(0, PAGE_HEIGHT - 19 * mm, PAGE_WIDTH, 19 * mm, fill=1, stroke=0)
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_WIDTH, 24 * mm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Arial", 8.5)
    canvas.drawCentredString(PAGE_WIDTH / 2, 10 * mm, "Document interne - FormaPrompt")
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
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, PAGE_HEIGHT - 12 * mm, "Guide formateur - IA générative")
    canvas.setStrokeColor(BORDER)
    canvas.line(20 * mm, 15 * mm, PAGE_WIDTH - 20 * mm, 15 * mm)
    canvas.setFont("Arial", 8)
    canvas.drawString(20 * mm, 10 * mm, "Version juillet 2026 - Document interne")
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_story():
    story = []

    # 1 - Couverture
    story.extend([
        Spacer(1, 25 * mm),
        Image(str(CROPPED_LOGO), width=66 * mm, height=45 * mm, kind="proportional"),
        Spacer(1, 7 * mm),
        p("DOCUMENT INTERNE", "cover_eyebrow"),
        p("Guide formateur<br/>Formation IA générative", "cover_title"),
        p("Comprendre, pratiquer et sécuriser ses usages - 10 heures", "cover_subtitle"),
        callout(
            "Trois organisations prêtes à animer",
            "Présentiel en 2 séances de 5 h, classe virtuelle en 4 séances de 2 h 30, ou classe virtuelle en 3 séances de 4 h + 4 h + 2 h. Les objectifs, exercices et critères d'évaluation restent identiques.",
        ),
        Spacer(1, 4 * mm),
        p("Déroulés - démonstrations - relances - adaptations - preuves", "cover_subtitle"),
    ])
    next_page(story)

    # 2 - Mode d'emploi
    page(story, "Cadre", "Comment utiliser ce guide", "Ce document complète l'espace apprenant et les supports imprimables. Il aide à conduire la formation sans transformer le minutage en scénario rigide.")
    story.append(content_table(
        ["Repère", "Règle de conduite"],
        [
            ["Durée", "Les 10 heures correspondent au temps pédagogique accompagné. Les pauses et les éventuels temps techniques sont organisés sans réduire ce volume."],
            ["Progression", "Conserver l'ordre des cinq modules. Une séance peut s'arrêter au milieu d'un module si le point de reprise est annoncé et tracé."],
            ["Grand débutant", "Montrer une seule action à la fois, verbaliser chaque choix, laisser le temps de reproduire, puis faire expliquer la méthode avec ses propres mots."],
            ["Exercices", "Faire préparer dans le cahier ou dans un brouillon, puis enregistrer la version officielle dans l'espace apprenant. Ne jamais recopier une donnée sensible."],
            ["Évaluation", "Observer la démarche autant que le résultat. Une réponse élégante mais non vérifiée ne suffit pas."],
            ["Traçabilité", "Conserver des preuves proportionnées et minimisées. Ce guide propose des exemples ; la conformité dépend de la mise en oeuvre réelle et du contexte de la prestation."],
        ],
        [34 * mm, 137 * mm],
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("À ne pas faire", "Ne pas demander aux apprenants d'utiliser un compte personnel non prévu, de déposer un document confidentiel ou de transmettre un mot de passe, une signature, une donnée de santé ou un dossier client dans un assistant d'IA.", "red"))
    story.append(p("Documents associés", "h2"))
    story.extend(bullets([
        "Guide pratique IA générative : apports, exemples et modèles de consignes.",
        "Cahier d'activités : préparation, réalisation, bilan et zone de retour formateur.",
        "Grille de vérification : sources, données, biais, droits, décision et traçabilité.",
        "Modèle du cas final et plan d'action : quatre livrables et autoévaluation.",
    ]))
    next_page(story)

    # 3 - Avant la formation
    page(story, "Préparation", "Checklist avant la première séance", "Préparer le cadre, les démonstrations et les solutions de repli avant l'accueil du groupe.")
    story.append(checklist([
        "Vérifier la convention, la modalité, les dates, la durée et le nombre de participants.",
        "Contrôler l'accessibilité du lieu ou de la classe virtuelle et les adaptations convenues.",
        "Tester les liens de connexion, le partage d'écran, le son et une solution de secours.",
        "Vérifier que chaque apprenant possède son accès à l'espace apprenant sans demander son mot de passe.",
        "Préparer des cas fictifs sans donnée personnelle, sensible ou confidentielle.",
        "Ouvrir les supports, le cahier d'activités, la grille de vérification et le cas final.",
        "Préparer deux réponses contrastées pour chaque démonstration : une version fragile et une version améliorée.",
        "Consulter les positionnements disponibles et repérer les besoins sans étiqueter les personnes.",
        "Prévoir un binôme, une reformulation orale ou un support agrandi si nécessaire.",
        "Préparer l'émargement et la procédure de validation de présence de chaque séance.",
    ]))
    story.append(Spacer(1, 5 * mm))
    story.append(p("Ouverture recommandée", "h2"))
    story.extend(bullets([
        "Présenter l'objectif : apprendre à cadrer, produire, vérifier et décider, pas seulement à obtenir une réponse.",
        "Rappeler le droit à l'erreur dans les exercices et l'interdiction d'utiliser des données réelles non autorisées.",
        "Expliquer la différence entre un brouillon et une réponse déclarée terminée dans l'espace apprenant.",
        "Demander un exemple d'usage souhaité et une inquiétude ; les noter sans collecter d'information inutile.",
    ]))
    story.append(callout("Point d'attention", "Si une adaptation importante est découverte en séance, convenir d'une solution avec l'apprenant, la mettre en oeuvre et tracer uniquement ce qui est nécessaire. Ne pas inscrire de diagnostic médical dans les notes pédagogiques.", "amber"))
    next_page(story)

    # 4 - Matrice commune
    page(story, "Architecture", "Matrice commune des cinq modules", "Quel que soit le rythme choisi, chaque module produit une trace observable et prépare le cas pratique final.")
    story.append(trainer_table(
        ["Module", "Objectif observable", "Exercice / preuve pédagogique", "Lien avec le cas final"],
        [
            ["1. Comprendre", "Classer une tâche selon son niveau de vigilance et justifier ce choix.", "Cartographie de cinq tâches et justification.", "Choisir un cas réaliste, réversible et autorisé."],
            ["2. Dialoguer", "Rédiger une consigne avec objectif, contexte, données, contraintes, format et critères.", "Comparaison avant / après d'une consigne.", "Produire la consigne finale et expliquer ses améliorations."],
            ["3. Produire", "Comparer deux versions et finaliser un livrable fidèle aux faits fournis.", "Livrable professionnel vérifié.", "Présenter le livrable retenu et sa logique d'itération."],
            ["4. Vérifier", "Contrôler faits, sources, données, droits, biais et décision humaine.", "Grille de vérification complétée.", "Référencer la grille utilisée et les corrections réalisées."],
            ["5. Agir", "Définir une expérimentation de 30 jours, un indicateur et une règle de décision.", "Fiche action d'une page.", "Remettre un plan d'action réaliste et mesurable."],
        ],
        [27 * mm, 53 * mm, 48 * mm, 43 * mm],
        7.3,
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Trame interne d'un bloc de 2 heures", "h2"))
    story.append(content_table(
        ["Temps indicatif", "Fonction pédagogique"],
        [
            ["10 min", "Réactivation, objectif et critère de réussite."],
            ["25 min", "Explication avec vocabulaire simple et exemple professionnel."],
            ["25 min", "Démonstration commentée, avec questions de prédiction."],
            ["35 min", "Pratique guidée : l'apprenant reproduit et explique ses choix."],
            ["20 min", "Exercice individuel, transfert et autoévaluation."],
            ["5 min", "Synthèse, preuve à enregistrer et point de reprise."],
        ],
        [38 * mm, 133 * mm],
    ))
    story.append(callout("Souplesse", "Les durées sont indicatives. Conserver l'objectif, la pratique et la vérification ; réduire d'abord le nombre d'exemples, jamais le temps nécessaire à l'apprenant pour comprendre et agir."))
    next_page(story)

    # 5 - Présentiel aperçu
    page(story, "Présentiel - 2 x 5 h", "Vue d'ensemble du rythme en deux journées", "Ce rythme favorise l'immersion. Les pauses sont ajoutées au planning annoncé sans diminuer les 10 heures pédagogiques accompagnées.")
    story.append(content_table(
        ["Séance", "Répartition", "Résultats attendus en fin de séance"],
        [
            ["1 - 5 h", "Module 1 : 2 h<br/>Module 2 : 2 h<br/>Début du module 3 : 1 h", "Cartographie des usages terminée ; première consigne structurée ; source et première version du livrable choisies."],
            ["2 - 5 h", "Fin du module 3 : 1 h<br/>Module 4 : 2 h<br/>Module 5 : 2 h", "Livrable finalisé ; grille de vérification complétée ; action à 30 jours définie ; cas final prêt à être remis ou repris."],
        ],
        [30 * mm, 53 * mm, 88 * mm],
    ))
    story.append(Spacer(1, 5 * mm))
    story.append(p("Organisation matérielle", "h2"))
    story.extend(bullets([
        "Prévoir un poste ou un appareil par apprenant, une connexion stable et une projection lisible.",
        "Alterner démonstration collective, pratique individuelle et verbalisation en binôme.",
        "Afficher le point de reprise du module 3 à la fin de la première journée.",
        "Recueillir la présence au début et à la fin de chaque séance selon le dispositif prévu.",
    ]))
    story.append(p("Risque principal", "h2"))
    story.append(callout("Fatigue cognitive", "Cinq heures demandent des variations d'activité. Prévoir plusieurs pauses courtes hors temps pédagogique, limiter les démonstrations continues et faire produire quelque chose au moins toutes les 30 minutes.", "amber"))
    story.append(p("Production intermédiaire obligatoire", "h2"))
    story.extend(bullets([
        "Avant de quitter la séance 1, chaque apprenant nomme son cas, sa source autorisée et le résultat qu'il veut produire.",
        "Au début de la séance 2, il reformule ce point de reprise en moins d'une minute.",
    ]))
    next_page(story)

    # 6 - Présentiel S1
    session_page(
        story,
        "Présentiel - séance 1/2",
        "5 heures : comprendre, formuler et commencer à produire",
        "Objectif : passer d'un usage envisagé à une première production cadrée, sans donnée confidentielle.",
        [
            ["0:00-0:20", "Accueil et positionnement", "Cadre, émargement, sécurité des données, objectifs. Faire verbaliser un usage et une vigilance."],
            ["0:20-2:00", "Module 1", "Distinguer IA, IA générative, assistant et moteur de recherche. Classer cinq tâches ; justification attendue pour chacune."],
            ["2:00-2:15", "Synthèse M1", "Exercice 1 : cartographie enregistrée en brouillon ou terminée selon les critères."],
            ["2:15-3:00", "Module 2 - apport", "Décomposer une consigne vague en sept repères. Faire prédire ce qui manque avant la démonstration."],
            ["3:00-4:05", "Module 2 - pratique", "Transformer puis tester une consigne. Comparer les deux réponses avec des critères visibles."],
            ["4:05-4:20", "Synthèse M2", "Exercice 2 et autoévaluation. Reformulation par l'apprenant, pas simple copie du modèle."],
            ["4:20-4:55", "Module 3 - lancement", "Choisir une source fictive ou autorisée, un public et un livrable. Produire une première version."],
            ["4:55-5:00", "Clôture", "Noter le point de reprise : source, consigne, première version et question restante."],
        ],
        [
            "Émargement de la séance validé selon la procédure prévue.",
            "Positionnement initial ou note factuelle sur son exploitation pédagogique.",
            "Dernières versions des exercices 1 et 2 ; brouillon du module 3 si enregistré.",
            "Note d'adaptation ou d'incident uniquement si nécessaire, sans donnée sensible superflue.",
        ],
        "Le minutage inclut l'accueil pédagogique et la restitution du positionnement dans le module 1. Les pauses restent organisées en plus de ces cinq heures.",
    )
    next_page(story)

    # 7 - Présentiel S2
    session_page(
        story,
        "Présentiel - séance 2/2",
        "5 heures : finaliser, vérifier et préparer l'action",
        "Objectif : terminer un livrable vérifié, préparer l'expérimentation à 30 jours et sécuriser la remise finale.",
        [
            ["0:00-0:15", "Réactivation", "Faire restituer le point de reprise et le critère de réussite. Traiter une question commune."],
            ["0:15-1:00", "Module 3 - itération", "Comparer deux versions, expliquer le choix, corriger les faits et finaliser le livrable."],
            ["1:00-1:15", "Synthèse M3", "Exercice 3 : la version retenue et les vérifications sont explicites."],
            ["1:15-2:00", "Module 4 - démonstration", "Auditer une réponse fragile : fait non sourcé, donnée inutile, droit incertain ou biais."],
            ["2:00-3:05", "Module 4 - pratique", "Compléter la grille, ouvrir les sources, corriger ou écarter les éléments non vérifiables."],
            ["3:05-3:15", "Synthèse M4", "Exercice 4 : décision motivée - diffuser, corriger, limiter ou ne pas utiliser."],
            ["3:15-4:25", "Module 5", "Définir action, responsable, échéance, indicateur, garde-fous et règle de décision à 30 jours."],
            ["4:25-5:00", "Cas final et clôture", "Vérifier les quatre livrables, autoévaluer, expliquer les suites et recueillir le bilan à chaud séparément."],
        ],
        [
            "Émargement finalisé ; durées réellement suivies tracées selon le dispositif.",
            "Exercices 3, 4 et 5 ; grille de vérification référencée.",
            "Remise du cas final ou trace claire de la reprise demandée et de l'échéance.",
            "Évaluation, appréciation et axes de progrès enregistrés après correction ; satisfaction conservée séparément.",
        ],
        "Ne validez pas le cas final sous pression en fin de journée. Si une vérification manque, demandez une reprise ciblée et indiquez précisément la preuve attendue.",
    )
    next_page(story)

    # 8 - Distanciel 4 x 2h30 aperçu
    page(story, "Classe virtuelle - 4 x 2 h 30", "Vue d'ensemble du rythme fractionné", "Ce rythme limite la fatigue à l'écran et facilite le travail interséance. Chaque séance se termine par un point de reprise explicite.")
    story.append(content_table(
        ["Séance", "Répartition", "Point de sortie"],
        [
            ["1 - 2 h 30", "Module 1 : 2 h<br/>Module 2 : 30 min", "Usage classé ; consigne vague choisie et premiers éléments identifiés."],
            ["2 - 2 h 30", "Fin module 2 : 1 h 30<br/>Module 3 : 1 h", "Consigne testée ; source, public et deux versions du livrable préparés."],
            ["3 - 2 h 30", "Fin module 3 : 1 h<br/>Module 4 : 1 h 30", "Livrable finalisé ; première grille de contrôle et sources ouvertes."],
            ["4 - 2 h 30", "Fin module 4 : 30 min<br/>Module 5 : 2 h", "Décision de diffusion motivée ; action à 30 jours ; cas final remis ou reprise planifiée."],
        ],
        [31 * mm, 60 * mm, 80 * mm],
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Rituels de classe virtuelle", "h2"))
    story.extend(bullets([
        "Démarrer par un contrôle son, affichage et accès ; ne jamais demander le partage d'un écran contenant des données confidentielles.",
        "Toutes les 20 à 30 minutes : question dans le chat, vote, annotation, reproduction ou explication orale.",
        "Autoriser une réponse orale, écrite ou dans le cahier selon la situation ; l'objectif évalué reste identique.",
        "Prévoir une courte pause hors temps pédagogique si nécessaire et annoncer l'heure exacte de reprise.",
        "Envoyer seulement les liens nécessaires ; ne pas enregistrer la visioconférence sans information, base légale et durée de conservation définies.",
    ]))
    story.append(callout("Interséance", "Une activité facultative peut consolider la séance, mais elle ne remplace pas les 10 heures accompagnées et ne doit pas être indispensable pour atteindre un objectif non traité avec le formateur.", "amber"))
    next_page(story)

    # 9 à 12 - Distanciel 4 séances
    session_page(
        story,
        "Classe virtuelle - séance 1/4",
        "2 h 30 : comprendre et amorcer la formulation",
        "Objectif : choisir un usage proportionné et repérer ce qui manque dans une consigne vague.",
        [
            ["0:00-0:15", "Connexion et cadre", "Présence, prise en main, confidentialité, objectifs et modalités d'interaction."],
            ["0:15-0:35", "Positionnement", "Restituer les besoins du groupe et faire nommer un usage envisagé."],
            ["0:35-1:20", "M1 - notions", "IA, IA générative, assistant, moteur de recherche, limites et responsabilité humaine."],
            ["1:20-2:00", "M1 - pratique", "Classer cinq tâches et justifier le niveau de vigilance."],
            ["2:00-2:10", "M1 - synthèse", "Exercice 1 et autoévaluation."],
            ["2:10-2:25", "M2 - lancement", "Afficher une demande vague ; faire repérer objectif, public et faits manquants."],
            ["2:25-2:30", "Point de reprise", "Chaque apprenant conserve une demande à structurer en séance 2."],
        ],
        ["Présence et éventuel incident technique.", "Positionnement exploité.", "Exercice 1 et demande choisie pour le module 2."],
        "Si l'accès à l'outil d'IA échoue, utilisez des réponses préparées. L'objectif de cette séance reste la compréhension et le classement, pas la maîtrise technique d'un service.",
    )
    next_page(story)

    session_page(
        story,
        "Classe virtuelle - séance 2/4",
        "2 h 30 : structurer la consigne et lancer la production",
        "Objectif : tester une consigne complète et produire deux premières versions à comparer.",
        [
            ["0:00-0:10", "Réactivation", "Faire citer trois éléments manquants dans la consigne vague."],
            ["0:10-0:40", "M2 - démonstration", "Ajouter contexte, informations, contraintes, format et critères ; prédire l'effet de chaque ajout."],
            ["0:40-1:20", "M2 - pratique", "Tester avant / après, comparer et améliorer sans recopier le modèle mot à mot."],
            ["1:20-1:30", "M2 - synthèse", "Exercice 2 : consigne et comparaison enregistrées."],
            ["1:30-1:55", "M3 - méthode", "Source vers consigne, première version, contrôle, seconde version et décision."],
            ["1:55-2:20", "M3 - pratique", "Produire deux versions avec les mêmes faits autorisés."],
            ["2:20-2:30", "Point de reprise", "Conserver versions, écarts observés et question à vérifier."],
        ],
        ["Présence.", "Exercice 2.", "Deux versions du livrable ou brouillon daté du module 3."],
        "Si un apprenant peine à écrire une consigne complète, faites-lui répondre oralement aux sept questions puis reformulez ensemble, sans prendre le contrôle de son travail.",
    )
    next_page(story)

    session_page(
        story,
        "Classe virtuelle - séance 3/4",
        "2 h 30 : finaliser puis apprendre à vérifier",
        "Objectif : choisir une version sur critères et commencer un audit réellement fondé sur les sources.",
        [
            ["0:00-0:10", "Réactivation", "Faire nommer un écart entre les deux versions."],
            ["0:10-0:50", "M3 - comparaison", "Comparer fidélité, clarté, ton, complétude et action attendue."],
            ["0:50-1:00", "M3 - synthèse", "Exercice 3 : livrable final et justification du choix."],
            ["1:00-1:30", "M4 - démonstration", "Auditer une réponse comportant un fait non prouvé et une donnée inutile."],
            ["1:30-2:10", "M4 - pratique", "Ouvrir les sources, remplir la grille et signaler ce qui reste incertain."],
            ["2:10-2:25", "M4 - mise en commun", "Comparer les décisions : corriger, limiter ou ne pas utiliser."],
            ["2:25-2:30", "Point de reprise", "Noter les contrôles restants et la preuve attendue."],
        ],
        ["Présence.", "Exercice 3.", "Grille de vérification partielle et sources effectivement consultées."],
        "N'acceptez pas « j'ai demandé à l'IA si c'était vrai » comme vérification. Une preuve est indépendante de la réponse contrôlée et doit être réellement consultée.",
    )
    next_page(story)

    session_page(
        story,
        "Classe virtuelle - séance 4/4",
        "2 h 30 : décider, agir et préparer l'évaluation finale",
        "Objectif : conclure l'audit, définir l'expérimentation et remettre les quatre éléments du cas final.",
        [
            ["0:00-0:10", "Réactivation", "Faire citer le contrôle restant et la décision provisoire."],
            ["0:10-0:25", "M4 - décision", "Finaliser la grille et motiver diffuser, corriger, limiter ou ne pas utiliser."],
            ["0:25-0:30", "M4 - synthèse", "Exercice 4 déclaré terminé si les preuves sont suffisantes."],
            ["0:30-1:05", "M5 - démonstration", "Transformer un souhait vague en action de 30 jours avec indicateur et garde-fous."],
            ["1:05-1:45", "M5 - pratique", "Rédiger la fiche action, anticiper un obstacle et définir une règle de décision."],
            ["1:45-1:55", "M5 - synthèse", "Exercice 5 et engagement réaliste."],
            ["1:55-2:20", "Cas final", "Contrôler les quatre livrables et s'autoévaluer sur les quatre critères."],
            ["2:20-2:30", "Clôture", "Remise ou reprise planifiée ; expliquer correction, attestations et satisfaction."],
        ],
        ["Présence finale.", "Exercices 4 et 5.", "Cas final remis ou reprise tracée.", "Évaluation et bilan à chaud conservés séparément."],
        "Le plan d'action doit rester petit et testable. Une action spectaculaire sans responsable, échéance, indicateur ou règle d'arrêt n'est pas une bonne réponse.",
    )
    next_page(story)

    # 13 - Distanciel 4+4+2 aperçu
    page(story, "Classe virtuelle - 4 h + 4 h + 2 h", "Vue d'ensemble du rythme en trois séances", "Ce rythme suit naturellement deux modules par grande séance, puis réserve les deux dernières heures au passage à l'action et à la remise finale.")
    story.append(content_table(
        ["Séance", "Répartition", "Résultat attendu"],
        [
            ["1 - 4 h", "Module 1 : 2 h<br/>Module 2 : 2 h", "Usage proportionné choisi ; consigne structurée, testée et améliorée."],
            ["2 - 4 h", "Module 3 : 2 h<br/>Module 4 : 2 h", "Livrable comparé et finalisé ; audit complet et décision motivée."],
            ["3 - 2 h", "Module 5 : 2 h", "Expérimentation à 30 jours ; cas final contrôlé et remis ou reprise planifiée."],
        ],
        [31 * mm, 56 * mm, 84 * mm],
    ))
    story.append(Spacer(1, 5 * mm))
    story.append(p("Conditions de réussite", "h2"))
    story.extend(bullets([
        "Prévoir une coupure nette entre les deux modules des séances de 4 heures, en plus du temps pédagogique.",
        "Faire enregistrer chaque exercice avant de passer au module suivant pour éviter une accumulation en fin de séance.",
        "Envoyer le point de reprise après les séances 1 et 2 : production disponible, vérification à faire et prochaine action.",
        "Réserver la séance 3 à la mise en oeuvre ; ne pas y reporter des apports essentiels non traités auparavant.",
    ]))
    story.append(callout("Vigilance", "Quatre heures en visioconférence restent exigeantes. Variez les canaux, évitez plus de 15 minutes d'exposé continu et accordez un vrai temps de manipulation sur chaque module.", "amber"))
    story.append(p("Point d'étape après la séance 2", "h2"))
    story.extend(bullets([
        "Les exercices 1 à 4 doivent être terminés ou accompagnés d'une reprise précise.",
        "Le cas final possède déjà sa consigne, son livrable et sa grille ; la séance 3 ajoute le plan d'action.",
    ]))
    next_page(story)

    # 14 à 16 - Distanciel 3 séances
    session_page(
        story,
        "Classe virtuelle - séance 1/3",
        "4 heures : comprendre et dialoguer",
        "Objectif : choisir un usage adapté et rédiger une consigne claire, testable et sécurisée.",
        [
            ["0:00-0:20", "Accueil", "Présence, technique, positionnement, confidentialité et objectifs."],
            ["0:20-0:55", "M1 - notions", "Distinguer outils, capacités, limites et place de la décision humaine."],
            ["0:55-1:40", "M1 - pratique", "Classer cinq tâches et argumenter le niveau de vigilance."],
            ["1:40-2:00", "M1 - exercice", "Cartographie, autoévaluation et synthèse."],
            ["2:00-2:35", "M2 - méthode", "Analyser une demande vague puis présenter les sept repères."],
            ["2:35-3:25", "M2 - démonstration", "Construire et tester une consigne ; comparer les effets des contraintes."],
            ["3:25-3:50", "M2 - pratique", "Personnaliser une consigne sur un cas fictif ou autorisé."],
            ["3:50-4:00", "M2 - exercice", "Enregistrer la comparaison et annoncer le point de reprise."],
        ],
        ["Présence.", "Positionnement exploité.", "Exercices 1 et 2.", "Adaptation ou incident si nécessaire."],
        "La coupure entre les modules est ajoutée au planning. Si le groupe avance lentement, réduisez le nombre d'exemples du module 2 mais conservez la pratique et l'autoévaluation.",
    )
    next_page(story)

    session_page(
        story,
        "Classe virtuelle - séance 2/3",
        "4 heures : produire et vérifier",
        "Objectif : finaliser un livrable sur critères puis prendre une décision fondée sur un audit documenté.",
        [
            ["0:00-0:10", "Réactivation", "Faire reformuler les critères de la consigne et annoncer le livrable."],
            ["0:10-0:40", "M3 - méthode", "Source, consigne, version 1, contrôle, version 2, décision."],
            ["0:40-1:25", "M3 - démonstration", "Comparer deux contenus produits à partir des mêmes faits."],
            ["1:25-1:50", "M3 - pratique", "Finaliser le livrable et justifier la version retenue."],
            ["1:50-2:00", "M3 - exercice", "Enregistrer le livrable et les vérifications."],
            ["2:00-2:40", "M4 - démonstration", "Auditer faits, sources, données, droits, biais et décision."],
            ["2:40-3:35", "M4 - pratique", "Compléter la grille, ouvrir les preuves et corriger ce qui doit l'être."],
            ["3:35-4:00", "M4 - décision", "Motiver la décision, terminer l'exercice 4 et préparer le cas final."],
        ],
        ["Présence.", "Exercices 3 et 4.", "Grille référencée et sources consultées.", "Consigne et livrable déjà identifiés pour le cas final."],
        "La grille ne doit pas devenir une formalité cochée après coup. Demandez à l'apprenant de montrer une preuve ouverte et d'expliquer une correction qu'il a réellement effectuée.",
    )
    next_page(story)

    session_page(
        story,
        "Classe virtuelle - séance 3/3",
        "2 heures : agir et finaliser le parcours",
        "Objectif : élaborer un test responsable à 30 jours et finaliser les quatre livrables du cas pratique.",
        [
            ["0:00-0:10", "Réactivation", "Faire citer une compétence acquise et une vigilance à conserver."],
            ["0:10-0:35", "M5 - apport", "Du souhait à l'action : résultat, responsable, échéance, indicateur, garde-fous."],
            ["0:35-1:05", "M5 - démonstration", "Construire une expérimentation, anticiper un obstacle et fixer une règle d'arrêt."],
            ["1:05-1:30", "M5 - pratique", "Rédiger la fiche action et vérifier qu'elle reste mesurable et réversible."],
            ["1:30-1:40", "M5 - exercice", "Enregistrer l'exercice 5 et l'autoévaluation."],
            ["1:40-1:55", "Cas final", "Contrôler consigne, livrable, grille et plan d'action ; remettre ou planifier la reprise."],
            ["1:55-2:00", "Clôture", "Expliquer correction, attestations, ressources et bilan à chaud."],
        ],
        ["Présence finale.", "Exercice 5.", "Cas final ou reprise datée.", "Évaluation et satisfaction conservées séparément."],
        "Si le cas final n'est pas prêt, ne remplacez pas une preuve manquante par une appréciation générale. Indiquez le critère concerné, l'élément attendu et une échéance réaliste.",
    )
    next_page(story)

    # 17 - Démonstrations
    page(story, "Animation", "Cinq démonstrations et réponses attendues", "Chaque démonstration part d'un cas fictif court. Faites prédire l'étape suivante avant de montrer votre choix.")
    story.append(trainer_table(
        ["Module", "Démonstration", "Réponse attendue / signe de compréhension"],
        [
            ["1", "Classer : invitation générique, synthèse interne, décision de recrutement.", "L'apprenant distingue usage adapté, contrôle renforcé et décision non déléguée ; il justifie par les données, les conséquences et la possibilité de corriger."],
            ["2", "Transformer « Fais-moi un bon mail » en consigne structurée.", "Il nomme objectif, contexte, public, faits, contraintes, format et critères ; il refuse d'inventer les informations manquantes."],
            ["3", "Comparer deux messages créés à partir de la même note source.", "Il choisit sur critères et signale précisément un oubli, une invention ou une amélioration utile."],
            ["4", "Auditer une réponse qui cite une source plausible mais non consultée et contient une donnée inutile.", "Il ouvre une source indépendante, retire la donnée, indique l'incertitude et décide de corriger ou de ne pas diffuser."],
            ["5", "Transformer « utiliser plus l'IA » en test de 30 jours.", "Il définit une tâche, un responsable, une échéance, un indicateur, un garde-fou et une règle pour poursuivre, adapter ou arrêter."],
        ],
        [20 * mm, 65 * mm, 86 * mm],
        7.4,
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Technique de démonstration", "h2"))
    story.extend(bullets([
        "Annoncez le résultat attendu et le critère observé avant de manipuler l'outil.",
        "Verbalisez vos hésitations : ce que vous vérifiez, ce que vous refusez d'envoyer et pourquoi vous recommencez.",
        "Montrez une erreur utile, puis la correction. Ne présentez pas l'outil comme infaillible.",
        "Terminez par une question de transfert : « Que changeriez-vous pour votre contexte ? »",
    ]))
    story.append(callout("Réponse acceptable", "Une formulation différente du modèle peut être correcte si la démarche, les critères et les contrôles sont explicites. Évaluez la compétence, pas la ressemblance avec votre exemple."))
    next_page(story)

    # 18 - Relances et adaptations
    page(story, "Accompagnement", "Relances et adaptations pour un grand débutant", "Une relance utile aide à raisonner sans donner immédiatement la réponse.")
    story.append(content_table(
        ["Situation observée", "Relance possible", "Adaptation sans changer l'objectif"],
        [
            ["« Je ne sais pas quoi choisir. »", "« Quelle tâche est fréquente, simple à corriger et sans donnée confidentielle ? »", "Proposer trois cas fictifs et laisser l'apprenant justifier son choix."],
            ["La consigne reste vague.", "« Quel résultat exact doit recevoir quelle personne ? »", "Faire compléter une fiche à trous ou répondre oralement aux sept repères."],
            ["La première réponse est acceptée immédiatement.", "« Quel critère vous permet de dire qu'elle est prête ? »", "Limiter la comparaison à deux critères visibles, puis élargir."],
            ["La source n'est pas vérifiée.", "« Pouvez-vous l'ouvrir et retrouver l'information exacte ? »", "Fournir deux sources préparées, dont une non pertinente, pour entraîner le choix."],
            ["L'apprenant craint de se tromper.", "« Quelle petite action réversible pouvez-vous tester ? »", "Travailler en binôme, laisser un temps supplémentaire ou accepter une explication orale."],
            ["Difficulté de lecture ou de navigation.", "« Quel format vous aide le plus à suivre ? »", "Zoom, contraste, support imprimé, lecture structurée, clavier ou rythme ralenti selon le besoin convenu."],
        ],
        [45 * mm, 61 * mm, 65 * mm],
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Règles d'accompagnement", "h2"))
    story.extend(bullets([
        "Fractionner la tâche, mais conserver le même résultat observable et les mêmes critères de réussite.",
        "Demander à l'apprenant d'expliquer son choix ; ne pas confondre vitesse de saisie et compréhension.",
        "Permettre l'erreur dans un exemple fictif, puis faire corriger la démarche.",
        "Tracer une adaptation de façon factuelle, limitée et respectueuse ; éviter toute information médicale inutile.",
    ]))
    story.append(callout("Alerte", "Si une difficulté rend l'objectif inaccessible malgré les adaptations raisonnables disponibles, ne promettez pas une solution improvisée. Expliquez la limite, convenez de la suite et tracez la décision avec la personne concernée.", "amber"))
    next_page(story)

    # 19 - Correction
    page(story, "Évaluation", "Corriger les exercices et le cas pratique final", "La correction doit être observable, compréhensible et reliée à la version réellement remise.")
    story.append(content_table(
        ["Objet", "À vérifier", "Retour formateur utile"],
        [
            ["Exercices 1 à 5", "Consigne suivie, justification, contrôle et capacité de transfert propres au module.", "Un point réussi, une amélioration précise et le statut validé ou à reprendre."],
            ["Cas final - cadrage", "Cas réaliste, informations autorisées, objectif et critères identifiables.", "Nommer ce qui rend le cas sûr et ce qui doit encore être limité."],
            ["Cas final - production", "Consigne structurée, itérations justifiées, livrable fidèle aux faits.", "Citer une amélioration visible entre brouillon et version finale."],
            ["Cas final - vérification", "Sources ouvertes, données minimisées, droits et biais examinés, décision motivée.", "Identifier la preuve manquante ou la correction effectuée."],
            ["Cas final - action", "Test de 30 jours mesurable, réversible et assorti de garde-fous.", "Confirmer la faisabilité ou demander une réduction du périmètre."],
        ],
        [43 * mm, 65 * mm, 63 * mm],
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Règle de décision", "h2"))
    story.extend(bullets([
        "Le cas final est validé lorsque les quatre critères atteignent au minimum « Acquis ».",
        "« Maîtrisé » valorise l'autonomie et la profondeur ; ce niveau n'est pas obligatoire pour valider.",
        "Si un critère reste « Non acquis » ou « En cours d'acquisition », demander une reprise ciblée et indiquer la preuve attendue.",
        "Enregistrer l'appréciation et les axes de progrès dans l'administration ; ne pas modifier une ancienne évaluation.",
    ]))
    story.append(callout("Exemple de retour", "« La consigne et le livrable sont cohérents. La vérification reste à compléter : ouvrez la source de la date annoncée, indiquez où l'information apparaît et remettez une version corrigée. »", "green"))
    story.append(p("Avant de valider", "h2"))
    story.append(checklist([
        "Je corrige la dernière remise et j'identifie sa version.",
        "Les quatre niveaux correspondent aux observations, pas à une impression générale.",
        "L'appréciation et les axes de progrès sont présents.",
        "La décision calculée correspond aux quatre niveaux.",
    ]))
    next_page(story)

    # 20 - Preuves et incidents
    page(story, "Suivi", "Preuves à conserver et conduite après chaque séance", "Conserver ce qui démontre la mise en oeuvre réelle, sans constituer un dossier excessif sur l'apprenant.")
    story.append(trainer_table(
        ["Après chaque séance", "À conserver", "À éviter"],
        [
            ["Présence", "Séance, date, horaires réellement suivis et validations prévues par l'émargement.", "Une simple capture d'écran non expliquée ou un faux temps reconstitué."],
            ["Progression", "Dernière version utile de l'exercice, statut, retour formateur et éventuelle reprise.", "Multiplier les copies locales contenant des données personnelles."],
            ["Adaptation", "Besoin constaté, solution convenue et effet pédagogique, uniquement si nécessaire.", "Diagnostic, détail médical ou appréciation personnelle inutile."],
            ["Incident", "Faits, impact, mesure prise et suite, avec un vocabulaire neutre.", "Mot de passe, secret, contenu confidentiel ou jugement sur la personne."],
            ["Fin de parcours", "Remise finale, grille d'évaluation, appréciation, axes de progrès, satisfaction séparée et attestations lorsqu'elles sont délivrables.", "Confondre satisfaction, présence et acquisition des compétences."],
        ],
        [36 * mm, 78 * mm, 57 * mm],
        7.4,
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Conduite en cas d'aléa", "h2"))
    story.extend(bullets([
        "Panne en classe virtuelle : passer aux réponses préparées ou au cahier, noter l'impact et reprogrammer uniquement le temps pédagogique réellement perdu.",
        "Retard ou absence : tracer la durée réelle, préciser les éléments manqués et convenir d'une solution sans valider automatiquement la présence.",
        "Exercice incomplet : conserver le brouillon, formuler la reprise et son échéance ; ne pas fabriquer la production à la place de l'apprenant.",
        "Donnée confidentielle exposée : arrêter le partage, limiter la diffusion, suivre la procédure de l'organisme et ne pas recopier la donnée dans le compte rendu.",
    ]))
    story.append(callout("Repère Qualiopi", "Les éléments proposés ici sont des exemples de preuves FormaPrompt, à adapter à la prestation et à son contexte. Ils ne constituent pas une liste exhaustive ni une garantie d'audit ; la preuve doit montrer la mise en oeuvre réelle et rester proportionnée.", "amber"))
    story.append(p("Clôture formateur", "h2"))
    story.append(checklist([
        "Présences et durées réelles vérifiées.",
        "Exercices et reprises suivis.",
        "Cas final évalué sur les quatre critères.",
        "Satisfaction et évaluation des acquis distinguées.",
        "Dossier d'attestation contrôlé seulement à partir de preuves complètes.",
    ]))

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
        title="Guide formateur - Formation IA générative",
        author="FormaPrompt - Thierry FREZARD",
        subject="Déroulés pédagogiques et suivi de la formation IA générative",
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
