from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import Image, PageBreak, Paragraph, Spacer, Table, TableStyle

from generate_guide_ia_generative import (
    AMBER,
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
    prompt_box,
    styles,
    worksheet,
)


OUTPUT = ROOT / "output" / "pdf" / "cahier-activites-ia-generative-formaprompt.pdf"
PUBLIC_COPY = ROOT / "webapp" / "public" / "assets" / "cahier-activites-ia-generative-formaprompt.pdf"


def activity_cover(canvas, doc):
    canvas.saveState()
    canvas.setTitle("Cahier d'activités - IA générative")
    canvas.setAuthor("FormaPrompt - Thierry FREZARD")
    canvas.setSubject("Cahier des cinq exercices de la formation IA générative")
    canvas.setKeywords("IA générative, exercices, activités, formation, FormaPrompt")
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
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, PAGE_HEIGHT - 12 * mm, "Cahier d'activités - IA générative")
    canvas.setStrokeColor(BORDER)
    canvas.line(20 * mm, 15 * mm, PAGE_WIDTH - 20 * mm, 15 * mm)
    canvas.setFont("Arial", 8)
    canvas.drawString(20 * mm, 10 * mm, "Version juillet 2026")
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def lines_box(title, hint="", height=43 * mm):
    body = f"<b><font color='{GREEN.hexval()}'>{title}</font></b>"
    if hint:
        body += f"<br/><font color='{MUTED.hexval()}'>{hint}</font>"
    body += "<br/><br/>" + "<br/>".join(["........................................................................................................................"] * 4)
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


def check_table(criteria):
    rows = [["☐", criterion, "À revoir / Acquis"] for criterion in criteria]
    return content_table(["", "Je vérifie", "Mon avis"], rows, [12 * mm, 118 * mm, 41 * mm])


def feedback_block():
    return [
        p("Retour du formateur", "h2"),
        worksheet(
            [
                ("Statut / date", "☐ Validé    ☐ Reprise demandée    Date : ……………………"),
                ("Point réussi", "Ce qui répond aux attentes"),
                ("À améliorer", "La correction prioritaire pour la prochaine version"),
            ],
            label_width=36 * mm,
        ),
    ]


def exercise_header(number, title, objective, instructions):
    return page_title(
        f"Exercice {number} sur 5 · {objective}",
        title,
        instructions,
    )


