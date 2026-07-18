from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import Image, PageBreak, Paragraph, Spacer, Table, TableStyle

from generate_guide_ia_generative import (
    BORDER,
    CROPPED_LOGO,
    GREEN,
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


OUTPUT = ROOT / "output" / "pdf" / "cahier-activites-ia-act-formaprompt.pdf"
PUBLIC_COPY = ROOT / "webapp" / "public" / "assets" / "cahier-activites-ia-act-formaprompt.pdf"

def activity_cover(canvas, doc):
    canvas.saveState()
    canvas.setTitle("Cahier d'activités - IA Act")
    canvas.setAuthor("FormaPrompt - Thierry FREZARD")
    canvas.setSubject("Cahier des quatre exercices de la formation IA Act")
    canvas.setKeywords("AI Act, exercices, activités, acculturation, formation, FormaPrompt")
    canvas.setFillColor(GREEN)
    canvas.rect(0, PAGE_HEIGHT - 19 * mm, PAGE_WIDTH, 19 * mm, fill=1, stroke=0)
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_WIDTH, 24 * mm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Arial", 8.5)
    canvas.drawCentredString(PAGE_WIDTH / 2, 10 * mm, "FormaPrompt - Formation IA & Bureautique")
    canvas.restoreState()


def activity_footer(canvas, page_number):
    canvas.saveState()
    canvas.setStrokeColor(BORDER)
    canvas.line(20 * mm, 15 * mm, PAGE_WIDTH - 20 * mm, 15 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, 10 * mm, f"Page {page_number}")
    canvas.restoreState()


class ActivityDocTemplate(GuideDocTemplate):
    """Dessine la pagination après le contenu."""

    def afterPage(self):
        if self.page > 1:
            activity_footer(self.canv, self.page)
        super().afterPage()


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


EXERCISES = [
    {
        "number": 1,
        "title": "Cartographier les usages de l'IA",
        "objective": "Module 1 - Usages, acteurs et premiers repères",
        "instructions": "Travaillez sur un à trois usages décrits avec des termes génériques. Cette cartographie prépare l'analyse et ne constitue pas une qualification juridique.",
        "steps": [
            "Choisir un à trois usages précis : tâche, résultat produit et action menée ensuite.",
            "Décrire les acteurs, les personnes concernées, les données et la supervision humaine.",
            "Indiquer « inconnu » lorsqu'un fait, un rôle, un fournisseur ou une source n'est pas vérifié.",
            "Conserver les questions ouvertes, les sources datées et les fonctions chargées de confirmer.",
        ],
        "preparation": [
            ("Structure", "Secteur, taille ou type de structure, en termes génériques"),
            ("Usage", "Tâche précise, résultat produit et action réalisée ensuite"),
            ("Outil", "Nom vérifié ou « inconnu »"),
            ("Acteurs", "Fournisseur, utilisateurs et rôle possible de l'organisation"),
            ("Personnes", "Public concerné par le résultat, sans identité"),
            ("Données", "Catégories uniquement, sans aucune donnée réelle"),
        ],
        "expected": "La réponse en ligne doit présenter la cartographie, la finalité, les acteurs, les données, la supervision, les faits inconnus, les sources à consulter et les points à faire confirmer.",
        "criteria": [
            "Chaque usage possède une finalité, un résultat et une action suffisamment précis.",
            "Les acteurs et le rôle possible de l'organisation sont distingués sans conclusion hâtive.",
            "Les données, les effets et la validation humaine sont indiqués sans information réelle.",
            "Les inconnues, sources et validations nécessaires sont clairement conservées.",
        ],
    },
    {
        "number": 2,
        "title": "Effectuer un premier tri des risques",
        "objective": "Module 2 - Premier tri et orientation",
        "instructions": "Analysez un cas fictif ou entièrement anonymisé. L'exercice repère des signaux et choisit la prochaine vérification ; il ne produit ni qualification juridique, ni décision de conformité.",
        "steps": [
            "Décrire la finalité, le résultat, les personnes concernées et l'action ou décision préparée.",
            "Séparer les faits vérifiés, les informations inconnues et les effets possibles.",
            "Examiner les signaux de pratique interdite, de haut risque, de transparence ou d'autre vigilance.",
            "Choisir une suite provisoire et les fonctions ou sources à consulter.",
        ],
        "preparation": [
            ("Finalité", "Objectif précis de l'usage fictif"),
            ("Utilisateurs", "Fonctions utilisant ou supervisant le système"),
            ("Personnes", "Public générique concerné par le résultat"),
            ("Résultat", "Contenu, recommandation, score ou décision"),
            ("Influence", "Action ou décision que le résultat prépare"),
            ("Supervision", "Contrôle, responsable, correction et arrêt possibles"),
        ],
        "expected": "La réponse en ligne doit distinguer faits, inconnues, effets, signaux, contrôles, questions à transmettre et orientation provisoire, avec les sources officielles datées à vérifier.",
        "criteria": [
            "La finalité, les personnes, le résultat et son influence sont décrits clairement.",
            "Les signaux sont repérés sans être présentés comme une qualification définitive.",
            "Les données, les droits, la supervision, la correction et l'arrêt sont examinés.",
            "La prochaine action, les questions et les sources sont justifiées et traçables.",
        ],
    },
    {
        "number": 3,
        "title": "Construire un plan d'acculturation",
        "objective": "Module 3 - Publics, actions et preuves",
        "instructions": "Préparez un plan adapté à des catégories de fonctions et à leurs usages. Aucun nom, score individuel, donnée personnelle ou information confidentielle ne doit être transmis.",
        "steps": [
            "Choisir trois groupes : utilisateurs occasionnels, réguliers et responsables ou superviseurs.",
            "Relier chaque groupe à des usages, responsabilités et risques précis.",
            "Définir des compétences, activités, règles d'arrêt et vérifications adaptées.",
            "Prévoir des preuves minimisées, des responsables, des échéances et des mises à jour.",
        ],
        "preparation": [
            ("Structure", "Type, taille, secteur et rôle possible de l'organisation"),
            ("Usages", "Systèmes et usages recensés, sans élément confidentiel"),
            ("Risques", "Effets possibles et personnes concernées"),
            ("Ressources", "Règles, supports et accompagnements déjà disponibles"),
            ("Coordination", "Fonction chargée du plan, sans nom"),
            ("Révision", "Changements d'outil, d'usage, d'incident ou de règle"),
        ],
        "expected": "La réponse en ligne doit relier chaque groupe à ses usages, compétences, activités, règles de vérification et d'arrêt, preuves minimisées, responsables, échéances et déclencheurs d'actualisation.",
        "criteria": [
            "Chaque groupe est relié à des usages, responsabilités et risques identifiés.",
            "Les objectifs précisent ce qu'il faut comprendre, appliquer, vérifier et interrompre.",
            "Les activités et accompagnements sont adaptés au niveau et au contexte.",
            "Les preuves, responsables, échéances et mises à jour sont définis sans collecte inutile.",
        ],
    },
    {
        "number": 4,
        "title": "Construire une feuille de route 30-60-90 jours",
        "objective": "Module 4 - Priorités, responsabilités et suivi",
        "instructions": "Rassemblez les constats des exercices précédents avec un cas fictif ou entièrement générique. N'insérez aucun document, incident détaillé ou donnée non autorisée.",
        "steps": [
            "Séparer les faits, inconnues, signaux de vigilance et décisions déjà prises.",
            "Répartir huit actions au maximum entre 30, 60, 90 jours et le suivi continu.",
            "Attribuer un pilote, des validations, un livrable, un critère, une échéance et une preuve.",
            "Dater les sources officielles et prévoir les points de revue et déclencheurs d'actualisation.",
        ],
        "preparation": [
            ("Constats", "Faits, inconnues et décisions issus des trois exercices"),
            ("Vigilances", "Interdiction possible, effets, données, sécurité ou transparence"),
            ("Acculturation", "Groupes et objectifs déjà prévus"),
            ("Fonctions", "Pilotes et validations disponibles, sans nom"),
            ("Échéances", "Dates à vérifier dans des sources officielles"),
            ("Limite", "Huit actions pilotables au maximum"),
        ],
        "expected": "La réponse en ligne doit présenter les faits et inconnues, la feuille de route limitée, les trois premières actions, les validations spécialisées, l'ordre du jour de revue et les questions de mise à jour.",
        "criteria": [
            "Les priorités découlent des effets, de l'urgence, des inconnues et des échéances.",
            "Les usages sensibles sont suspendus ou transmis avant les améliorations secondaires.",
            "Chaque action possède pilote, validations, livrable et échéance réaliste.",
            "Les preuves, sources datées et revues permettent un suivi sans promesse de conformité.",
        ],
    },
]


def exercise_header(exercise, section, intro):
    return page_title(
        f"Exercice {exercise['number']} sur 4 - {exercise['objective']} - {section}",
        exercise["title"],
        intro,
    )


def preparation_page(exercise):
    story = exercise_header(exercise, "Préparation", exercise["instructions"])
    story.append(p("Les quatre étapes", "h2"))
    story.extend(numbered(exercise["steps"]))
    story.append(p("Préparer mon cas", "h2"))
    story.append(worksheet(exercise["preparation"], label_width=39 * mm))
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Modèle complet", "Ouvrez l'exercice correspondant dans l'espace apprenant, copiez le modèle proposé et remplacez chaque élément entre crochets. Écrivez « inconnu » lorsque le fait n'est pas vérifié ; ne demandez jamais une conclusion automatique de conformité.", "gray"))
    story.append(PageBreak())
    return story


def realization_page(exercise):
    number = exercise["number"]
    story = exercise_header(exercise, "Réalisation", "Notez les résultats utiles avec des termes génériques, puis reportez la version contrôlée dans l'espace apprenant.")

    if number == 1:
        story.append(
            content_table(
                ["Usage et finalité", "Acteurs et personnes", "Données / résultat", "Supervision / inconnu"],
                [["", "", "", ""], ["", "", "", ""], ["", "", "", ""]],
                [43 * mm, 43 * mm, 43 * mm, 42 * mm],
            )
        )
        story.append(Spacer(1, 4 * mm))
        story.append(lines_box("Questions ouvertes", "Cinq questions de clarification à transmettre.", 44 * mm, 4))
        story.append(Spacer(1, 4 * mm))
        story.append(lines_box("Sources et fonctions à consulter", "Source, date de consultation et fonction chargée de confirmer.", 42 * mm, 4))
    elif number == 2:
        story.append(
            content_table(
                ["Fait connu", "Inconnu", "Effet ou signal", "Question / expertise"],
                [["", "", "", ""] for _ in range(5)],
                [42 * mm, 38 * mm, 49 * mm, 42 * mm],
            )
        )
        story.append(Spacer(1, 4 * mm))
        story.append(lines_box("Orientation provisoire", "Suspendre, analyser, préciser les contrôles ou expérimenter de façon limitée. Justifiez.", 44 * mm, 4))
        story.append(Spacer(1, 4 * mm))
        story.append(lines_box("Sources officielles à vérifier", "Titre, adresse, date de consultation et point restant à confirmer.", 40 * mm, 3))
    elif number == 3:
        story.append(
            content_table(
                ["Groupe", "Usages / risques", "Compétences / activité", "Vérification / preuve"],
                [
                    ["Occasionnels", "", "", ""],
                    ["Réguliers", "", "", ""],
                    ["Responsables / superviseurs", "", "", ""],
                ],
                [38 * mm, 44 * mm, 49 * mm, 40 * mm],
            )
        )
        story.append(Spacer(1, 4 * mm))
        story.append(lines_box("Action réalisable sous 30 jours", "Groupe, objectif, activité, responsable, échéance et preuve minimale.", 42 * mm, 4))
        story.append(Spacer(1, 4 * mm))
        story.append(lines_box("Déclencheurs de mise à jour", "Trois événements et les fonctions à consulter.", 40 * mm, 3))
    else:
        story.append(
            content_table(
                ["Horizon", "Priorité / action", "Pilote / validations", "Livrable / preuve / revue"],
                [
                    ["30 jours", "", "", ""],
                    ["60 jours", "", "", ""],
                    ["90 jours", "", "", ""],
                    ["Suivi continu", "", "", ""],
                ],
                [29 * mm, 52 * mm, 44 * mm, 46 * mm],
            )
        )
        story.append(Spacer(1, 4 * mm))
        story.append(lines_box("Les trois premières actions", "Ordre, justification et décision à faire valider.", 42 * mm, 4))
        story.append(Spacer(1, 4 * mm))
        story.append(lines_box("Revue de 30 minutes", "Ordre du jour, sources à actualiser et cinq questions de suivi.", 40 * mm, 3))

    story.append(PageBreak())
    return story


def bilan_page(exercise):
    story = exercise_header(exercise, "Bilan", "Appuyez chaque appréciation sur un élément précis de votre travail avant de déclarer la réponse terminée.")
    story.append(callout("Réponse attendue par le formateur", exercise["expected"], "green"))
    story.append(p("Autoévaluation", "h2"))
    story.append(check_table(exercise["criteria"]))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Ce que j'ai appris", "Une méthode, un contrôle ou une limite que je saurai réutiliser.", 30 * mm, 2))
    story.append(Spacer(1, 3 * mm))
    story.extend(feedback_block())
    if exercise["number"] == 4:
        story.append(Spacer(1, 4 * mm))
        story.append(callout("Prochaine étape", "Lorsque les quatre exercices sont terminés et relus, préparez les quatre livrables du cas pratique final dans l'espace apprenant.", "amber"))
    else:
        story.append(PageBreak())
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
            p("IA Act<br/>mes quatre exercices pratiques", "cover_title"),
            p("Décrire, orienter, acculturer et préparer une feuille de route", "cover_subtitle"),
            callout(
                "À utiliser avec l'espace apprenant",
                "Posez vos idées dans ce cahier, puis enregistrez la réponse dans l'exercice correspondant pour conserver les versions et recevoir le retour du formateur. Le cahier imprimé ne remplace pas la remise en ligne et ne constitue pas une preuve de conformité.",
            ),
            Spacer(1, 5 * mm),
            worksheet(
                [
                    ("Participant", "Nom et prénom"),
                    ("Session", "Date ou période de la formation"),
                    ("Modalité", "☐ Présentiel    ☐ Classe virtuelle"),
                ],
                label_width=38 * mm,
            ),
        ]
    )
    story.append(PageBreak())

    # 2 - Mode d'emploi
    story.extend(page_title("Avant de commencer", "Comment utiliser ce cahier ?", "Chaque exercice suit le même chemin : préparer, structurer, contrôler, s'autoévaluer, puis enregistrer une version dans l'espace apprenant."))
    story.extend(
        numbered(
            [
                "<b>Préparez le cas.</b> Utilisez une situation fictive, générique ou entièrement anonymisée.",
                "<b>Complétez les informations.</b> Écrivez « inconnu » lorsque le fait ou la source n'est pas vérifié.",
                "<b>Utilisez le modèle en ligne.</b> Copiez le modèle de l'exercice dans un outil autorisé si le formateur le prévoit.",
                "<b>Contrôlez le résultat.</b> Séparez les faits, les inconnues, les signaux et les validations compétentes.",
                "<b>Enregistrez dans l'espace apprenant.</b> Gardez le brouillon pendant le travail et déclarez la réponse terminée lorsqu'elle est prête.",
            ]
        )
    )
    story.append(callout("Données et confidentialité", "N'inscrivez ni nom de client, salarié ou candidat, ni adresse, dossier, donnée de santé, identifiant, mot de passe, contrat, incident détaillé ou information interne non autorisée dans un service public d'IA.", "red"))
    story.append(p("Ce que le formateur regarde", "h2"))
    story.extend(
        bullets(
            [
                "la précision de l'usage, de la finalité et des acteurs ;",
                "la séparation entre les faits, les inconnues et les signaux ;",
                "la prise en compte des personnes, des données et de la supervision ;",
                "la proportion entre les usages, les risques, l'acculturation et les preuves ;",
                "la capacité à suspendre, transmettre et revoir une décision sans promettre la conformité.",
            ]
        )
    )
    story.append(callout("Historique officiel", "Les réponses, versions, corrections et validations officielles restent celles enregistrées dans l'espace apprenant. Ce cahier constitue un support personnel et imprimable.", "gray"))
    story.append(PageBreak())

    # 3 - Tableau de bord
    story.extend(page_title("Tableau de bord personnel", "Suivre les quatre exercices", "Complétez une ligne après chaque séance. Le statut officiel reste celui affiché dans l'espace apprenant."))
    story.append(
        content_table(
            ["Exercice", "Préparé", "Contrôlé", "Enregistré", "Retour formateur"],
            [
                ["1. Cartographier les usages", "☐", "☐", "☐ Brouillon  ☐ Terminé", "☐ Validé  ☐ Reprise"],
                ["2. Premier tri", "☐", "☐", "☐ Brouillon  ☐ Terminé", "☐ Validé  ☐ Reprise"],
                ["3. Plan d'acculturation", "☐", "☐", "☐ Brouillon  ☐ Terminé", "☐ Validé  ☐ Reprise"],
                ["4. Feuille de route", "☐", "☐", "☐ Brouillon  ☐ Terminé", "☐ Validé  ☐ Reprise"],
            ],
            [53 * mm, 20 * mm, 22 * mm, 42 * mm, 34 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(lines_box("Ce que je souhaite savoir faire", "Deux ou trois compétences concrètes.", 45 * mm, 4))
    story.append(Spacer(1, 4 * mm))
    story.append(lines_box("Ma principale difficulté", "Inventaire, vigilance, acculturation, preuves ou priorités.", 40 * mm, 3))
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
    document = ActivityDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=22 * mm,
        bottomMargin=20 * mm,
        title="Cahier d'activités - IA Act",
        author="FormaPrompt - Thierry FREZARD",
        subject="Cahier des quatre exercices de la formation IA Act",
        creator="FormaPrompt",
        lang="fr-FR",
        pageCompression=1,
    )
    document.build(build_story(), onFirstPage=activity_cover)
    PUBLIC_COPY.write_bytes(OUTPUT.read_bytes())
    print(f"PDF créé : {OUTPUT}")
    print(f"Copie web : {PUBLIC_COPY}")


if __name__ == "__main__":
    main()
