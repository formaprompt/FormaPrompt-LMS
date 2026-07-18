from reportlab.lib.enums import TA_CENTER
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


OUTPUT = ROOT / "output" / "pdf" / "guide-pratique-ia-act-formaprompt.pdf"
PUBLIC_COPY = ROOT / "webapp" / "public" / "assets" / "guide-pratique-ia-act-formaprompt.pdf"

cover_note_style = ParagraphStyle(
    "AiActCoverNote",
    parent=styles["cover_subtitle"],
    fontSize=10,
    leading=14,
    textColor=MUTED,
    alignment=TA_CENTER,
)

source_style = ParagraphStyle(
    "AiActSource",
    parent=styles["small"],
    fontSize=7.6,
    leading=10.4,
    textColor=MUTED,
    spaceAfter=2.2 * mm,
)


def cover_page(canvas, doc):
    canvas.saveState()
    canvas.setTitle("Guide pratique - IA Act")
    canvas.setAuthor("FormaPrompt - Thierry FREZARD")
    canvas.setSubject("Support pédagogique d'acculturation et de préparation à la conformité AI Act")
    canvas.setKeywords("AI Act, maîtrise de l'IA, acculturation, risques, formation, FormaPrompt")
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
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, PAGE_HEIGHT - 12 * mm, "Guide pratique - IA Act")
    canvas.setStrokeColor(BORDER)
    canvas.line(20 * mm, 15 * mm, PAGE_WIDTH - 20 * mm, 15 * mm)
    canvas.setFont("Arial", 8)
    canvas.drawString(20 * mm, 10 * mm, "Version du 18 juillet 2026")
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def working_box(title, rows, label_width=47 * mm):
    return [p(title, "h2"), worksheet(rows, label_width=label_width)]


def module_overview(number, title, objective, method, demonstration, expected, checks):
    story = page_title(f"Module {number} - 1 h", title, objective)
    story.append(p("Méthode guidée", "h2"))
    story.extend(numbered(method))
    story.append(p("Démonstration professionnelle", "h2"))
    story.append(callout(demonstration[0], demonstration[1], demonstration[2]))
    story.append(p("Production attendue dans l'exercice", "h2"))
    story.extend(bullets(expected))
    story.append(callout("Avant de déclarer l'exercice terminé", checks, "amber"))
    story.append(PageBreak())
    return story


def source_link(label, url):
    return Paragraph(f"<b>{label}</b><br/><link href='{url}' color='#087F5B'>{url}</link>", source_style)