def build_story():
    story = []

    # 1 - Couverture
    story.extend(
        [
            Spacer(1, 24 * mm),
            Image(str(CROPPED_LOGO), width=66 * mm, height=45 * mm, kind="proportional"),
            Spacer(1, 8 * mm),
            p("CAHIER D’ACTIVITÉS", "cover_eyebrow"),
            p("IA générative :<br/>mes cinq exercices pratiques", "cover_title"),
            p("Un support pour préparer, tester, vérifier et expliquer votre démarche", "cover_subtitle"),
            callout(
                "À utiliser avec l’espace apprenant",
                "Travaillez d’abord dans ce cahier si vous avez besoin de poser vos idées. Enregistrez ensuite votre réponse dans l’exercice correspondant afin de conserver vos versions et de recevoir le retour du formateur.",
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
    story.extend(page_title("Avant de commencer", "Comment utiliser ce cahier ?", "Chaque exercice suit le même chemin : préparer, tester, analyser, s’autoévaluer, puis enregistrer une version dans l’espace apprenant."))
    story.extend(numbered([
        "<b>Préparez la situation.</b> Choisissez un exemple fictif, générique ou expressément autorisé.",
        "<b>Personnalisez le modèle.</b> Remplacez les éléments entre crochets et supprimez les rubriques inutiles.",
        "<b>Testez dans un assistant autorisé.</b> Conservez la consigne utilisée et le résultat obtenu.",
        "<b>Analysez avec les critères.</b> Ne cochez « Acquis » que si vous pouvez montrer un élément précis du travail.",
        "<b>Enregistrez dans l’espace apprenant.</b> Utilisez le brouillon tant que vous travaillez ; déclarez la réponse terminée lorsqu’elle est prête pour le formateur.",
    ]))
    story.append(callout(
        "Données personnelles et confidentialité",
        "N’inscrivez ni nom de client ou de salarié, ni adresse, dossier, donnée de santé, identifiant, mot de passe ou information interne non autorisée. Décrivez les personnes par leur fonction et remplacez les faits sensibles par des exemples fictifs.",
        "red",
    ))
    story.append(p("Ce que le formateur regarde", "h2"))
    story.extend(bullets([
        "la compréhension de la consigne et du résultat attendu ;",
        "la capacité à distinguer ce que l’IA prépare de ce qui reste humain ;",
        "la qualité de la comparaison et des corrections ;",
        "la vérification des faits, des données, des droits et des risques ;",
        "la capacité à expliquer ses choix et à transférer la méthode à son activité.",
    ]))
    story.append(callout("Ce cahier n’efface rien", "Il ne remplace pas l’historique enregistré dans l’espace apprenant. Conservez-le comme support personnel et recopiez les éléments utiles dans votre réponse en ligne."))
    story.append(PageBreak())

    # 3 - Suivi
    story.extend(page_title("Tableau de bord personnel", "Suivre l’avancement des cinq exercices", "Complétez une ligne après chaque séance. Le statut officiel et la correction restent ceux affichés dans l’espace apprenant."))
    story.append(
        content_table(
            ["Exercice", "Préparé", "Testé", "Enregistré", "Retour formateur"],
            [
                ["1. Cartographier les usages", "☐", "☐", "☐ Brouillon  ☐ Terminé", "☐ Validé  ☐ Reprise"],
                ["2. Structurer une consigne", "☐", "☐", "☐ Brouillon  ☐ Terminé", "☐ Validé  ☐ Reprise"],
                ["3. Comparer deux propositions", "☐", "☐", "☐ Brouillon  ☐ Terminé", "☐ Validé  ☐ Reprise"],
                ["4. Auditer une réponse", "☐", "☐", "☐ Brouillon  ☐ Terminé", "☐ Validé  ☐ Reprise"],
                ["5. Préparer un plan responsable", "☐", "☐", "☐ Brouillon  ☐ Terminé", "☐ Validé  ☐ Reprise"],
            ],
            [52 * mm, 20 * mm, 20 * mm, 42 * mm, 37 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Mes objectifs au début de la formation", "h2"))
    story.append(lines_box("Ce que je souhaite savoir faire", "Notez deux ou trois compétences concrètes.", 48 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Ma principale vigilance", "Donnée, source, droit, biais, règle interne ou décision humaine.", 42 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Ma question de départ", "Une question à reprendre pendant la première séance.", 37 * mm))
    story.append(PageBreak())

    # 4 - Exercice 1 préparation
    story.extend(exercise_header(1, "Cartographier les usages utiles", "Module 1 · Choix des usages", "Décrivez uniquement des tâches génériques, sans nom de personne ni information confidentielle. Le résultat sert de support de réflexion et doit être validé selon votre contexte."))
    story.append(p("Les quatre étapes", "h2"))
    story.extend(numbered([
        "Notez cinq tâches courantes avec des termes assez précis pour comprendre le résultat attendu.",
        "Remplacez [métier ou secteur] dans le modèle, puis testez-le dans un assistant autorisé.",
        "Corrigez les tâches mal comprises et toute information ajoutée à tort.",
        "Choisissez une tâche adaptée, une tâche à contrôle renforcé et une tâche à ne pas déléguer.",
    ]))
    story.append(p("Préparer mon contexte", "h2"))
    story.append(worksheet([
        ("Métier ou secteur", "Décrivez votre activité sans nommer l’entreprise si ce n’est pas utile"),
        ("Public concerné", "Fonction ou catégorie générique"),
        ("Résultats fréquents", "Courriels, plans, synthèses, supports, tableaux…"),
        ("Règles à respecter", "Outils autorisés, données interdites, validation attendue"),
    ]))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Modèle à personnaliser", "h2"))
    story.append(prompt_box(
        "Aide-moi à analyser cinq tâches courantes dans mon activité de [métier ou secteur].\n"
        "Pour chaque tâche, indique : l’objectif, ce que l’IA pourrait préparer, ce qui reste sous contrôle humain, les données à ne pas transmettre et le niveau de vigilance : courant, renforcé ou usage à éviter.\n"
        "Ne prends aucune décision à ma place et pose-moi jusqu’à trois questions si le contexte est insuffisant."
    ))
    story.append(PageBreak())

    # 5 - Exercice 1 réalisation
    story.extend(page_title("Exercice 1 · Réalisation", "Analyser cinq tâches", "Complétez le tableau à partir de votre réflexion et du résultat produit par l’assistant. Corrigez les formulations trop vagues."))
    story.append(
        content_table(
            ["Tâche et objectif", "Place possible de l’IA", "Contrôle humain", "Données interdites", "Vigilance"],
            [[f"{i}.\n\n", "\n\n", "\n\n", "\n\n", "☐ Courant\n☐ Renforcé\n☐ À éviter"] for i in range(1, 6)],
            [38 * mm, 38 * mm, 36 * mm, 34 * mm, 25 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(lines_box("Une information ajoutée ou mal comprise par l’IA", "Expliquez ce que vous avez corrigé et pourquoi.", 42 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("La première tâche que je pourrais tester", "Elle doit être simple, réversible, sans donnée sensible et facile à vérifier.", 42 * mm))
    story.append(PageBreak())

    # 6 - Exercice 1 bilan
    story.extend(page_title("Exercice 1 · Bilan", "Choisir et justifier trois niveaux de vigilance", "Ne vous contentez pas d’un classement : expliquez la conséquence possible d’une erreur et le contrôle prévu."))
    story.append(worksheet([
        ("Usage adapté", "Tâche choisie, raison et contrôle simple"),
        ("Contrôle renforcé", "Tâche choisie, risque et vérifications supplémentaires"),
        ("À ne pas déléguer", "Décision ou tâche concernée et raison"),
    ], label_width=42 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Autoévaluation", "h2"))
    story.append(check_table([
        "Mes cinq tâches permettent de comprendre le résultat attendu.",
        "Le rôle de l’IA et le contrôle humain sont distingués.",
        "Les données interdites et le niveau de vigilance sont justifiés.",
        "J’ai choisi une première tâche simple et réversible.",
    ]))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Ce que j’ai appris", "Une phrase sur le choix des usages.", 30 * mm))
    story.extend(feedback_block())
    story.append(PageBreak())

    # 7 - Exercice 2 préparation
    story.extend(exercise_header(2, "Passer d’une demande vague à une consigne structurée", "Module 2 · Formulation", "Personnalisez les éléments entre crochets puis comparez le résultat avec celui d’une demande formulée en une seule phrase."))
    story.append(p("Les quatre étapes", "h2"))
    story.extend(numbered([
        "Choisissez un livrable simple et non confidentiel.",
        "Écrivez une demande courte et vague, puis conservez la première réponse.",
        "Complétez chaque rubrique : objectif, contexte, public, informations, contraintes, format et critères.",
        "Testez la version structurée et relevez deux améliorations et un point restant à corriger.",
    ]))
    story.append(lines_box("Ma demande courte et vague", "Exemple : « Fais-moi un bon mail pour rappeler la formation. »", 38 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Préparer la version structurée", "h2"))
    story.append(worksheet([
        ("Objectif", "Le livrable attendu"),
        ("Contexte utile", "La situation, sans donnée inutile"),
        ("Public", "Fonction et niveau de connaissance"),
        ("Informations et contraintes", "Les faits ou la source autorisée, le ton, la longueur et les interdictions"),
        ("Format et critères", "La structure du résultat et trois conditions observables de réussite"),
    ], label_width=34 * mm))
    story.append(PageBreak())

    # 8 - Exercice 2 comparaison
    story.extend(page_title("Exercice 2 · Réalisation", "Comparer la demande vague et la demande structurée", "Utilisez le même sujet. La comparaison doit porter sur des différences observables, pas seulement sur votre préférence."))
    story.append(lines_box("Résultat obtenu avec la demande vague", "Collez un court extrait ou notez les caractéristiques principales.", 48 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Résultat obtenu avec la consigne structurée", "Collez un court extrait ou notez les caractéristiques principales.", 48 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(
        content_table(
            ["Critère", "Demande vague", "Consigne structurée", "Écart observé"],
            [
                ["Fidélité aux faits", "", "", ""],
                ["Adaptation au public", "", "", ""],
                ["Respect du format", "", "", ""],
                ["Critères de réussite", "", "", ""],
            ],
            [38 * mm, 42 * mm, 46 * mm, 45 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Mon prochain ajustement", "Nommez un seul écart précis et la correction ciblée à demander.", 35 * mm))
    story.append(PageBreak())

    # 9 - Exercice 2 bilan
    story.extend(page_title("Exercice 2 · Bilan", "Finaliser ma consigne", "Recopiez la version que vous souhaitez enregistrer dans l’espace apprenant, ou indiquez le nom du document où elle est conservée."))
    story.append(lines_box("Ma consigne finale", "Objectif, contexte, public, informations, contraintes, format, critères et question préalable.", 83 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Autoévaluation", "h2"))
    story.append(check_table([
        "Le livrable, le public et le contexte sont clairement identifiables.",
        "Aucune donnée personnelle ou confidentielle inutile n’est présente.",
        "Le format et trois critères observables sont précisés.",
        "J’explique deux améliorations et un point restant à corriger.",
    ]))
    story.append(Spacer(1, 4 * mm))
    story.extend(feedback_block())
    story.append(PageBreak())

    # 10 - Exercice 3 préparation
    story.extend(exercise_header(3, "Comparer et améliorer deux propositions", "Module 3 · Production", "Utilisez un sujet fictif ou non confidentiel. Vérifiez vous-même les faits avant de réutiliser le contenu produit."))
    story.append(p("Préparer le même cadre pour les deux versions", "h2"))
    story.append(worksheet([
        ("Type de contenu", "Courriel, synthèse, plan, support…"),
        ("Sujet et objectif", "Ce que le contenu doit permettre"),
        ("Public", "Fonction, niveau et action attendue"),
        ("Source autorisée", "Document ou faits identiques pour A et B"),
        ("Longueur", "Limite commune aux deux versions"),
        ("Points à confirmer", "Informations qui ne doivent pas devenir des faits"),
    ], label_width=39 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Modèle à personnaliser", "h2"))
    story.append(prompt_box(
        "Prépare deux versions de [type de contenu] sur [sujet] pour [public].\n"
        "Version A : directe et synthétique. Version B : pédagogique, avec un exemple concret.\n"
        "Pour chaque version : limite le texte à [longueur], n’invente aucun fait ni aucune source et signale les informations à confirmer.\n"
        "Termine par un tableau comparant clarté, précision, adaptation au public et risques d’interprétation."
    ))
    story.append(callout("Même base de comparaison", "Ne modifiez ni la source ni les faits entre les deux essais. Sinon, vous ne pourrez pas savoir si la différence vient du style demandé ou des informations fournies.", "amber"))
    story.append(PageBreak())

    # 11 - Exercice 3 comparaison
    story.extend(page_title("Exercice 3 · Réalisation", "Comparer les deux propositions", "Appuyez chaque appréciation sur un exemple précis : une phrase, une information, une structure ou une omission."))
    story.append(
        content_table(
            ["Critère", "Version A", "Version B", "Choix pour la version finale"],
            [
                ["Clarté", "", "", ""],
                ["Précision", "", "", ""],
                ["Adaptation au public", "", "", ""],
                ["Risque d’interprétation", "", "", ""],
                ["Fidélité à la source", "", "", ""],
            ],
            [39 * mm, 43 * mm, 43 * mm, 46 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(lines_box("Les meilleurs éléments de la version A", "Citez les formulations ou choix à conserver.", 41 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Les meilleurs éléments de la version B", "Citez les formulations ou choix à conserver.", 41 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Une information à confirmer", "Indiquez la source que vous consulterez réellement.", 34 * mm))
    story.append(PageBreak())

    # 12 - Exercice 3 bilan
    story.extend(page_title("Exercice 3 · Bilan", "Construire et vérifier la version finale", "Assemblez uniquement les éléments utiles, puis revenez à la source d’origine pour contrôler chaque fait."))
    story.append(lines_box("Ma version finale ou sa référence", "Court extrait, nom du document ou emplacement sécurisé communiqué au formateur.", 38 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(worksheet([
        ("Faits contrôlés", "Chiffres, dates, noms génériques, consignes, liens"),
        ("Éléments retirés", "Information absente de la source ou trop incertaine"),
        ("Adaptation finale", "Modification réalisée pour le public"),
    ], label_width=38 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Autoévaluation", "h2"))
    story.append(check_table([
        "Les deux propositions utilisent les mêmes faits.",
        "Les différences entre A et B sont réellement visibles.",
        "Ma comparaison utilise les quatre critères demandés.",
        "La version finale est fidèle à la source et les incertitudes sont signalées.",
    ]))
    story.extend(feedback_block())
    story.append(PageBreak())

    # 13 - Exercice 4 préparation
    story.extend(exercise_header(4, "Auditer une réponse avant utilisation", "Module 4 · Vérification", "Utilisez uniquement une réponse fictive ou un contenu autorisé. L’IA peut repérer des points de vigilance, mais la vérification finale reste humaine."))
    story.append(callout("Support associé", "Téléchargez aussi la <b>Grille de vérification d’un contenu produit avec l’IA</b> depuis l’exercice 4 ou l’onglet Supports et liens. Elle permet de conserver le détail des preuves.", "green"))
    story.append(p("Préparer le contrôle", "h2"))
    story.append(worksheet([
        ("Contenu audité", "Nature, version et usage prévu"),
        ("Public", "Personnes qui recevront ou utiliseront le contenu"),
        ("Conséquence d’une erreur", "Faible, moyenne ou forte - pourquoi ?"),
        ("Sources disponibles", "Documents ou pages que vous pourrez réellement ouvrir"),
        ("Données et droits", "Informations et contenus nécessitant une vigilance"),
    ], label_width=43 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Modèle d’aide au repérage", "h2"))
    story.append(prompt_box(
        "Analyse la réponse placée entre &lt;reponse&gt; et &lt;/reponse&gt;.\n"
        "Classe les éléments dans quatre catégories : faits à vérifier ; formulations ambiguës ou trop affirmatives ; risques concernant les données, droits ou confidentialité ; éléments utilisables après contrôle.\n"
        "N’invente aucune source. Propose ensuite une liste de vérifications humaines avant diffusion."
    ))
    story.append(PageBreak())

    # 14 - Exercice 4 audit
    story.extend(page_title("Exercice 4 · Réalisation", "Conduire l’audit", "Une source proposée par l’assistant n’est pas une preuve tant que vous ne l’avez pas ouverte et contrôlée."))
    story.append(
        content_table(
            ["Élément repéré", "Risque ou question", "Source réellement consultée", "Correction / décision"],
            [
                ["Fait, chiffre ou date", "", "", ""],
                ["Référence ou citation", "", "", ""],
                ["Formulation trop affirmative", "", "", ""],
                ["Donnée ou confidentialité", "", "", ""],
                ["Droit d’utilisation", "", "", ""],
                ["Biais ou stéréotype", "", "", ""],
            ],
            [40 * mm, 43 * mm, 47 * mm, 41 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Décision avant diffusion", "h2"))
    story.append(worksheet([
        ("Décision", "☐ Utilisable après contrôle    ☐ À corriger    ☐ À rejeter"),
        ("Justification", "La raison principale et le niveau de risque restant"),
        ("Validation humaine", "Personne ou fonction, date et périmètre de la validation"),
    ], label_width=42 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Doute non levé", "Suspendez la diffusion, retirez l’information ou demandez l’avis d’une personne compétente. Ne transformez pas une incertitude en fait.", "red"))
    story.append(PageBreak())

    # 15 - Exercice 4 bilan
    story.extend(page_title("Exercice 4 · Bilan", "Conserver les preuves du contrôle", "Reportez les éléments détaillés dans la grille de vérification et indiquez où le formateur peut consulter cette grille sans exposer de donnée interdite."))
    story.append(worksheet([
        ("Référence de la grille", "Nom du fichier, emplacement ou lien sécurisé"),
        ("Sources principales", "Titre, auteur, date et date de consultation"),
        ("Corrections réalisées", "Les trois modifications les plus importantes"),
        ("Limites restantes", "Ce qui doit encore être confirmé ou surveillé"),
    ], label_width=43 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Autoévaluation", "h2"))
    story.append(check_table([
        "J’ai repéré les faits, dates, références et affirmations fortes.",
        "Les sources importantes ont réellement été consultées.",
        "Les données, droits, biais et règles de confidentialité sont examinés.",
        "Ma décision et les validations encore nécessaires sont justifiées.",
    ]))
    story.append(Spacer(1, 4 * mm))
    story.extend(feedback_block())
    story.append(PageBreak())

    # 16 - Exercice 5 préparation
    story.extend(exercise_header(5, "Préparer un plan d’utilisation responsable", "Module 5 · Plan d’action", "Construisez un plan limité à un usage réaliste. Les règles internes et décisions sensibles doivent être validées par les personnes compétentes."))
    story.append(p("Choisir un cas maîtrisable", "h2"))
    story.append(worksheet([
        ("Tâche choisie", "Une seule tâche fréquente et précise"),
        ("Utilité attendue", "Le bénéfice concret à observer"),
        ("Réversibilité", "Comment arrêter ou revenir en arrière facilement"),
        ("Décisions exclues", "Ce qui ne sera jamais délégué à l’IA"),
        ("Données exclues", "Les informations qui ne seront pas transmises"),
    ], label_width=41 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Modèle à personnaliser", "h2"))
    story.append(prompt_box(
        "Aide-moi à préparer un plan d’utilisation responsable de l’IA pour [tâche].\n"
        "Précise : bénéfice attendu ; étapes confiées à l’IA ; informations autorisées et interdites ; vérifications humaines ; critères d’évaluation ; personnes à consulter ; première expérimentation réalisable sous 30 jours.\n"
        "Présente le résultat comme une fiche action d’une page et indique clairement les points restant à valider."
    ))
    story.append(callout("Commencer petit", "Évitez un projet portant sur toute l’organisation. Un test limité permet d’apprendre, de mesurer les difficultés et de corriger avant toute généralisation.", "amber"))
    story.append(PageBreak())

    # 17 - Exercice 5 plan
    story.extend(page_title("Exercice 5 · Réalisation", "Ma fiche action à 30 jours", "Corrigez la proposition de l’assistant avec les règles et responsabilités réelles de votre organisation."))
    story.append(worksheet([
        ("Résultat attendu", "Le livrable ou l’amélioration observable"),
        ("Rôle de l’IA", "Les étapes que l’outil peut préparer"),
        ("Rôle humain", "Les choix, contrôles et décisions qui restent humains"),
        ("Informations autorisées", "Les faits et sources utilisables"),
        ("Informations interdites", "Données personnelles, sensibles ou internes exclues"),
        ("Responsable", "La personne qui pilote et rend compte"),
        ("Validations", "Les personnes ou fonctions à consulter"),
        ("Échéance", "La date du premier test, sous 30 jours"),
        ("Indicateur 1", "Mesure de départ, cible et méthode de suivi"),
        ("Indicateur 2", "Mesure de départ, cible et méthode de suivi"),
    ], label_width=42 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Après le test", "Décidez de poursuivre, corriger ou arrêter à partir des résultats, des incidents et des retours. Une impression positive ne remplace pas des indicateurs observables."))
    story.append(PageBreak())

    # 18 - Exercice 5 bilan et synthèse
    story.extend(page_title("Exercice 5 · Bilan", "Décider de la suite et faire le point", "Le plan d’action de cet exercice pourra devenir le quatrième livrable de votre cas pratique final."))
    story.append(worksheet([
        ("Décision prévue", "☐ Poursuivre    ☐ Corriger    ☐ Arrêter"),
        ("Moment de décision", "Date et personnes réunies"),
        ("Preuves examinées", "Indicateurs, erreurs, retours et validations"),
        ("Condition de poursuite", "Le niveau minimal attendu avant d’élargir l’usage"),
    ], label_width=46 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Autoévaluation", "h2"))
    story.append(check_table([
        "Le périmètre est limité, testable et réversible.",
        "Le bénéfice, le rôle de l’IA et les contrôles humains sont distincts.",
        "Les informations interdites, validations et responsabilités sont nommées.",
        "Une date sous 30 jours et deux indicateurs permettent de décider de la suite.",
    ]))
    story.extend(feedback_block())
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Prochaine étape", "Lorsque les cinq exercices sont terminés et relus, préparez les quatre livrables du cas pratique final : consigne finale, livrable, grille de vérification et plan d’action."))

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
        title="Cahier d'activités - IA générative",
        author="FormaPrompt - Thierry FREZARD",
        subject="Cahier des cinq exercices de la formation IA générative",
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
