from reportlab.lib.pagesizes import A4
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
from generate_cahier_activites_ia_generative import lines_box


OUTPUT = ROOT / "output" / "pdf" / "modele-cas-final-plan-action-ia-generative-formaprompt.pdf"
PUBLIC_COPY = ROOT / "webapp" / "public" / "assets" / "modele-cas-final-plan-action-ia-generative-formaprompt.pdf"


def final_cover(canvas, doc):
    canvas.saveState()
    canvas.setTitle("Modèle du cas pratique final et plan d'action - IA générative")
    canvas.setAuthor("FormaPrompt - Thierry FREZARD")
    canvas.setSubject("Support de préparation et grille d'évaluation du cas pratique final")
    canvas.setKeywords("IA générative, cas pratique, plan d'action, évaluation, FormaPrompt")
    canvas.setFillColor(GREEN)
    canvas.rect(0, PAGE_HEIGHT - 19 * mm, PAGE_WIDTH, 19 * mm, fill=1, stroke=0)
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_WIDTH, 24 * mm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Arial", 8.5)
    canvas.drawCentredString(PAGE_WIDTH / 2, 10 * mm, "FormaPrompt - Formation IA & Bureautique")
    canvas.restoreState()


def final_page(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(GREEN_LINE)
    canvas.setLineWidth(0.7)
    canvas.line(20 * mm, PAGE_HEIGHT - 16 * mm, PAGE_WIDTH - 20 * mm, PAGE_HEIGHT - 16 * mm)
    canvas.setFont("Arial-Bold", 8)
    canvas.setFillColor(GREEN)
    canvas.drawString(20 * mm, PAGE_HEIGHT - 12 * mm, "FORMAPROMPT")
    canvas.setFont("Arial", 8)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, PAGE_HEIGHT - 12 * mm, "Cas pratique final - IA générative")
    canvas.setStrokeColor(BORDER)
    canvas.line(20 * mm, 15 * mm, PAGE_WIDTH - 20 * mm, 15 * mm)
    canvas.setFont("Arial", 8)
    canvas.drawString(20 * mm, 10 * mm, "Version juillet 2026")
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def rubric_block(criterion, levels):
    rows = []
    for label, description in levels:
        rows.append([label, description, "☐"])
    story = [p(criterion, "h2")]
    story.append(content_table(["Niveau", "Description observable", "Choix"], rows, [38 * mm, 116 * mm, 17 * mm]))
    story.append(Spacer(1, 3 * mm))
    return story


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