def build_story():
    story = []

    # 1 - Couverture
    story.extend(
        [
            Spacer(1, 24 * mm),
            Image(str(CROPPED_LOGO), width=66 * mm, height=45 * mm, kind="proportional"),
            Spacer(1, 8 * mm),
            p("GUIDE PRATIQUE", "cover_eyebrow"),
            p("IA Act<br/>acculturation et premiers repères", "cover_title"),
            p("Comprendre les usages, organiser la vigilance et préparer une feuille de route", "cover_subtitle"),
            callout(
                "À quoi sert ce guide ?",
                "À suivre les quatre modules, préparer les exercices et structurer les premières actions de l'organisation. Il complète l'espace apprenant et les échanges avec le formateur. Il ne constitue ni un avis juridique, ni une qualification réglementaire, ni une déclaration de conformité.",
            ),
            Spacer(1, 4 * mm),
            Paragraph("Formation de 4 h 45, cas pratique final inclus - version réglementaire datée", cover_note_style),
        ]
    )
    story.append(PageBreak())

    # 2 - Parcours
    story.extend(
        page_title(
            "Mode d'emploi",
            "Votre parcours en quatre modules",
            "Avancez dans l'ordre. Chaque module transforme un constat en production concrète, puis l'exercice conserve votre démarche dans l'espace apprenant.",
        )
    )
    story.append(
        content_table(
            ["Module", "Compétence travaillée", "Production attendue"],
            [
                ["1 - Comprendre", "Décrire les usages, les acteurs et les premiers repères.", "Une cartographie factuelle d'un à trois usages."],
                ["2 - Orienter", "Repérer les vigilances et choisir la prochaine vérification.", "Un premier tri sans conclusion juridique."],
                ["3 - Acculturer", "Adapter la maîtrise de l'IA aux fonctions et aux usages.", "Un plan d'acculturation avec preuves proportionnées."],
                ["4 - Agir", "Prioriser, attribuer et suivre les actions utiles.", "Une feuille de route à 30, 60 et 90 jours."],
            ],
            [31 * mm, 75 * mm, 65 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.extend(
        numbered(
            [
                "Relisez le résultat de votre positionnement initial pour repérer les points à approfondir.",
                "Lisez l'explication et la démonstration avant de préparer l'exercice lié au module.",
                "Travaillez avec un cas fictif, générique ou entièrement anonymisé, sans document confidentiel.",
                "Enregistrez un brouillon, contrôlez-le, puis déclarez la réponse terminée lorsqu'elle est prête.",
                "Utilisez le retour du formateur et préparez ensuite les quatre livrables du cas final.",
            ]
        )
    )
    story.append(callout("Règle commune", "Décrire un usage ne suffit pas à le qualifier. Un mot-clé, un secteur ou un outil ne permettent pas, seuls, de conclure sur le niveau de risque ou la conformité.", "red"))
    story.append(PageBreak())

    # 3 - Limites et vocabulaire
    story.extend(
        page_title(
            "Repères avant l'analyse",
            "Séparer les faits, les hypothèses et les décisions",
            "Cette séparation évite les conclusions trop rapides et rend les validations nécessaires visibles.",
        )
    )
    story.append(
        content_table(
            ["Catégorie", "Question", "Exemple"],
            [
                ["Fait vérifié", "Que savons-nous avec une source identifiable ?", "L'outil propose un classement que le recruteur peut modifier."],
                ["Information manquante", "Que faut-il encore obtenir ?", "Le fournisseur n'a pas encore transmis la documentation."],
                ["Signal de vigilance", "Quel effet possible justifie un arrêt ou un contrôle ?", "Le résultat influence l'accès à l'emploi."],
                ["Validation compétente", "Qui doit examiner ou décider ?", "Responsables métier, juridique, données, sécurité ou achats selon le cas."],
            ],
            [37 * mm, 67 * mm, 67 * mm],
        )
    )
    story.append(p("Les quatre rôles à distinguer", "h2"))
    story.extend(
        bullets(
            [
                "Le <b>fournisseur</b> développe un système d'IA ou le fait développer et le met sur le marché ou en service sous son nom.",
                "Le <b>déployeur</b> utilise un système d'IA sous son autorité, sauf usage personnel non professionnel.",
                "L'<b>importateur</b> ou le <b>distributeur</b> intervient dans la mise à disposition du système sur le marché européen.",
                "Une même organisation peut avoir des rôles différents selon le système, la personnalisation et l'usage.",
            ]
        )
    )
    story.append(callout("Point de prudence", "Les définitions simplifiées aident à poser les bonnes questions. Pour une décision réelle, relisez les définitions du règlement et faites confirmer le rôle de l'organisation.", "amber"))
    story.append(PageBreak())

    # 4 - Module 1
    story.extend(
        module_overview(
            1,
            "Comprendre l'IA et son cadre européen",
            "Identifier les acteurs, les usages et les premiers repères de l'AI Act sans transformer l'acculturation en diagnostic juridique.",
            [
                "Partir de la tâche réellement réalisée et du résultat produit, pas seulement du nom commercial de l'outil.",
                "Décrire la finalité, les utilisateurs, les personnes concernées et l'action menée après le résultat.",
                "Identifier le rôle possible de l'organisation et le fournisseur, puis marquer les informations non vérifiées.",
                "Noter les données utilisées, la supervision humaine et la documentation disponible.",
                "Choisir une prochaine vérification et un responsable, sans déclarer l'usage conforme.",
            ],
            (
                "Assistant de rédaction interne",
                "Une équipe utilise un assistant pour préparer des réponses. L'inventaire précise que la réponse est relue avant envoi, que les données client sont interdites et que le contrat, les paramètres et les journaux restent à vérifier.",
                "green",
            ),
            [
                "une description précise d'un à trois usages ;",
                "la finalité, les acteurs, les données et la supervision ;",
                "les faits vérifiés, inconnues et sources disponibles ;",
                "une prochaine vérification avec un responsable.",
            ],
            "La cartographie décrit-elle ce qui se passe réellement, distingue-t-elle les inconnues et évite-t-elle toute conclusion juridique automatique ?",
        )
    )

    # 5 - Outil module 1
    story.extend(
        page_title(
            "Outil du module 1",
            "Fiche d'inventaire d'un usage",
            "Complétez une fiche par usage. Utilisez des fonctions génériques et indiquez « inconnu » lorsqu'une information n'est pas vérifiée.",
        )
    )
    story.extend(
        working_box(
            "Décrire l'usage",
            [
                ("Tâche et finalité", "Tâche précise, résultat attendu et raison de l'usage"),
                ("Utilisateurs", "Fonctions qui utilisent, paramètrent ou contrôlent l'outil"),
                ("Personnes concernées", "Public, salariés, clients, candidats ou aucune personne identifiée"),
                ("Données", "Catégories utilisées, source, sensibilité et données interdites"),
                ("Résultat et action", "Production de l'IA puis action ou décision réellement menée"),
                ("Supervision", "Personne qui relit, peut modifier, refuser ou arrêter"),
            ],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(
        content_table(
            ["À vérifier", "État", "Source ou responsable"],
            [
                ["Rôle de l'organisation", "Vérifié / À confirmer", "Contrat, documentation, fonction"],
                ["Finalité prévue", "Vérifiée / À confirmer", "Instructions du fournisseur"],
                ["Paramètres et accès", "Vérifiés / À confirmer", "Administrateur ou sécurité"],
                ["Traçabilité disponible", "Vérifiée / À confirmer", "Journal, historique ou procédure"],
            ],
            [58 * mm, 44 * mm, 69 * mm],
        )
    )
    story.append(callout("Trace utile", "Conservez la date de la fiche, la fonction du rédacteur et les sources consultées. Évitez les noms de personnes et les copies de données opérationnelles.", "gray"))
    story.append(PageBreak())

    # 6 - Module 2
    story.extend(
        module_overview(
            2,
            "Identifier les usages et les niveaux de vigilance",
            "Repérer les situations qui imposent un arrêt, une analyse spécialisée, une information des personnes ou des contrôles renforcés.",
            [
                "Reprendre un usage cartographié et séparer les faits des informations manquantes.",
                "Examiner la finalité, les personnes concernées, les données, l'effet du résultat et la supervision humaine.",
                "Rechercher des signaux de pratique interdite, de haut risque ou d'obligation de transparence sans conclure sur un simple mot-clé.",
                "Décrire les conséquences possibles pour la santé, la sécurité ou les droits fondamentaux.",
                "Choisir la prochaine action : suspendre, documenter, informer ou demander une analyse spécialisée.",
            ],
            (
                "Classement de candidatures",
                "Le fait que le résultat influence l'accès à l'emploi impose une vigilance élevée. L'équipe suspend toute conclusion, décrit le processus complet et transmet la finalité, la documentation, les données et la supervision aux fonctions compétentes.",
                "red",
            ),
            [
                "les faits, les inconnues et les signaux de vigilance ;",
                "les effets possibles sur les personnes ;",
                "la prochaine vérification et la fonction compétente ;",
                "une décision provisoire et révisable, sans verdict de conformité.",
            ],
            "Chaque signal est-il relié à un fait précis, et la prochaine action protège-t-elle les personnes pendant que les informations manquantes sont recherchées ?",
        )
    )

    # 7 - Outil module 2
    story.extend(
        page_title(
            "Outil du module 2",
            "Premier tri des vigilances",
            "Ce tableau sert à orienter l'analyse. Il ne remplace pas une qualification juridique, technique ou relative aux données.",
        )
    )
    story.append(
        content_table(
            ["Question", "Fait ou inconnu", "Signal", "Prochaine action"],
            [
                ["Quelle finalité exacte ?", "", "Finalité sensible ou écart d'usage", "Obtenir les instructions et le processus"],
                ["Qui subit l'effet ?", "", "Emploi, accès à un service, santé, sécurité ou droits", "Décrire l'effet et protéger la personne"],
                ["Quelles données ?", "", "Données personnelles, sensibles ou non autorisées", "Limiter, suspendre et consulter les fonctions compétentes"],
                ["Quelle influence ?", "", "Classement, recommandation ou décision", "Tracer la place du résultat dans la décision"],
                ["Quelle supervision ?", "", "Contrôle tardif, formel ou impossible", "Prévoir refus, arrêt, compétence et temps réel"],
                ["Quelle transparence ?", "", "Interaction ou contenu pouvant tromper", "Vérifier l'information ou le marquage requis"],
            ],
            [45 * mm, 37 * mm, 46 * mm, 43 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(p("Décision provisoire", "h2"))
    story.extend(
        bullets(
            [
                "<b>Poursuivre sous contrôle</b> lorsque les limites et validations sont définies.",
                "<b>Compléter l'analyse</b> lorsqu'une information essentielle manque.",
                "<b>Suspendre</b> lorsque l'effet peut être important ou qu'un usage non autorisé est plausible.",
                "<b>Transmettre</b> aux fonctions juridique, données, sécurité, métier ou achats selon le sujet.",
            ]
        )
    )
    story.append(callout("Formulation attendue", "« Avec les informations disponibles, nous observons ces signaux. Nous ne pouvons pas conclure. La prochaine vérification est... et la décision provisoire est... »", "green"))
    story.append(PageBreak())

    # 8 - Module 3
    story.extend(
        module_overview(
            3,
            "Organiser l'acculturation des équipes",
            "Construire des actions de maîtrise de l'IA adaptées aux fonctions, aux usages et aux risques, puis conserver des preuves proportionnées.",
            [
                "Regrouper les participants par fonction et par exposition aux usages, sans créer de score individuel.",
                "Définir ce que chaque groupe doit savoir expliquer, repérer, appliquer et transmettre.",
                "Choisir une action réaliste : briefing, atelier, fiche, démonstration, exercice ou rappel intégré au travail.",
                "Prévoir une vérification observable : cas fictif, question, démonstration ou production courte.",
                "Conserver une preuve minimale de l'action et organiser une revue après un changement d'outil, d'usage ou de règle.",
            ],
            (
                "Équipe de communication",
                "Un atelier de 45 minutes porte sur les outils autorisés, les données interdites, la vérification des faits, le marquage des contenus et l'escalade. Un mini-cas vérifie que les participants savent arrêter une publication incertaine.",
                "green",
            ),
            [
                "les fonctions concernées et les usages associés ;",
                "des objectifs observables et des actions adaptées ;",
                "une modalité de vérification par groupe ;",
                "des preuves minimisées, une échéance et une règle de révision.",
            ],
            "Le plan dépend-il des connaissances, de l'expérience, du contexte d'usage et des personnes concernées, comme le demande l'article 4 actuellement applicable ?",
        )
    )

    # 9 - Outil module 3
    story.extend(
        page_title(
            "Outil du module 3",
            "Fiche d'action de maîtrise de l'IA",
            "Préparez une action par groupe de fonctions. La Commission recommande une démarche adaptée au rôle, au risque, au niveau et au contexte.",
        )
    )
    story.extend(
        working_box(
            "Cadrer l'action",
            [
                ("Fonctions", "Catégorie de fonctions, sans liste nominative dans ce support"),
                ("Usage et contexte", "Système, tâche, fréquence, personnes concernées et risques"),
                ("Niveau de départ", "Connaissances et expérience observées collectivement"),
                ("Objectifs", "Actions observables : expliquer, repérer, contrôler, arrêter, transmettre"),
                ("Modalité", "Briefing, atelier, fiche, exercice, accompagnement ou combinaison"),
                ("Vérification", "Cas fictif, question, production ou démonstration"),
                ("Échéance et revue", "Date, pilote et événements déclenchant une mise à jour"),
            ],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(
        content_table(
            ["Preuve proportionnée", "À conserver", "À éviter"],
            [
                ["Action réalisée", "Intitulé, date, durée, public et intervenant", "Enregistrer plus de données que nécessaire"],
                ["Contenu", "Support daté et objectifs", "Captures contenant des données opérationnelles"],
                ["Participation", "Preuve prévue par l'organisation", "Publier une liste nominative sans besoin"],
                ["Vérification", "Critère et résultat utile", "Profilage ou classement individuel non nécessaire"],
            ],
            [45 * mm, 65 * mm, 61 * mm],
        )
    )
    story.append(callout("Pas de certificat imposé par l'article 4", "La FAQ de la Commission indique qu'un certificat spécifique n'est pas requis pour documenter les actions de maîtrise de l'IA. Un registre interne de formations et d'initiatives peut être conservé.", "gray"))
    story.append(PageBreak())

    # 10 - Module 4
    story.extend(
        module_overview(
            4,
            "Préparer un plan d'action réaliste",
            "Transformer l'inventaire des usages, les vigilances et le plan d'acculturation en actions prioritaires, attribuées et vérifiables.",
            [
                "Regrouper les actions issues des trois premiers modules et supprimer les doublons.",
                "Prioriser selon l'effet possible, l'urgence, les inconnues et les échéances applicables.",
                "Attribuer un pilote et les validations nécessaires sans inventer un nouveau rôle obligatoire.",
                "Associer à chaque action un livrable, une date, une preuve minimale et une condition d'arrêt.",
                "Planifier les revues et la mise à jour des sources officielles.",
            ],
            (
                "PME utilisant un assistant de rédaction",
                "Sous 30 jours, la PME confirme les outils et règles d'usage. Sous 60 jours, elle forme les fonctions concernées et teste les contrôles. Sous 90 jours, elle revoit l'inventaire, les incidents, les preuves et les décisions avec les fonctions compétentes.",
                "green",
            ),
            [
                "des actions à 30, 60 et 90 jours ;",
                "un pilote, des validations et des ressources ;",
                "un livrable, une preuve et une échéance par action ;",
                "une condition d'arrêt et une date de revue.",
            ],
            "Les premières actions réduisent-elles les effets les plus importants et les inconnues critiques, avec un responsable et une preuve réalistes ?",
        )
    )

    # 11 - Outil module 4
    story.extend(
        page_title(
            "Outil du module 4",
            "Feuille de route 30-60-90 jours",
            "Limitez le nombre d'actions. Une feuille de route courte, attribuée et revue vaut mieux qu'une liste exhaustive sans responsable.",
        )
    )
    story.append(
        content_table(
            ["Horizon", "Action et résultat attendu", "Pilotage", "Preuve et revue"],
            [
                ["30 jours", "Inventorier, suspendre les cas critiques, obtenir les documents manquants", "Pilote et validations", "Inventaire daté, décisions, sources"],
                ["60 jours", "Définir les règles, former les fonctions, tester supervision et escalade", "Pilote et ressources", "Support, test, procédure, retour"],
                ["90 jours", "Revoir les usages, incidents, contrôles, contrats et priorités", "Revue pluridisciplinaire", "Compte rendu minimisé et décisions"],
            ],
            [27 * mm, 67 * mm, 37 * mm, 40 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(p("Pour chaque action", "h2"))
    story.extend(
        working_box(
            "Fiche de pilotage",
            [
                ("Problème traité", "Fait, inconnu ou effet à réduire"),
                ("Action", "Verbe précis et résultat attendu"),
                ("Pilote / validations", "Fonction pilote et fonctions qui confirment"),
                ("Échéance / ressources", "Date réaliste, temps, budget ou outil utile"),
                ("Preuve minimale", "Trace datée, source, livrable ou décision"),
                ("Arrêt / revue", "Condition de suspension et date de réexamen"),
            ],
            label_width=44 * mm,
        )
    )
    story.append(PageBreak())

    # 12 - Cas final
    story.extend(
        page_title(
            "Évaluation finale - 45 min",
            "Analyser un usage et présenter une feuille de route",
            "Le cas final consolide les quatre exercices. Le formateur évalue la méthode, pas une expertise juridique.",
        )
    )
    story.append(
        content_table(
            ["Livrable", "Contenu attendu", "Contrôle essentiel"],
            [
                ["1 - Usage", "Finalité, acteurs, personnes, données, résultat et supervision", "Faits et inconnues séparés"],
                ["2 - Vigilances", "Signaux, effets possibles, questions et décision provisoire", "Aucune qualification automatique"],
                ["3 - Acculturation", "Publics, objectifs, actions, vérification et preuves", "Adaptation au rôle et au contexte"],
                ["4 - Feuille de route", "Priorités, pilotes, validations, dates, preuves et revues", "Actions limitées et réalisables"],
            ],
            [34 * mm, 84 * mm, 53 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(p("Méthode en six temps", "h2"))
    story.extend(
        numbered(
            [
                "Choisir un cas fictif ou entièrement générique.",
                "Décrire le processus complet avant d'examiner les risques.",
                "Séparer les faits, les inconnues et les hypothèses.",
                "Relier chaque vigilance à un fait ou à une information manquante.",
                "Proposer des actions, responsables, preuves et revues proportionnés.",
                "Relire les quatre critères avant la remise dans l'espace apprenant.",
            ]
        )
    )
    story.append(callout("Règle de validation", "Les quatre critères doivent atteindre au minimum le niveau « Acquis ». Si un critère reste insuffisant, le formateur indique les éléments à reprendre avant une nouvelle remise.", "green"))
    story.append(PageBreak())

    # 13 - Preuves et RGPD
    story.extend(
        page_title(
            "Suivi pédagogique et organisationnel",
            "Conserver des preuves utiles et minimisées",
            "Une preuve doit permettre de comprendre ce qui a été fait, pourquoi et quand, sans recopier inutilement des données personnelles ou confidentielles.",
        )
    )
    story.append(
        content_table(
            ["Objet", "Trace utile", "Protection à appliquer"],
            [
                ["Inventaire", "Usage, date, source, pilote, statut", "Fonctions génériques et accès limité"],
                ["Analyse", "Faits, inconnues, questions, décision provisoire", "Pas de dossier réel dans un service public d'IA"],
                ["Acculturation", "Objectifs, support, date, public et vérification", "Minimiser les listes et résultats individuels"],
                ["Décision", "Fonctions présentes, sources, arbitrage et date de revue", "Limiter la diffusion aux personnes habilitées"],
                ["Incident", "Nature, impact, action, escalade et suivi", "Suivre la procédure interne et les obligations applicables"],
            ],
            [38 * mm, 69 * mm, 64 * mm],
        )
    )
    story.append(p("Questions avant de conserver", "h2"))
    story.extend(
        bullets(
            [
                "Cette information est-elle nécessaire pour démontrer l'action ou la décision ?",
                "La même preuve peut-elle être obtenue avec moins de données ou une fonction générique ?",
                "Qui peut consulter la trace, pendant combien de temps et selon quelle règle interne ?",
                "La source, la date et la version du document sont-elles visibles ?",
                "Une révision est-elle prévue après un changement d'usage, d'outil, d'incident ou de règle ?",
            ]
        )
    )
    story.append(callout("Espace apprenant", "Les brouillons, remises, versions, corrections et validations enregistrés dans l'espace apprenant constituent les preuves pédagogiques du parcours. Les supports imprimés les complètent sans les remplacer.", "gray"))
    story.append(PageBreak())

    # 14 - Calendrier
    story.extend(
        page_title(
            "Repères réglementaires datés",
            "Un calendrier à vérifier avant toute décision",
            "Situation consultée le 18 juillet 2026. Les textes, lignes directrices, standards et dates d'application peuvent évoluer.",
        )
    )
    story.append(
        content_table(
            ["Date", "Repère officiel", "Conséquence pratique"],
            [
                ["1 août 2024", "Entrée en vigueur du règlement (UE) 2024/1689", "Commencer l'inventaire et identifier les rôles"],
                ["2 février 2025", "Application des définitions, pratiques interdites et maîtrise de l'IA", "Agir sur les usages et l'acculturation"],
                ["2 août 2025", "Règles de gouvernance et obligations relatives aux modèles d'IA à usage général", "Vérifier le rôle et les documents du fournisseur"],
                ["2 août 2026", "Date générale d'application prévue par le règlement, avec exceptions", "Recontrôler les obligations applicables à chaque usage"],
                ["Calendrier en évolution", "Un accord politique de mai 2026 modifie certaines échéances relatives aux systèmes à haut risque", "Vérifier le texte final adopté avant de retenir une date"],
            ],
            [32 * mm, 83 * mm, 56 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(callout("Article 4 : point de vigilance", "L'obligation de maîtrise de l'IA figure dans le règlement actuellement applicable. La Commission indique aussi qu'une modification a été proposée dans le cadre du paquet de simplification. Ne fondez pas une décision sur ce guide : vérifiez le texte consolidé et les communications officielles à la date de l'analyse.", "amber"))
    story.append(p("Réflexe avant une échéance", "h2"))
    story.extend(numbered(["Ouvrir le texte consolidé sur EUR-Lex.", "Consulter le calendrier de la Commission.", "Identifier la disposition et l'exception utiles au cas.", "Dater la source et faire confirmer l'interprétation compétente."]))
    story.append(PageBreak())

    # 15 - Lexique essentiel
    story.extend(
        page_title(
            "Lexique essentiel",
            "Douze notions à savoir expliquer",
            "Le lexique complet de 34 notions et ses exemples professionnels restent disponibles dans l'espace apprenant.",
        )
    )
    glossary_rows = [
        ["AI Act", "Règlement européen encadrant certains acteurs, systèmes et usages selon leurs risques."],
        ["Système d'IA", "Système automatisé qui déduit comment produire des prédictions, contenus, recommandations ou décisions."],
        ["Fournisseur", "Acteur qui développe ou fait développer un système et le met sur le marché ou en service sous son nom."],
        ["Déployeur", "Acteur qui utilise un système d'IA sous son autorité dans un contexte professionnel."],
        ["Finalité prévue", "Usage auquel le système est destiné selon les informations du fournisseur."],
        ["Pratique interdite", "Usage prohibé par l'article 5 lorsque ses conditions précises sont réunies."],
        ["Haut risque", "Catégorie soumise à des exigences renforcées selon le système, la finalité et les conditions du règlement."],
        ["Transparence", "Information permettant de comprendre l'interaction, l'origine d'un contenu ou les limites utiles."],
        ["Supervision humaine", "Capacité réelle d'une personne compétente à comprendre, contrôler, refuser ou arrêter."],
        ["Maîtrise de l'IA", "Connaissances et compétences adaptées au rôle, à l'usage, au contexte et aux personnes concernées."],
        ["Traçabilité", "Possibilité de retrouver les sources, versions, contrôles, décisions et responsables."],
        ["Preuve proportionnée", "Trace suffisante pour démontrer une action sans conserver plus de données que nécessaire."],
    ]
    story.append(content_table(["Notion", "Définition simplifiée"], glossary_rows, [46 * mm, 125 * mm]))
    story.append(callout("Pour aller plus loin", "Recherchez une notion dans l'onglet Lexique de l'espace apprenant : chaque définition est accompagnée d'un exemple professionnel.", "green"))
    story.append(PageBreak())

    # 16 - Checklist et sources
    story.extend(
        page_title(
            "Avant d'utiliser votre travail",
            "Checklist finale et sources officielles",
            "Cochez ces points avant une restitution, une décision ou la remise du cas final.",
        )
    )
    story.append(
        content_table(
            ["", "Je vérifie"],
            [
                ["☐", "L'usage, la finalité, les acteurs, les données et la supervision sont décrits."],
                ["☐", "Les faits, inconnues, hypothèses et sources sont séparés."],
                ["☐", "Aucune conclusion ne repose sur un simple mot-clé ou le nom d'un outil."],
                ["☐", "Les effets possibles sur les personnes sont pris en compte."],
                ["☐", "Les validations juridique, données, sécurité, métier ou achats sont identifiées si nécessaires."],
                ["☐", "Les actions de maîtrise de l'IA sont adaptées aux fonctions et aux usages."],
                ["☐", "Chaque priorité possède un pilote, une échéance, une preuve et une revue."],
                ["☐", "Les sources officielles sont datées et ont été revérifiées."],
                ["☐", "Les données personnelles et confidentielles ont été minimisées."],
                ["☐", "La décision reste révisable si le système, l'usage ou le cadre évolue."],
            ],
            [13 * mm, 158 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(p("Sources officielles consultées", "h2"))
    story.extend(
        [
            source_link("Règlement (UE) 2024/1689 - texte EUR-Lex", "https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=fr"),
            source_link("Commission européenne - présentation et calendrier de l'AI Act", "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai"),
            source_link("Commission européenne - questions et réponses sur la maîtrise de l'IA", "https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers"),
            source_link("Commission européenne - Navigating the AI Act", "https://digital-strategy.ec.europa.eu/en/faqs/navigating-ai-act"),
        ]
    )
    story.append(callout("Dernier repère", "Ce guide structure une première démarche. Pour une situation réelle à effet important, recherchez les informations manquantes, protégez les personnes et demandez les validations compétentes avant de poursuivre.", "red"))

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
        title="Guide pratique - IA Act",
        author="FormaPrompt - Thierry FREZARD",
        subject="Support pédagogique d'acculturation et de préparation à la conformité AI Act",
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
