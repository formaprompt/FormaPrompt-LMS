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


OUTPUT = ROOT / "output" / "pdf" / "modele-cas-final-plan-action-prompt-engineering-niveau-1-formaprompt.pdf"
PUBLIC_COPY = ROOT / "webapp" / "public" / "assets" / "modele-cas-final-plan-action-prompt-engineering-niveau-1-formaprompt.pdf"


def final_cover(canvas, doc):
    canvas.saveState()
    canvas.setTitle("Modèle du cas pratique final et plan d'action - Prompt Engineering - Niveau 1")
    canvas.setAuthor("FormaPrompt - Thierry FREZARD")
    canvas.setSubject("Support de préparation et grille d'évaluation du cas pratique final")
    canvas.setKeywords("prompt engineering, cas pratique, plan d'action, évaluation, FormaPrompt")
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
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, PAGE_HEIGHT - 12 * mm, "Cas pratique final - Prompt Engineering - Niveau 1")
    canvas.setStrokeColor(BORDER)
    canvas.line(20 * mm, 15 * mm, PAGE_WIDTH - 20 * mm, 15 * mm)
    canvas.setFont("Arial", 8)
    canvas.drawString(20 * mm, 10 * mm, "Version juillet 2026")
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, 10 * mm, f"Page {doc.page}")
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


