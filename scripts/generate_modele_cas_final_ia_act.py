from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Image, PageBreak, Paragraph, Spacer, Table, TableStyle

from generate_guide_ia_generative import (
    BORDER,
    CROPPED_LOGO,
    GREEN,
    MUTED,
    NAVY,
    PAGE_HEIGHT,
    PAGE_WIDTH,
    ROOT,
    WHITE,
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
from generate_cahier_activites_ia_act import ActivityDocTemplate, lines_box


OUTPUT = ROOT / "output" / "pdf" / "modele-cas-final-ia-act-formaprompt.pdf"
PUBLIC_COPY = ROOT / "webapp" / "public" / "assets" / "modele-cas-final-ia-act-formaprompt.pdf"

deliverable_title_style = ParagraphStyle(
    "AiActFinalDeliverableTitle",
    parent=styles["h1"],
    fontName="Helvetica-Bold",
)


def final_cover(canvas, doc):
    canvas.saveState()
    canvas.setTitle("Modèle du cas pratique final - IA Act")
    canvas.setAuthor("FormaPrompt - Thierry FREZARD")
    canvas.setSubject("Support de préparation et grille d'évaluation du cas pratique final IA Act")
    canvas.setKeywords("IA Act, AI Act, cas pratique, feuille de route, évaluation, FormaPrompt")
    canvas.setFillColor(GREEN)
    canvas.rect(0, PAGE_HEIGHT - 19 * mm, PAGE_WIDTH, 19 * mm, fill=1, stroke=0)
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_WIDTH, 24 * mm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Arial", 8.5)
    canvas.drawCentredString(PAGE_WIDTH / 2, 10 * mm, "FormaPrompt - Formation IA & Bureautique")
    canvas.restoreState()


def rubric_block(criterion, levels):
    rows = [[label, description, "☐"] for label, description in levels]
    return [
        p(criterion, "h2"),
        content_table(["Niveau", "Description observable", "Choix"], rows, [38 * mm, 116 * mm, 17 * mm]),
        Spacer(1, 3 * mm),
    ]


def compact_appreciation(title):
    body = Paragraph(
        f"<b><font color='{GREEN.hexval()}'>{title}</font></b><br/>"
        f"<font color='{MUTED.hexval()}'>Preuve observée et amélioration éventuelle.</font><br/>"
        "........................................................................................................................",
        styles["callout"],
    )
    table = Table([[body]], colWidths=[171 * mm], rowHeights=[22 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
            ]
        )
    )
    return table


def deliverable_title(number, title, intro):
    return [Paragraph(f"{number}. {title}", deliverable_title_style), p(intro, "body")]