def build_story():
    story = []

    # 1 - Couverture
    story.extend(
        [
            Spacer(1, 23 * mm),
            Image(str(CROPPED_LOGO), width=66 * mm, height=45 * mm, kind="proportional"),
            Spacer(1, 8 * mm),
            p("MODÈLE IMPRIMABLE", "cover_eyebrow"),
            p("Cas pratique final<br/>et plan d’action individuel", "cover_title"),
            p("Formation : IA générative - comprendre, pratiquer et sécuriser ses usages", "cover_subtitle"),
            callout(
                "Objectif du document",
                "Vous aider à réunir les quatre livrables attendus, expliquer votre démarche et préparer une première expérimentation responsable. Le résultat n’a pas besoin d’être parfait dès le premier essai : les corrections et les contrôles font partie de l’évaluation.",
            ),
            Spacer(1, 4 * mm),
            worksheet(
                [
                    ("Participant", "Nom et prénom"),
                    ("Session", "Dates ou période de la formation"),
                    ("Modalité", "☐ Présentiel    ☐ Classe virtuelle"),
                    ("Formateur", "Nom du formateur"),
                ],
                label_width=38 * mm,
            ),
        ]
    )
    story.append(PageBreak())

    # 2 - Mode d'emploi
    story.extend(page_title("Mode d’emploi", "Préparer les quatre livrables", "Travaillez progressivement dans ce modèle. Lorsque votre dossier est prêt, recopiez les références et explications utiles dans les quatre champs du cas pratique final de l’espace apprenant."))
    story.append(
        content_table(
            ["Livrable", "Ce qui est attendu", "Où le préparer"],
            [
                ["1. Consigne finale", "La consigne et ses principales étapes d’amélioration.", "Pages 4 à 6"],
                ["2. Livrable", "Le résultat produit ou sa maquette, consultable par le formateur.", "Page 6"],
                ["3. Grille", "La grille de vérification complétée et sa décision finale.", "Page 7 + grille séparée"],
                ["4. Plan d’action", "Une expérimentation réaliste, datée et contrôlée.", "Pages 8 et 9"],
            ],
            [39 * mm, 93 * mm, 39 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.extend(numbered([
        "Choisissez une situation réelle ou réaliste de votre activité, mais sans donnée personnelle ni information confidentielle.",
        "Conservez votre première consigne, au moins deux résultats et les modifications qui ont amélioré le travail.",
        "Vérifiez les faits, sources, données, droits, biais et validations dans la grille dédiée.",
        "Préparez un plan limité à une première expérimentation sous 30 jours.",
        "Autoévaluez-vous, puis déclarez la remise terminée dans l’espace apprenant lorsque les quatre livrables sont accessibles.",
    ]))
    story.append(callout(
        "Protection des données",
        "N’inscrivez aucune identité, adresse, donnée de santé, dossier de client ou de salarié, identifiant, mot de passe ou information interne non autorisée. Utilisez des fonctions génériques, des exemples fictifs et des liens dont le partage est volontairement limité au formateur.",
        "red",
    ))
    story.append(callout("Validation", "Les quatre critères doivent atteindre au minimum le niveau <b>Acquis</b>. Le niveau <b>Maîtrisé</b> reconnaît une autonomie supplémentaire mais n’est pas obligatoire.", "green"))
    story.append(PageBreak())

    # 3 - Cadrage
    story.extend(page_title("Étape 1 sur 5", "Cadrer un cas limité, utile et vérifiable", "Un bon cas final permet de montrer la méthode. Il doit être assez précis pour être testé et assez peu risqué pour être corrigé sans conséquence importante."))
    story.append(worksheet([
        ("Besoin professionnel", "Le problème ou la tâche à améliorer"),
        ("Public", "La fonction et le niveau de la personne qui utilisera le résultat"),
        ("Livrable attendu", "Le résultat observable à produire"),
        ("Utilité", "Ce que le résultat doit faciliter ou améliorer"),
        ("Périmètre", "Ce qui est inclus et ce qui reste hors du cas"),
        ("Informations autorisées", "Les faits ou sources réellement utilisables"),
        ("Informations interdites", "Les données personnelles, sensibles ou internes exclues"),
        ("Décisions humaines", "Ce qui ne doit jamais être délégué à l’IA"),
    ], label_width=46 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Test de pertinence", "h2"))
    story.append(
        content_table(
            ["Question", "Oui", "À revoir"],
            [
                ["Le cas peut-il être expliqué en deux phrases ?", "☐", "☐"],
                ["Le résultat peut-il être comparé à des critères observables ?", "☐", "☐"],
                ["Une erreur peut-elle être repérée et corrigée avant diffusion ?", "☐", "☐"],
                ["Le cas exclut-il les données et décisions sensibles ?", "☐", "☐"],
            ],
            [131 * mm, 20 * mm, 20 * mm],
        )
    )
    story.append(PageBreak())

    # 4 - Première consigne
    story.extend(page_title("Étape 2 sur 5", "Préparer la première consigne et les critères", "Commencez par une version imparfaite mais explicite. Vous pourrez ensuite expliquer ce que vous avez modifié et pourquoi."))
    story.append(worksheet([
        ("Objectif", "Le livrable concret attendu"),
        ("Contexte et public", "La situation, sans donnée inutile, et la personne destinataire"),
        ("Informations et contraintes", "Les faits autorisés, le ton, la longueur et les éléments à éviter"),
        ("Format", "La structure précise du résultat"),
        ("Contrôle", "Ce que l’IA ne doit pas inventer et les questions à poser"),
    ], label_width=38 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Mes critères de réussite", "h2"))
    story.append(
        content_table(
            ["Critère observable", "Comment le contrôler ?", "Seuil attendu"],
            [["1.", "", ""], ["2.", "", ""], ["3.", "", ""]],
            [58 * mm, 72 * mm, 41 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Ma première consigne", "Conservez cette version, même si elle doit être corrigée.", 45 * mm))
    story.append(PageBreak())

    # 5 - Itérations
    story.extend(page_title("Étape 3 sur 5", "Tester, comparer et améliorer", "Conservez au moins deux résultats. Pour chaque modification, nommez l’écart observé puis la correction ciblée."))
    story.append(
        content_table(
            ["Version", "Écart observé", "Correction demandée", "Effet obtenu"],
            [
                ["Résultat 1", "", "", ""],
                ["Résultat 2", "", "", ""],
                ["Résultat 3, si utile", "", "", ""],
            ],
            [32 * mm, 49 * mm, 52 * mm, 38 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(lines_box("Ce que j’ai conservé", "Citez une formulation, une structure ou une idée réellement utile.", 42 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Ce que j’ai corrigé ou retiré", "Fait absent de la source, ton inadapté, format non respecté, ambiguïté…", 42 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Ce que je n’ai pas délégué à l’IA", "Choix métier, validation, décision concernant une personne ou obligation particulière.", 42 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Une amélioration doit être démontrable", "Évitez « la seconde réponse est meilleure ». Indiquez le critère concerné, l’extrait comparé et la correction qui a produit la différence.", "green"))
    story.append(PageBreak())

    # 6 - Livrables 1 et 2
    story.extend(page_title("Livrables 1 et 2", "Présenter la consigne finale et le livrable", "Ces informations correspondent aux deux premiers champs de remise dans l’espace apprenant."))
    story.append(lines_box("Consigne finale", "Recopiez-la ou indiquez le nom du document et son emplacement sécurisé.", 67 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(worksheet([
        ("Amélioration 1", "Écart initial, correction et résultat obtenu"),
        ("Amélioration 2", "Écart initial, correction et résultat obtenu"),
        ("Critères atteints", "Les éléments précis qui montrent la réussite"),
    ], label_width=42 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Livrable final ou maquette", "Décrivez le résultat et indiquez où le formateur peut le consulter. N’utilisez qu’un lien volontairement partagé et vérifiez ses droits d’accès.", 53 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Avant la remise", "Ouvrez vous-même le document ou le lien depuis un accès équivalent à celui du formateur. Un livrable inaccessible ne peut pas être évalué.", "amber"))
    story.append(PageBreak())

    # 7 - Grille
    story.extend(page_title("Livrable 3", "Résumer la grille de vérification", "Complétez la grille séparée de cinq pages, puis reportez ici sa référence, sa décision et les contrôles principaux."))
    story.append(worksheet([
        ("Référence de la grille", "Nom du fichier, emplacement ou lien sécurisé"),
        ("Faits et sources", "Principales informations contrôlées et sources ouvertes"),
        ("Données", "Données autorisées, minimisation et informations exclues"),
        ("Droits", "Origine et conditions de réutilisation des contenus"),
        ("Biais", "Stéréotypes, déséquilibres ou personnes potentiellement affectées"),
        ("Validation humaine", "Personne ou fonction, date et périmètre du contrôle"),
        ("Limites restantes", "Incertitudes, risques ou validations encore nécessaires"),
    ], label_width=47 * mm))
    story.append(Spacer(1, 5 * mm))
    story.append(p("Décision finale de la grille", "h2"))
    story.append(
        content_table(
            ["Décision", "Choix", "Justification"],
            [
                ["Utilisable après contrôle", "☐", ""],
                ["À corriger avant utilisation", "☐", ""],
                ["À rejeter", "☐", ""],
            ],
            [58 * mm, 20 * mm, 93 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Doute non levé", "Suspendez la diffusion, retirez l’information concernée ou obtenez l’avis d’une personne compétente. La grille doit conserver cette décision.", "red"))
    story.append(PageBreak())

    # 8 - Plan d'action
    story.extend(page_title("Livrable 4", "Construire le plan d’action individuel", "Préparez une première expérimentation limitée, réversible et réalisable sous 30 jours."))
    story.append(worksheet([
        ("Usage testé", "Une seule tâche précise"),
        ("Bénéfice attendu", "Temps, clarté, qualité ou accessibilité à observer"),
        ("Résultat attendu", "Le livrable ou changement concret"),
        ("Rôle de l’IA", "Ce que l’outil peut préparer sans décider"),
        ("Rôle humain", "Contrôles, choix et décisions"),
        ("Informations autorisées", "Faits et sources utilisables"),
        ("Informations interdites", "Données et contenus exclus"),
        ("Responsable", "La personne qui pilote et rend compte"),
        ("Validations", "Personnes ou fonctions à consulter"),
        ("Date du premier test", "Une date réaliste sous 30 jours"),
    ], label_width=46 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Périmètre raisonnable", "Un test sur trois modèles génériques de courriels est mesurable. « Déployer l’IA dans toute l’entreprise » ne constitue pas une première expérimentation maîtrisable.", "amber"))
    story.append(PageBreak())

    # 9 - Indicateurs
    story.extend(page_title("Plan d’action", "Mesurer et décider de la suite", "Définissez les indicateurs avant le test. Notez la situation de départ, la cible et la manière de recueillir l’information."))
    story.append(
        content_table(
            ["Indicateur", "Situation de départ", "Cible", "Méthode de mesure"],
            [
                ["1.", "", "", ""],
                ["2.", "", "", ""],
                ["3. Facultatif", "", "", ""],
            ],
            [38 * mm, 45 * mm, 38 * mm, 50 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(worksheet([
        ("Durée du test", "Dates de début et de fin"),
        ("Personnes consultées", "Fonctions concernées, sans données inutiles"),
        ("Incidents à relever", "Erreurs, données, droits, mauvaise interprétation ou difficulté d’usage"),
        ("Moment de décision", "Date et personne responsable"),
    ], label_width=47 * mm))
    story.append(Spacer(1, 5 * mm))
    story.append(p("Règle de décision", "h2"))
    story.append(
        content_table(
            ["Décision", "Dans quelles conditions ?", "Action suivante"],
            [
                ["Poursuivre", "", ""],
                ["Corriger", "", ""],
                ["Arrêter", "", ""],
            ],
            [38 * mm, 82 * mm, 51 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Première action datée", "Qui fait quoi, pour quelle date et avec quelle validation ?", 35 * mm))
    story.append(PageBreak())

    # 10 - Autoévaluation
    story.extend(page_title("Avant la remise", "M’autoévaluer et vérifier le dossier", "Appuyez chaque réponse sur une preuve présente dans votre travail. Une case cochée sans exemple ne suffit pas."))
    story.append(
        content_table(
            ["Critère", "Preuve dans mon dossier", "Mon niveau"],
            [
                ["Adéquation au besoin et au public", "", "☐ Non acquis\n☐ En cours\n☐ Acquis\n☐ Maîtrisé"],
                ["Consigne et critères de réussite", "", "☐ Non acquis\n☐ En cours\n☐ Acquis\n☐ Maîtrisé"],
                ["Contrôles et maîtrise des risques", "", "☐ Non acquis\n☐ En cours\n☐ Acquis\n☐ Maîtrisé"],
                ["Explication des choix et limites", "", "☐ Non acquis\n☐ En cours\n☐ Acquis\n☐ Maîtrisé"],
            ],
            [57 * mm, 72 * mm, 42 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Checklist de remise", "h2"))
    story.extend(bullets([
        "☐ La consigne finale et au moins deux améliorations sont expliquées.",
        "☐ Le livrable ou sa maquette est accessible au formateur.",
        "☐ La grille de vérification est complétée et sa décision est justifiée.",
        "☐ Le plan d’action nomme une échéance, un responsable, des validations et deux indicateurs.",
        "☐ Aucun champ ni document ne contient de donnée personnelle ou confidentielle inutile.",
        "☐ Les quatre références ont été reportées dans le cas final de l’espace apprenant.",
        "☐ La remise a été déclarée terminée uniquement lorsque le dossier est prêt pour l’évaluation.",
    ]))
    story.append(lines_box("Ma dernière vérification", "Le point contrôlé juste avant de déclarer la remise terminée.", 34 * mm))
    story.append(callout("Historique officiel", "Le présent modèle peut être conservé ou imprimé. La remise, ses versions et la correction officielle restent enregistrées dans l’espace apprenant."))
    story.append(PageBreak())

    # 11 - Rubrique formateur 1 et 2
    story.extend(page_title("Réservé au formateur", "Grille d’évaluation - critères 1 et 2", "Cochez un niveau par critère et appuyez l’évaluation sur les éléments déposés par l’apprenant."))
    story.extend(rubric_block("1. Adéquation au besoin et au public", [
        ("Non acquis", "Le besoin, le public ou le résultat attendu ne sont pas identifiés. Le livrable ne répond pas à la situation choisie."),
        ("En cours d’acquisition", "Le besoin principal est identifié, mais le livrable reste partiellement adapté au public, à l’objectif ou aux contraintes."),
        ("Acquis", "Le livrable répond au besoin, au public et au résultat attendu. Les contraintes utiles sont respectées."),
        ("Maîtrisé", "Le livrable anticipe les usages réels, justifie ses choix et peut être adapté de façon autonome à une situation proche."),
    ]))
    story.append(lines_box("Appréciation du critère 1", "Preuve observée et amélioration éventuelle.", 37 * mm))
    story.extend(rubric_block("2. Consigne et critères de réussite", [
        ("Non acquis", "La demande reste vague et ne précise ni le résultat attendu ni les conditions de réussite."),
        ("En cours d’acquisition", "La demande contient un objectif et quelques précisions, mais le contexte, le format ou les critères restent incomplets."),
        ("Acquis", "La consigne précise l’objectif, le contexte utile, le public, les contraintes, le format et des critères vérifiables."),
        ("Maîtrisé", "La consigne est réutilisable, les améliorations sont justifiées et les essais montrent une itération autonome."),
    ]))
    story.append(lines_box("Appréciation du critère 2", "Preuve observée et amélioration éventuelle.", 37 * mm))
    story.append(PageBreak())

    # 12 - Rubrique formateur 3 et 4
    story.extend(page_title("Réservé au formateur", "Grille d’évaluation - critères 3 et 4", "La validation finale exige au minimum le niveau Acquis pour chacun des quatre critères."))
    story.extend(rubric_block("3. Contrôles et maîtrise des risques", [
        ("Non acquis", "Le résultat est utilisé sans contrôle suffisant, ou des données non autorisées sont transmises."),
        ("En cours d’acquisition", "Des vérifications sont mentionnées, mais les sources, données, droits, biais ou validations ne sont pas tous traités."),
        ("Acquis", "Les faits, sources, données, droits, biais et la validation humaine sont contrôlés et consignés dans la grille."),
        ("Maîtrisé", "Les contrôles sont hiérarchisés selon les risques, traçables et proportionnés. Les limites résiduelles sont expliquées."),
    ]))
    story.append(compact_appreciation("Appréciation du critère 3"))
    story.extend(rubric_block("4. Explication des choix et des limites", [
        ("Non acquis", "Les étapes suivies, la part de l’IA et les décisions humaines ne peuvent pas être expliquées."),
        ("En cours d’acquisition", "Les étapes sont décrites, mais les corrections, limites ou décisions humaines restent peu justifiées."),
        ("Acquis", "Les essais, corrections, choix, limites de l’outil et décisions humaines sont expliqués clairement."),
        ("Maîtrisé", "L’analyse montre du recul critique, tire des enseignements transférables et propose un plan réaliste et responsable."),
    ]))
    story.append(compact_appreciation("Appréciation du critère 4"))
    story.append(Spacer(1, 3 * mm))
    story.append(
        content_table(
            ["Décision finale", "Choix", "Date / formateur"],
            [
                ["Évaluation validée", "☐", ""],
                ["Reprise demandée", "☐", ""],
            ],
            [66 * mm, 20 * mm, 85 * mm],
        )
    )

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
        title="Modèle du cas pratique final et plan d'action - IA générative",
        author="FormaPrompt - Thierry FREZARD",
        subject="Support de préparation et grille d'évaluation du cas pratique final",
        creator="FormaPrompt",
        lang="fr-FR",
        pageCompression=1,
    )
    document.build(build_story(), onFirstPage=final_cover, onLaterPages=final_page)
    PUBLIC_COPY.write_bytes(OUTPUT.read_bytes())
    print(f"PDF créé : {OUTPUT}")
    print(f"Copie web : {PUBLIC_COPY}")


if __name__ == "__main__":
    main()