def build_story():
    story = []

    # 1 - Couverture
    story.extend(
        [
            Spacer(1, 23 * mm),
            Image(str(CROPPED_LOGO), width=66 * mm, height=45 * mm, kind="proportional"),
            Spacer(1, 8 * mm),
            p("MODÈLE IMPRIMABLE", "cover_eyebrow"),
            p("Cas pratique final<br/>et plan d'action individuel", "cover_title"),
            p("Formation Prompt Engineering - Niveau 1", "cover_subtitle"),
            callout(
                "Objectif du document",
                "Vous aider à réunir les quatre livrables attendus, expliquer votre démarche et préparer un prochain usage réaliste. Le résultat n'a pas besoin d'être parfait dès le premier essai : l'écart observé, la correction et les contrôles font partie de l'évaluation.",
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
    story.extend(
        page_title(
            "Mode d'emploi",
            "Préparer les quatre livrables",
            "Travaillez progressivement dans ce modèle. Lorsque votre dossier est prêt, recopiez les références et explications utiles dans les quatre champs du cas pratique final de l'espace apprenant.",
        )
    )
    story.append(
        content_table(
            ["Livrable", "Ce qui est attendu", "Où le préparer"],
            [
                ["1. Prompt final", "Le prompt final, l'écart initial et la principale amélioration.", "Pages 4 à 7"],
                ["2. Résultat", "Le résultat final ou sa maquette, accessible au formateur.", "Page 7"],
                ["3. Contrôles", "Les critères, sources, limites et la décision d'usage.", "Page 8"],
                ["4. Modèle", "Les variables, le prochain usage et le contrôle humain à conserver.", "Page 9"],
            ],
            [39 * mm, 93 * mm, 39 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.extend(
        numbered(
            [
                "Choisissez une situation réelle ou réaliste de votre activité, mais sans donnée personnelle ni information confidentielle.",
                "Conservez le prompt initial, le premier résultat et la correction ciblée qui a amélioré le travail.",
                "Comparez le résultat final à trois critères définis avant le test et aux sources utiles.",
                "Expliquez votre décision : utiliser, corriger ou rejeter le résultat.",
                "Préparez un modèle réutilisable et un prochain usage limité, puis déclarez la remise terminée dans l'espace apprenant.",
            ]
        )
    )
    story.append(
        callout(
            "Protection des données",
            "N'inscrivez aucune identité, adresse, donnée de santé, dossier de client ou de salarié, identifiant, mot de passe ou information interne non autorisée. Utilisez des fonctions génériques, des exemples fictifs et des liens dont le partage est volontairement limité au formateur.",
            "red",
        )
    )
    story.append(
        callout(
            "Validation",
            "Les quatre critères doivent atteindre au minimum le niveau <b>Acquis</b>. Le niveau <b>Maîtrisé</b> reconnaît une autonomie supplémentaire mais n'est pas obligatoire.",
            "green",
        )
    )
    story.append(PageBreak())

    # 3 - Cadrage
    story.extend(
        page_title(
            "Étape 1 sur 5",
            "Cadrer un cas limité et vérifiable",
            "Un bon cas final permet de montrer la méthode en 30 minutes. Il doit être assez précis pour être testé et assez peu risqué pour être corrigé avant toute utilisation.",
        )
    )
    story.append(
        worksheet(
            [
                ("Besoin professionnel", "Le problème ou la tâche à traiter"),
                ("Public", "La fonction, le niveau et le besoin du destinataire"),
                ("Résultat attendu", "Le livrable observable à produire"),
                ("Usage", "La décision ou l'action que le résultat doit préparer"),
                ("Périmètre", "Ce qui est inclus et ce qui reste hors du cas"),
                ("Informations autorisées", "Les faits ou sources réellement utilisables"),
                ("Informations interdites", "Les données personnelles, sensibles ou confidentielles exclues"),
                ("Validation humaine", "La personne ou fonction qui contrôle le résultat"),
            ],
            label_width=47 * mm,
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(p("Test de pertinence", "h2"))
    story.append(
        content_table(
            ["Question", "Oui", "À revoir"],
            [
                ["Le cas peut-il être expliqué en deux phrases ?", "☐", "☐"],
                ["Le résultat peut-il être comparé à trois critères observables ?", "☐", "☐"],
                ["Un écart peut-il être repéré et corrigé avant utilisation ?", "☐", "☐"],
                ["Le cas exclut-il les données et actions interdites ?", "☐", "☐"],
            ],
            [131 * mm, 20 * mm, 20 * mm],
        )
    )
    story.append(PageBreak())

    # 4 - Prompt initial
    story.extend(
        page_title(
            "Étape 2 sur 5",
            "Préparer le prompt initial et les critères",
            "Commencez par une version explicite, même imparfaite. Elle servira de point de comparaison pour expliquer l'amélioration.",
        )
    )
    story.append(
        worksheet(
            [
                ("Objectif", "Le résultat concret attendu"),
                ("Contexte et public", "La situation utile et la personne destinataire"),
                ("Informations", "Les faits autorisés et les éléments absents"),
                ("Contraintes", "Le ton, la longueur, les obligations et les interdictions"),
                ("Format", "La structure précise du résultat"),
                ("Clarification", "Les questions à poser si une information essentielle manque"),
            ],
            label_width=42 * mm,
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(p("Mes trois critères de réussite", "h2"))
    story.append(
        content_table(
            ["Critère observable", "Comment le contrôler ?", "Seuil attendu"],
            [["1.", "", ""], ["2.", "", ""], ["3.", "", ""]],
            [58 * mm, 72 * mm, 41 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Mon prompt initial", "Conservez cette version avant de lancer le premier test.", 40 * mm))
    story.append(PageBreak())

    # 5 - Premier test
    story.extend(
        page_title(
            "Étape 3 sur 5",
            "Tester et observer un écart précis",
            "Notez le premier résultat sans recopier de donnée personnelle. Comparez-le aux critères plutôt qu'à une impression générale.",
        )
    )
    story.append(lines_box("Résultat du premier test", "Extrait utile, description du résultat ou référence du document autorisé.", 52 * mm))
    story.append(Spacer(1, 3 * mm))
    story.append(
        content_table(
            ["Critère", "Observation dans le résultat", "Conforme"],
            [["1.", "", "☐ Oui  ☐ Non"], ["2.", "", "☐ Oui  ☐ Non"], ["3.", "", "☐ Oui  ☐ Non"]],
            [37 * mm, 93 * mm, 41 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Écart prioritaire", "Nommez un seul écart observable : ajout, omission, format, ton, source, niveau de détail ou autre limite.", 38 * mm))
    story.append(Spacer(1, 3 * mm))
    story.append(lines_box("Cause probable", "Partie du prompt trop vague, information absente, contrainte contradictoire ou contrôle manquant.", 32 * mm))
    story.append(callout("Rester factuel", "Remplacez « le résultat n'est pas bon » par une comparaison précise : critère, extrait observé et écart à corriger.", "green"))
    story.append(PageBreak())

    # 6 - Correction
    story.extend(
        page_title(
            "Étape 4 sur 5",
            "Corriger, retester et comparer",
            "Modifiez uniquement ce qui répond à l'écart prioritaire. Conservez les deux versions afin de rendre l'amélioration visible.",
        )
    )
    story.append(lines_box("Correction apportée au prompt ou au processus", "La formulation ajoutée, retirée ou précisée et sa justification.", 49 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Résultat après correction", "Extrait utile, description ou référence du second résultat.", 56 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(
        content_table(
            ["Point comparé", "Avant", "Après", "Décision"],
            [
                ["Critère concerné", "", "", "☐ Atteint\n☐ À reprendre"],
                ["Information absente", "", "", "☐ Signalée\n☐ Inventée"],
                ["Format et usage", "", "", "☐ Adaptable\n☐ À corriger"],
            ],
            [41 * mm, 42 * mm, 45 * mm, 43 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Ce que cette itération démontre", "Expliquez le lien entre la correction et l'amélioration observée.", 39 * mm))
    story.append(PageBreak())

    # 7 - Livrables 1 et 2
    story.extend(
        page_title(
            "Livrables 1 et 2",
            "Présenter le prompt final et le résultat",
            "Ces informations correspondent aux deux premiers champs de remise dans l'espace apprenant.",
        )
    )
    story.append(lines_box("Prompt final", "Recopiez-le ou indiquez le nom du document et son emplacement sécurisé.", 67 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(
        worksheet(
            [
                ("Écart initial", "Le point précis qui ne répondait pas aux attentes"),
                ("Correction principale", "La modification ciblée du prompt ou du processus"),
                ("Effet obtenu", "La différence observée dans le second résultat"),
            ],
            label_width=44 * mm,
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Résultat final ou maquette", "Décrivez le résultat et indiquez où le formateur peut le consulter. Vérifiez volontairement les droits d'accès du lien partagé.", 53 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Avant la remise", "Ouvrez vous-même le document ou le lien depuis un accès équivalent à celui du formateur. Un résultat inaccessible ne peut pas être évalué.", "amber"))
    story.append(PageBreak())

    # 8 - Livrable 3
    story.extend(
        page_title(
            "Livrable 3",
            "Documenter les contrôles et la décision d'usage",
            "Retrouvez les faits utiles, comparez le résultat aux critères et notez les limites avant de décider de son usage.",
        )
    )
    story.append(
        worksheet(
            [
                ("Critères", "Les trois critères contrôlés et leur résultat"),
                ("Sources", "Les documents ou références effectivement consultés"),
                ("Faits retrouvés", "Les informations importantes confirmées dans la source"),
                ("Données", "Minimisation, informations exclues et partage autorisé"),
                ("Limites", "Incertitudes, ambiguïté, biais ou validation encore nécessaire"),
                ("Validation humaine", "Personne ou fonction, périmètre et date du contrôle"),
            ],
            label_width=46 * mm,
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Décision d'usage", "h2"))
    story.append(
        content_table(
            ["Décision", "Choix", "Justification"],
            [
                ["Utiliser après validation", "☐", ""],
                ["Corriger avant utilisation", "☐", ""],
                ["Rejeter le résultat", "☐", ""],
            ],
            [58 * mm, 20 * mm, 93 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Doute non levé", "Suspendez l'utilisation, retirez l'information concernée ou demandez l'avis d'une personne compétente. Conservez cette décision dans la remise.", "red"))
    story.append(PageBreak())

    # 9 - Livrable 4 et plan d'action
    story.extend(
        page_title(
            "Livrable 4",
            "Préparer le modèle réutilisable et le prochain usage",
            "Transformez le prompt final en modèle à variables, puis choisissez une situation proche et limitée dans laquelle le retester.",
        )
    )
    story.append(
        worksheet(
            [
                ("Objectif stable", "Le travail que le modèle permet de préparer"),
                ("Variables", "[public], [source], [format], [critères] et autres éléments à remplacer"),
                ("Entrées et règles fixes", "Informations minimales, interdictions, format et contrôle humain"),
                ("Cas à exclure", "Les situations dans lesquelles le modèle ne doit pas être utilisé"),
            ],
            label_width=46 * mm,
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Mon modèle réutilisable", "Conservez les variables entre crochets et les contrôles qui ne doivent jamais disparaître.", 35 * mm))
    story.append(Spacer(1, 3 * mm))
    story.append(p("Plan d'action individuel", "h2"))
    story.append(
        worksheet(
            [
                ("Prochain usage", "Une situation proche, simple et réaliste"),
                ("Date du test", "Une date sous 30 jours"),
                ("Preuve à conserver", "Prompt, résultat, écart, correction et décision"),
                ("Contrôle humain", "La personne ou fonction responsable avant utilisation"),
            ],
            label_width=46 * mm,
        )
    )
    story.append(PageBreak())

    # 10 - Autoevaluation
    story.extend(
        page_title(
            "Avant la remise",
            "M'autoévaluer et vérifier le dossier",
            "Appuyez chaque réponse sur une preuve présente dans votre travail. Une case cochée sans exemple ne suffit pas.",
        )
    )
    story.append(
        content_table(
            ["Critère", "Preuve dans mon dossier", "Mon niveau"],
            [
                ["Cadrage du besoin et du public", "", "☐ Non acquis\n☐ En cours\n☐ Acquis\n☐ Maîtrisé"],
                ["Prompt, critères et amélioration", "", "☐ Non acquis\n☐ En cours\n☐ Acquis\n☐ Maîtrisé"],
                ["Contrôles et maîtrise des risques", "", "☐ Non acquis\n☐ En cours\n☐ Acquis\n☐ Maîtrisé"],
                ["Explication des choix et réutilisation", "", "☐ Non acquis\n☐ En cours\n☐ Acquis\n☐ Maîtrisé"],
            ],
            [57 * mm, 72 * mm, 42 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("Checklist de remise", "h2"))
    story.extend(
        bullets(
            [
                "☐ Le prompt initial, le prompt final et la correction principale sont identifiés.",
                "☐ Le résultat final ou sa maquette est accessible au formateur.",
                "☐ Les trois critères, les sources, les limites et la décision d'usage sont expliqués.",
                "☐ Le modèle réutilisable contient des variables, des règles fixes et des cas à exclure.",
                "☐ Le prochain usage est daté et conserve un contrôle humain explicite.",
                "☐ Aucun champ ni document ne contient de donnée personnelle ou confidentielle inutile.",
                "☐ Les quatre livrables ont été reportés dans le cas final de l'espace apprenant.",
                "☐ La remise a été déclarée terminée uniquement lorsque le dossier est prêt pour l'évaluation.",
            ]
        )
    )
    story.append(lines_box("Ma dernière vérification", "Le point contrôlé juste avant de déclarer la remise terminée.", 30 * mm))
    story.append(callout("Historique officiel", "Le présent modèle peut être conservé ou imprimé. La remise, ses versions et la correction officielle restent enregistrées dans l'espace apprenant."))
    story.append(PageBreak())

    # 11 - Rubrique formateur 1 et 2
    story.extend(
        page_title(
            "Réservé au formateur",
            "Grille d'évaluation - critères 1 et 2",
            "Cochez un niveau par critère et appuyez l'évaluation sur les éléments remis par l'apprenant.",
        )
    )
    story.extend(
        rubric_block(
            "1. Cadrage du besoin et du public",
            [
                ("Non acquis", "Le besoin, le public, les informations autorisées ou le résultat attendu ne sont pas identifiés."),
                ("En cours d'acquisition", "Le cas est compréhensible, mais le public, les sources, les contraintes ou l'usage du résultat restent partiellement définis."),
                ("Acquis", "Le besoin, le public, le résultat, les informations autorisées et les contraintes utiles sont définis avec précision."),
                ("Maîtrisé", "Le cadrage justifie les choix, anticipe les limites du cas et permet d'adapter la méthode à une situation proche."),
            ],
        )
    )
    story.append(lines_box("Appréciation du critère 1", "Preuve observée et amélioration éventuelle.", 37 * mm))
    story.extend(
        rubric_block(
            "2. Prompt, critères et amélioration",
            [
                ("Non acquis", "Le prompt reste vague et aucun critère ne permet de contrôler le résultat."),
                ("En cours d'acquisition", "Le prompt possède une structure, mais le contexte, le format, les critères ou l'amélioration restent incomplets."),
                ("Acquis", "Le prompt précise l'objectif, le contexte, le public, les informations, les contraintes, le format et des critères observables. Une correction ciblée est justifiée."),
                ("Maîtrisé", "Le prompt est réutilisable grâce à des variables et les essais démontrent une amélioration autonome fondée sur les écarts constatés."),
            ],
        )
    )
    story.append(lines_box("Appréciation du critère 2", "Preuve observée et amélioration éventuelle.", 37 * mm))
    story.append(PageBreak())

    # 12 - Rubrique formateur 3 et 4
    story.extend(
        page_title(
            "Réservé au formateur",
            "Grille d'évaluation - critères 3 et 4",
            "La validation finale exige au minimum le niveau Acquis pour chacun des quatre critères.",
        )
    )
    story.extend(
        rubric_block(
            "3. Contrôles et maîtrise des risques",
            [
                ("Non acquis", "Le résultat est conservé sans contrôle suffisant ou des données non autorisées sont utilisées."),
                ("En cours d'acquisition", "Des contrôles sont mentionnés, mais les sources, les critères, les données, les limites ou la validation humaine ne sont pas tous traités."),
                ("Acquis", "Le résultat est comparé aux critères et aux sources utiles. Les données sont minimisées, les incertitudes signalées et la validation humaine prévue."),
                ("Maîtrisé", "Les contrôles sont hiérarchisés, traçables et proportionnés ; les conditions d'arrêt, de correction ou de rejet sont clairement expliquées."),
            ],
        )
    )
    story.append(compact_appreciation("Appréciation du critère 3"))
    story.extend(
        rubric_block(
            "4. Explication des choix et réutilisation",
            [
                ("Non acquis", "L'écart, la correction, la décision d'usage ou les limites ne peuvent pas être expliqués."),
                ("En cours d'acquisition", "Les étapes sont décrites, mais la correction, la décision d'usage ou les conditions de réutilisation restent peu justifiées."),
                ("Acquis", "L'écart, la correction, la décision d'usage, les limites, les variables et le contrôle à conserver sont expliqués clairement."),
                ("Maîtrisé", "L'analyse tire un enseignement transférable, précise les situations dans lesquelles le modèle ne doit pas être utilisé et propose un prochain usage réaliste."),
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
    document = GuideDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=22 * mm,
        bottomMargin=20 * mm,
        title="Modèle du cas pratique final et plan d'action - Prompt Engineering - Niveau 1",
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