def build_story():
    story = []

    # 1 - Couverture
    story.extend(
        [
            Spacer(1, 23 * mm),
            Image(str(CROPPED_LOGO), width=66 * mm, height=45 * mm, kind="proportional"),
            Spacer(1, 8 * mm),
            p("MODÈLE IMPRIMABLE", "cover_eyebrow"),
            p("Cas pratique final<br/>IA Act", "cover_title"),
            p("Analyser un usage d'IA et présenter une feuille de route proportionnée", "cover_subtitle"),
            callout(
                "Objectif du document",
                "Vous aider à réunir les quatre livrables attendus, expliquer vos choix et préparer la remise finale. Ce modèle structure une démarche pédagogique ; il ne constitue ni une analyse juridique, ni une déclaration de conformité.",
            ),
            Spacer(1, 4 * mm),
            worksheet(
                [
                    ("Participant", "Nom et prénom"),
                    ("Session", "Date ou période de la formation"),
                    ("Modalité", "☐ Présentiel    ☐ Classe virtuelle"),
                    ("Formateur", "Nom du formateur"),
                ],
                label_width=38 * mm,
            ),
        ]
    )
    story.append(PageBreak())

    # 2 - Mode d'emploi
    story.extend(
        page_title(
            "Mode d'emploi",
            "Préparer les quatre livrables en 45 minutes",
            "Utilisez un cas fictif, réaliste ou décrit uniquement avec des informations génériques. Lorsque le dossier est prêt, reportez les éléments utiles dans les quatre champs du cas pratique final de l'espace apprenant.",
        )
    )
    story.append(
        content_table(
            ["Livrable", "Ce qui est attendu", "Où le préparer"],
            [
                ["1. Cartographie", "L'usage, les acteurs, les personnes, les données et la supervision.", "Pages 3 à 5"],
                ["2. Premier tri", "Les faits, inconnues, vigilances, questions et validations nécessaires.", "Page 6"],
                ["3. Acculturation", "Les groupes, compétences, activités, contrôles, preuves et mises à jour.", "Page 7"],
                ["4. Feuille de route", "Les actions à 30, 60 et 90 jours, les responsables et les revues.", "Page 8"],
            ],
            [39 * mm, 93 * mm, 39 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.extend(
        numbered(
            [
                "Choisissez un seul usage assez précis pour être décrit et contrôlé.",
                "Séparez les faits vérifiés, les informations inconnues et les signaux de vigilance.",
                "Nommez les fonctions compétentes sans inventer de validation ni de qualification juridique.",
                "Limitez la feuille de route à huit actions réellement pilotables.",
                "Autoévaluez le dossier, puis déclarez la remise terminée dans l'espace apprenant lorsqu'elle est prête.",
            ]
        )
    )
    story.append(
        callout(
            "Données et confidentialité",
            "N'inscrivez aucun nom de client, salarié ou candidat, aucune adresse, donnée de santé, pièce de dossier, donnée sensible, information interne non autorisée, identifiant ou mot de passe. Travaillez avec des fonctions génériques et des informations fictives ou anonymisées.",
            "red",
        )
    )
    story.append(callout("Validation", "Les quatre critères doivent atteindre au minimum le niveau <b>Acquis</b>. Si un critère reste insuffisant, le formateur indique les éléments à reprendre.", "green"))
    story.append(PageBreak())

    # 3 - Cadrage
    story.extend(
        page_title(
            "Étape 1 sur 6",
            "Cadrer un usage précis et vérifiable",
            "Décrivez ce qui se passe réellement ou dans votre scénario fictif. Le nom d'un outil ne suffit pas pour caractériser un usage.",
        )
    )
    story.append(
        worksheet(
            [
                ("Organisation", "Secteur, taille ou type de structure, en termes génériques"),
                ("Usage", "Tâche réalisée, résultat produit et action menée ensuite"),
                ("Finalité", "Besoin professionnel précis auquel répond l'usage"),
                ("Outil ou système", "Nom vérifié ou mention « inconnu »"),
                ("Fournisseur", "Entité vérifiée ou mention « inconnu »"),
                ("Rôle possible", "Position de l'organisation à faire confirmer"),
                ("Utilisateurs", "Fonctions qui utilisent ou supervisent le système"),
                ("Personnes concernées", "Public affecté par le résultat, sans identité"),
                ("Données", "Catégories uniquement, sans donnée personnelle réelle"),
                ("Supervision", "Fonction qui vérifie, décide, corrige ou interrompt"),
            ],
            label_width=46 * mm,
        )
    )
    story.append(PageBreak())

    # 4 - Vérification du cadrage
    story.extend(
        page_title(
            "Contrôle préalable",
            "Vérifier le cadrage avant l'analyse",
            "Contrôlez que le cas est assez précis pour être analysé, sans conclusion anticipée ni donnée confidentielle.",
        )
    )
    story.append(p("Test de pertinence", "h2"))
    story.append(
        content_table(
            ["Question", "Oui", "À revoir"],
            [
                ["L'usage peut-il être expliqué en deux phrases ?", "☐", "☐"],
                ["Les personnes et les effets possibles sont-ils identifiables ?", "☐", "☐"],
                ["Une validation humaine et une règle d'arrêt sont-elles possibles ?", "☐", "☐"],
                ["Le cas exclut-il les données et informations confidentielles ?", "☐", "☐"],
            ],
            [131 * mm, 20 * mm, 20 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(lines_box("Hypothèses à ne pas présenter comme des faits", "Rôle de l'organisation, niveau de risque, obligation ou effet qui reste à vérifier.", 45 * mm, 4))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Questions à transmettre", "Informations manquantes, source à consulter et fonction compétente.", 45 * mm, 4))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Décision de cadrage", "Poursuivez si l'usage, les acteurs, les données et le contrôle humain peuvent être décrits. Sinon, réduisez le périmètre ou demandez les informations nécessaires.", "amber"))
    story.append(PageBreak())

    # 5 - Livrable 1
    story.extend(deliverable_title(1, "Construire la cartographie factuelle", "Reliez chaque fait à sa source ou conservez-le comme information inconnue. Ne transformez pas une hypothèse en conclusion."))
    story.append(
        content_table(
            ["Élément", "Fait vérifié", "Inconnu / source à consulter", "Fonction chargée de confirmer"],
            [
                ["Finalité et résultat", "", "", ""],
                ["Fournisseur et rôle", "", "", ""],
                ["Utilisateurs et personnes", "", "", ""],
                ["Données et effets", "", "", ""],
                ["Supervision et arrêt", "", "", ""],
            ],
            [38 * mm, 43 * mm, 53 * mm, 37 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(lines_box("Synthèse de la cartographie", "Décrivez l'usage, les acteurs, les données, les effets et le contrôle humain en termes factuels.", 52 * mm, 5))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Limites et questions ouvertes", "Ce qui reste inconnu, la source à consulter et la fonction compétente.", 43 * mm, 4))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Réponse attendue", "Une cartographie précise distingue les faits, les inconnues et les validations. Elle ne promet pas la conformité et n'attribue pas un rôle juridique sans vérification.", "green"))
    story.append(PageBreak())

    # 6 - Livrable 2
    story.extend(deliverable_title(2, "Effectuer un premier tri des vigilances", "Repérez les signaux qui imposent une suspension, une information, un contrôle renforcé ou une analyse spécialisée, sans produire de qualification définitive."))
    story.append(
        content_table(
            ["Fait ou signal", "Effet possible", "Information inconnue", "Question / expertise"],
            [["", "", "", ""] for _ in range(6)],
            [43 * mm, 43 * mm, 42 * mm, 43 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(lines_box("Orientation provisoire", "Suspendre, analyser, préciser les contrôles ou expérimenter de façon limitée. Justifiez votre choix.", 48 * mm, 4))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Sources et validations à obtenir", "Titre ou fonction de la source, date de consultation et point restant à confirmer.", 43 * mm, 4))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Réponse attendue", "Le premier tri sépare les faits, les inconnues et les effets possibles. La suite proposée est prudente, argumentée et transmise aux fonctions compétentes lorsque nécessaire.", "green"))
    story.append(PageBreak())

    # 7 - Livrable 3
    story.extend(deliverable_title(3, "Construire un plan d'acculturation adapté", "Adaptez les compétences et les activités aux fonctions, aux usages et aux risques. Les preuves doivent rester proportionnées et limitées aux informations nécessaires."))
    story.append(
        content_table(
            ["Groupe", "Compétences attendues", "Activité / accompagnement", "Contrôle / preuve"],
            [
                ["Utilisateurs occasionnels", "", "", ""],
                ["Utilisateurs réguliers", "", "", ""],
                ["Responsables / superviseurs", "", "", ""],
            ],
            [39 * mm, 46 * mm, 47 * mm, 39 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(
        worksheet(
            [
                ("Règles d'arrêt", "Situations imposant une suspension ou une transmission"),
                ("Protections", "Données, accès, sources, droits et supervision humaine"),
                ("Responsable", "Fonction chargée de coordonner le plan"),
                ("Échéances", "Première action et prochaine revue"),
                ("Mises à jour", "Changement d'outil, d'usage, d'incident ou de règle"),
            ],
            label_width=43 * mm,
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Première action sous 30 jours", "Groupe, objectif, activité, responsable, échéance et preuve minimale.", 40 * mm, 3))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Réponse attendue", "Chaque groupe est relié à ses usages, compétences, contrôles et règles d'arrêt. Les preuves, responsables et déclencheurs de mise à jour sont clairement définis.", "green"))
    story.append(PageBreak())

    # 8 - Livrable 4
    story.extend(deliverable_title(4, "Feuille de route 30-60-90 jours", "Limitez le plan à huit actions pilotables. Attribuez chaque action à une fonction et distinguez le pilotage des validations spécialisées."))
    story.append(
        content_table(
            ["Horizon", "Priorité / justification", "Pilote / validations", "Livrable / preuve / échéance"],
            [
                ["30 jours", "", "", ""],
                ["30 jours", "", "", ""],
                ["60 jours", "", "", ""],
                ["60 jours", "", "", ""],
                ["90 jours", "", "", ""],
                ["Suivi continu", "", "", ""],
            ],
            [28 * mm, 51 * mm, 45 * mm, 47 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(lines_box("Les trois actions à lancer en premier", "Ordre, justification et décision à faire valider.", 43 * mm, 4))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Revue de 30 minutes", "Ordre du jour, sources à actualiser et cinq questions de suivi.", 40 * mm, 3))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Réponse attendue", "Les actions sont limitées, justifiées, attribuées et reliées à des livrables, des échéances, des preuves, des sources datées et des points de revue.", "green"))
    story.append(PageBreak())

    # 9 - Sources, limites et présentation
    story.extend(
        page_title(
            "Étape 6 sur 6",
            "Présenter les sources, les limites et les validations",
            "Une source datée ne supprime pas l'incertitude. Expliquez ce qu'elle permet d'établir, ce qu'elle ne permet pas de conclure et qui doit confirmer la suite.",
        )
    )
    story.append(
        content_table(
            ["Source", "Date", "Point vérifié", "Limite / mise à jour"],
            [["", "", "", ""] for _ in range(4)],
            [58 * mm, 27 * mm, 48 * mm, 38 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(lines_box("Ce que mon travail permet d'établir", "Faits, constats et actions proportionnées.", 40 * mm, 3))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Ce que mon travail ne permet pas de conclure", "Qualifications, validations ou décisions qui restent hors de votre périmètre.", 40 * mm, 3))
    story.append(Spacer(1, 4 * mm))
    story.append(
        worksheet(
            [
                ("Validations spécialisées", "Fonctions juridique, données, sécurité, RH, métier ou autre"),
                ("Condition d'arrêt", "Événement imposant une suspension ou une nouvelle analyse"),
                ("Prochaine actualisation", "Date ou événement déclencheur"),
            ],
            label_width=50 * mm,
        )
    )
    story.append(PageBreak())

    # 10 - Autoévaluation et remise
    story.extend(
        page_title(
            "Avant la remise",
            "M'autoévaluer et vérifier le dossier",
            "Appuyez chaque appréciation sur un élément précis du travail. Une case cochée sans preuve ne suffit pas.",
        )
    )
    story.append(
        content_table(
            ["Critère", "Preuve dans mon dossier", "Mon niveau"],
            [
                ["Cartographie de l'usage et des acteurs", "", "☐ Non acquis\n☐ En cours\n☐ Acquis\n☐ Maîtrisé"],
                ["Premier tri et orientation", "", "☐ Non acquis\n☐ En cours\n☐ Acquis\n☐ Maîtrisé"],
                ["Acculturation, contrôles et protection", "", "☐ Non acquis\n☐ En cours\n☐ Acquis\n☐ Maîtrisé"],
                ["Feuille de route, responsabilités et limites", "", "☐ Non acquis\n☐ En cours\n☐ Acquis\n☐ Maîtrisé"],
            ],
            [57 * mm, 72 * mm, 42 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Checklist de remise", "h2"))
    story.extend(
        bullets(
            [
                "☐ Les quatre livrables sont cohérents et portent sur le même usage.",
                "☐ Les faits, inconnues, signaux et validations sont distingués.",
                "☐ Les sources officielles sont nommées et datées.",
                "☐ Les responsabilités, échéances, preuves et points de revue sont visibles.",
                "☐ Aucune donnée personnelle ou information confidentielle inutile n'est présente.",
                "☐ Les quatre synthèses ont été reportées dans l'espace apprenant.",
                "☐ La remise est déclarée terminée uniquement lorsque le dossier est prêt.",
            ]
        )
    )
    story.append(lines_box("Ma dernière vérification", "Le point contrôlé juste avant de déclarer la remise terminée.", 34 * mm, 2))
    story.append(callout("Historique officiel", "Ce modèle peut être conservé ou imprimé. La remise, ses versions et la correction officielle restent enregistrées dans l'espace apprenant."))
    story.append(PageBreak())

    # 11 - Rubrique formateur 1 et 2
    story.extend(page_title("Réservé au formateur", "Grille d'évaluation - critères 1 et 2", "Cochez un niveau par critère et reliez l'évaluation aux éléments réellement remis dans l'espace apprenant."))
    story.extend(
        rubric_block(
            "1. Cartographie de l'usage et des acteurs",
            [
                ("Non acquis", "La finalité, les acteurs, les personnes concernées, les données ou la supervision humaine ne sont pas identifiés."),
                ("En cours d'acquisition", "L'usage est compréhensible, mais plusieurs acteurs, effets, catégories de données ou contrôles restent imprécis."),
                ("Acquis", "La finalité, le résultat, les acteurs, les personnes concernées, les données et la supervision humaine sont décrits avec des faits vérifiables."),
                ("Maîtrisé", "La cartographie distingue clairement les faits et les inconnues, justifie le périmètre et prépare une analyse adaptée à une situation proche."),
            ],
        )
    )
    story.append(compact_appreciation("Appréciation du critère 1"))
    story.extend(
        rubric_block(
            "2. Premier tri et orientation",
            [
                ("Non acquis", "Les vigilances sont ignorées ou une conclusion juridique est affirmée sans information ni validation suffisante."),
                ("En cours d'acquisition", "Quelques vigilances sont repérées, mais les faits, les inconnues, les effets ou la suite à donner restent partiellement distingués."),
                ("Acquis", "Les signaux, informations manquantes et effets possibles sont distingués ; une suite prudente et les validations nécessaires sont justifiées."),
                ("Maîtrisé", "Les priorités sont hiérarchisées, les autres règles sont repérées et l'orientation est argumentée sans dépasser les faits disponibles."),
            ],
        )
    )
    story.append(compact_appreciation("Appréciation du critère 2"))
    story.append(PageBreak())

    # 12 - Rubrique formateur 3 et 4
    story.extend(page_title("Réservé au formateur", "Grille d'évaluation - critères 3 et 4", "La validation finale exige au minimum le niveau Acquis pour chacun des quatre critères."))
    story.extend(
        rubric_block(
            "3. Acculturation, contrôles et protection",
            [
                ("Non acquis", "Les actions sont identiques pour tous, les données ne sont pas protégées ou aucun contrôle humain et aucune règle d'arrêt ne sont prévus."),
                ("En cours d'acquisition", "Des actions et contrôles existent, mais ils restent peu adaptés aux fonctions, aux usages, aux risques ou aux besoins d'actualisation."),
                ("Acquis", "Les compétences, activités, contrôles, règles d'arrêt, protections et preuves sont adaptés aux fonctions et aux usages sans collecte inutile."),
                ("Maîtrisé", "Les mesures sont proportionnées, articulées avec l'accompagnement et conçues pour évoluer selon les incidents, outils, usages et sources."),
            ],
        )
    )
    story.append(compact_appreciation("Appréciation du critère 3"))
    story.extend(
        rubric_block(
            "4. Feuille de route, responsabilités et limites",
            [
                ("Non acquis", "Le plan ne permet pas d'identifier les priorités, les responsables, les livrables ou les validations nécessaires."),
                ("En cours d'acquisition", "Le plan contient des actions, mais leur ordre, justification, échéance, preuve ou responsable reste incomplet."),
                ("Acquis", "Les actions à 30, 60 et 90 jours sont limitées, justifiées, attribuées et reliées à des livrables, échéances, preuves, sources et revues."),
                ("Maîtrisé", "La feuille de route anticipe l'arrêt et la révision, explique ses limites et permet un pilotage autonome sans promettre une conformité automatique."),
            ],
        )
    )
    story.append(compact_appreciation("Appréciation du critère 4"))
    story.append(Spacer(1, 3 * mm))
    story.append(
        content_table(
            ["Décision finale", "Choix", "Date / formateur"],
            [["Évaluation validée", "☐", ""], ["Reprise demandée", "☐", ""]],
            [66 * mm, 20 * mm, 85 * mm],
        )
    )

    return story


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_COPY.parent.mkdir(parents=True, exist_ok=True)
    prepare_logo()
    document = ActivityDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=22 * mm,
        bottomMargin=20 * mm,
        title="Modèle du cas pratique final - IA Act",
        author="FormaPrompt - Thierry FREZARD",
        subject="Support de préparation et grille d'évaluation du cas pratique final IA Act",
        creator="FormaPrompt",
        lang="fr-FR",
        pageCompression=1,
    )
    document.build(build_story(), onFirstPage=final_cover)
    PUBLIC_COPY.write_bytes(OUTPUT.read_bytes())
    print(f"PDF créé : {OUTPUT}")
    print(f"Copie web : {PUBLIC_COPY}")


if __name__ == "__main__":
    main()
