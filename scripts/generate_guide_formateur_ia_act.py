from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import Image, Spacer

from generate_guide_ia_generative import (
    BORDER,
    CROPPED_LOGO,
    GREEN,
    GREEN_LINE,
    MUTED,
    NAVY,
    PAGE_HEIGHT,
    PAGE_WIDTH,
    WHITE,
    GuideDocTemplate,
    bullets,
    callout,
    content_table,
    p,
    prepare_logo,
)
from generate_guide_formateur_ia_generative import (
    ROOT,
    checklist,
    next_page,
    page,
    session_page,
    trainer_table,
)


OUTPUT = ROOT / "output" / "pdf" / "guide-formateur-ia-act-formaprompt.pdf"
PUBLIC_COPY = ROOT / "webapp" / "public" / "assets" / "guide-formateur-ia-act-formaprompt.pdf"


def cover_page(canvas, doc):
    canvas.saveState()
    canvas.setTitle("Guide formateur - IA Act")
    canvas.setAuthor("FormaPrompt - Thierry FREZARD")
    canvas.setSubject("Animation, evaluation et preuves de la formation IA Act")
    canvas.setKeywords("guide formateur, IA Act, maitrise de l'IA, evaluation, Qualiopi, FormaPrompt")
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
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, PAGE_HEIGHT - 12 * mm, "Guide formateur - IA Act")
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
        p("Guide formateur<br/>IA : acculturation et préparation à la conformité AI Act", "cover_title"),
        p("Cartographier, orienter, acculturer et planifier - 4 h 45", "cover_subtitle"),
        callout(
            "Trois organisations prêtes à animer",
            "45 min d'e-learning et 4 h guidées avec le formateur : une séance de 4 h, deux séances de 2 h ou quatre séances de 1 h. Les quatre modules, exercices et critères restent identiques.",
        ),
        Spacer(1, 4 * mm),
        p("Déroulés - démonstrations - corrections - adaptations - preuves", "cover_subtitle"),
    ])
    next_page(story)

    # 2 - Mode d'emploi
    page(
        story,
        "Cadre",
        "Comment utiliser ce guide",
        "Ce document complète l'espace apprenant et les supports imprimables. Il aide à conduire la formation sans transformer le minutage en scénario rigide.",
    )
    story.append(content_table(
        ["Repère", "Règle de conduite"],
        [
            ["Durée", "Le parcours comprend 45 min d'e-learning et 4 h guidées. Les pauses et aléas techniques s'ajoutent sans réduire le temps pédagogique prévu."],
            ["Progression", "Conserver l'ordre des quatre modules : cartographie, premier tri, acculturation, puis feuille de route. Chaque exercice est construit pendant son module."],
            ["Grand débutant", "Partir d'un seul usage fictif, distinguer les faits des inconnues, montrer le raisonnement, puis faire reformuler la prochaine vérification."],
            ["Positionnement", "Utiliser le questionnaire pour adapter les explications. Il ne constitue ni une évaluation des acquis, ni une validation de conformité."],
            ["Évaluation", "Évaluer la méthode, les limites et les validations identifiées. Une formulation juridique assurée mais non justifiée ne doit pas être valorisée."],
            ["Traçabilité", "Conserver des preuves proportionnées et minimisées. Ce guide ne remplace ni l'analyse du contexte, ni les avis spécialisés nécessaires."],
        ],
        [34 * mm, 137 * mm],
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(callout(
        "Limite à annoncer",
        "La formation prépare des repères et une première démarche. Elle ne fournit pas d'avis juridique, ne qualifie pas définitivement un système et ne garantit pas la conformité d'une organisation.",
        "red",
    ))
    story.append(p("Documents associés", "h2"))
    story.extend(bullets([
        "Guide pratique IA Act : explications, démonstrations, exemples et sources officielles.",
        "Cahier d'activités : préparation, réalisation, autoévaluation et retour formateur des quatre exercices.",
        "Modèle du cas final : quatre livrables, grille d'évaluation et préparation d'une reprise.",
        "Espace apprenant : versions officielles, commentaires, corrections, progression et attestations.",
    ]))
    next_page(story)

    # 3 - Préparation
    page(story, "Préparation", "Checklist avant la première séance", "Préparer le contexte, les cas et les preuves avant l'accueil de l'apprenant.")
    story.append(checklist([
        "Vérifier le format réservé, les dates, les horaires et le nombre de participants.",
        "Contrôler l'accessibilité du lieu ou de la classe virtuelle et les adaptations convenues.",
        "Vérifier l'accès de l'apprenant à l'espace apprenant sans demander son mot de passe.",
        "Consulter le positionnement et repérer les trois domaines : usages et rôles, vigilances et contrôles, acculturation et action.",
        "Préparer un usage fictif simple pouvant être suivi pendant les quatre modules.",
        "Préparer un second cas comportant un signal sensible, uniquement pour montrer quand suspendre et transmettre.",
        "Ouvrir le texte officiel, le calendrier de la Commission et les questions-réponses sur la maîtrise de l'IA.",
        "Noter la date de consultation des sources utilisées pendant la démonstration.",
        "Préparer le guide pratique, le cahier d'activités et le modèle du cas final.",
        "Préparer l'émargement, la solution de repli et une version imprimable des consignes.",
    ]))
    story.append(Spacer(1, 5 * mm))
    story.append(p("Ouverture recommandée", "h2"))
    story.extend(bullets([
        "Présenter le résultat : décrire un usage, orienter les vigilances, adapter l'acculturation et préparer des actions pilotables.",
        "Demander un usage professionnel générique ou proposer le cas fictif préparé.",
        "Rappeler qu'une information inconnue reste écrite comme telle et qu'aucune donnée confidentielle n'est nécessaire.",
        "Expliquer la différence entre brouillon, réponse terminée, validation et reprise dans l'espace apprenant.",
    ]))
    story.append(callout(
        "Données et confidentialité",
        "Aucun nom de salarié, candidat, client ou patient, aucune donnée de santé, aucun contrat, incident détaillé, identifiant ou document interne non autorisé ne doit être déposé dans un service public d'IA.",
        "amber",
    ))
    next_page(story)

    # 4 - Architecture
    page(story, "Architecture", "Matrice des quatre modules", "Chaque module produit une preuve observable et prépare directement un livrable du cas final.")
    story.append(trainer_table(
        ["Module", "Objectif observable", "Exercice / preuve", "Livrable final préparé"],
        [
            ["1. Cartographier", "Décrire la finalité, le résultat, les acteurs, les personnes, les données et la supervision.", "Cartographie de 1 à 3 usages, faits et inconnues séparés.", "Cartographie factuelle de l'usage et des acteurs."],
            ["2. Orienter", "Repérer des signaux de vigilance sans conclure juridiquement et choisir la prochaine vérification.", "Premier tri, questions, orientation et fonctions à consulter.", "Premier tri et points à confirmer."],
            ["3. Acculturer", "Adapter compétences, activités, arrêts et preuves aux fonctions et usages.", "Plan pour trois groupes de fonctions, daté et actualisable.", "Plan d'acculturation adapté."],
            ["4. Planifier", "Prioriser des actions à 30, 60 et 90 jours avec pilotage, livrables et revues.", "Feuille de route limitée, attribuée et sourcée.", "Feuille de route 30-60-90 jours."],
        ],
        [27 * mm, 51 * mm, 49 * mm, 44 * mm],
        7.0,
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Répartition des 4 h 45", "h2"))
    story.append(content_table(
        ["Bloc", "Durée", "Production"],
        [
            ["Positionnement et consignes dans l'espace apprenant", "Inclus dans l'accueil", "Besoins repérés et règles de travail comprises."],
            ["Modules 1 à 4 avec le formateur", "4 h", "Quatre exercices construits, enregistrés ou accompagnés d'une reprise précise."],
            ["Cas pratique final en e-learning", "45 min", "Quatre livrables consolidés, contrôlés et remis."],
        ],
        [64 * mm, 30 * mm, 77 * mm],
    ))
    story.append(callout("Règle commune", "Réduire le nombre d'exemples si nécessaire, mais conserver la pratique, la justification et le contrôle de chaque module."))
    next_page(story)

    # 5 - Format 1 x 4 h
    page(story, "Format 1 x 4 h", "Vue d'ensemble de la séance unique", "Ce format convient à un petit groupe lorsque les accès et le cas de travail sont prêts avant la séance.")
    story.append(content_table(
        ["Période", "Répartition", "Point de sortie"],
        [
            ["Première moitié", "Accueil : 15 min<br/>Module 1 : 45 min<br/>Module 2 : 60 min", "Cartographie prête ; premier tri et orientation prudente enregistrés."],
            ["Seconde moitié", "Module 3 : 60 min<br/>Module 4 : 60 min", "Plan d'acculturation et feuille de route enregistrés ; cas final expliqué."],
        ],
        [37 * mm, 57 * mm, 77 * mm],
    ))
    story.append(Spacer(1, 5 * mm))
    story.append(p("Conditions de réussite", "h2"))
    story.extend(bullets([
        "Prévoir une pause réelle en plus des 4 heures guidées.",
        "Utiliser le même cas fictif pendant les quatre modules pour limiter la charge cognitive.",
        "Faire enregistrer chaque exercice avant de passer au suivant.",
        "Annoncer clairement les 45 minutes de cas final à réaliser dans l'espace apprenant.",
    ]))
    story.append(callout("Fatigue cognitive", "Ne transformez pas la dernière heure en exposé. Le module 4 doit conserver un vrai temps de priorisation et de justification.", "amber"))
    next_page(story)

    # 6 - Déroulé 1 x 4 h
    session_page(
        story,
        "Séance unique",
        "4 heures : du premier usage à la feuille de route",
        "Objectif : construire les quatre exercices et préparer une remise finale autonome et contrôlable.",
        [
            ["0:00-0:15", "Accueil", "Présence, objectifs, positionnement, limites, confidentialité et choix du cas."],
            ["0:15-0:35", "M1 - repères", "Finalité, système, fournisseur, rôle possible, utilisateurs, personnes, données et supervision."],
            ["0:35-1:00", "M1 - exercice", "Cartographier le cas, corriger les suppositions et enregistrer faits, inconnues et sources."],
            ["1:00-1:25", "M2 - démonstration", "Repérer les effets, signaux et contrôles sans transformer un indice en qualification juridique."],
            ["1:25-2:00", "M2 - exercice", "Choisir une orientation prudente, formuler les questions et identifier les fonctions à consulter."],
            ["2:00-2:25", "M3 - méthode", "Relier trois groupes de fonctions à leurs usages, compétences, contrôles et règles d'arrêt."],
            ["2:25-3:00", "M3 - exercice", "Construire les actions et preuves minimales, puis prévoir l'actualisation."],
            ["3:00-3:25", "M4 - méthode", "Séparer faits, inconnues, urgences, validations et actions internes."],
            ["3:25-3:55", "M4 - exercice", "Prioriser à 30, 60 et 90 jours, attribuer, dater, sourcer et fixer les revues."],
            ["3:55-4:00", "Clôture", "Présenter le cas final, la correction, les reprises et la satisfaction distincte."],
        ],
        [
            "Présence et durée réellement suivie.",
            "Positionnement exploité et quatre exercices avec leurs versions utiles.",
            "Commentaires, reprises ou validations reliés à la dernière réponse terminée.",
            "Consigne de cas final et échéance communiquées.",
        ],
        "Si le groupe ralentit, utilisez un seul usage et trois groupes de fonctions déjà préparés. Ne supprimez ni l'orientation prudente du module 2, ni les validations du module 4.",
    )
    next_page(story)

    # 7 - Format 2 x 2 h
    page(story, "Format 2 x 2 h", "Vue d'ensemble du parcours fractionné", "Ce format crée une reprise naturelle entre le premier tri et l'organisation des mesures.")
    story.append(content_table(
        ["Séance", "Répartition", "Point de sortie"],
        [
            ["1 - 2 h", "Accueil : 15 min<br/>Module 1 : 45 min<br/>Module 2 : 60 min", "Usage cartographié, signaux distingués, orientation et questions enregistrées."],
            ["2 - 2 h", "Module 3 : 60 min<br/>Module 4 : 55 min<br/>Clôture : 5 min", "Acculturation adaptée et feuille de route préparées ; cas final cadré."],
        ],
        [31 * mm, 59 * mm, 81 * mm],
    ))
    story.append(Spacer(1, 5 * mm))
    story.append(p("Point de reprise obligatoire", "h2"))
    story.extend(bullets([
        "Usage retenu, finalité, résultat et action qu'il prépare.",
        "Faits confirmés, informations inconnues et sources déjà consultées.",
        "Orientation provisoire et fonctions à consulter.",
        "Trois groupes de fonctions à reprendre au module 3.",
    ]))
    story.append(callout("Travail interséance", "Ne demandez pas de recherche juridique autonome non prévue. L'apprenant peut relire ses réponses, mais les notions nouvelles restent accompagnées."))
    next_page(story)

    # 8 - Séance 1 sur 2
    session_page(
        story,
        "Séance 1 sur 2",
        "2 heures : cartographier et orienter",
        "Objectif : décrire un usage avec précision, repérer les vigilances et choisir la prochaine action sans dépasser les faits.",
        [
            ["0:00-0:15", "Accueil", "Présence, accès, objectifs, positionnement, données et choix du cas."],
            ["0:15-0:35", "M1 - explication", "Distinguer usage, système, rôles possibles, personnes, données, résultat et supervision."],
            ["0:35-1:00", "M1 - pratique", "Compléter la cartographie, retirer les suppositions et enregistrer l'exercice 1."],
            ["1:00-1:25", "M2 - démonstration", "Séparer faits, inconnues, effets, signaux, contrôles et expertise à consulter."],
            ["1:25-1:50", "M2 - pratique", "Choisir suspendre, analyser, préciser ou expérimenter sous contrôle, puis justifier."],
            ["1:50-2:00", "M2 - synthèse", "Enregistrer l'exercice 2 et noter le point de reprise."],
        ],
        [
            "Présence de la séance et positionnement exploité.",
            "Exercices 1 et 2, dernières versions et éventuelles reprises.",
            "Sources réellement consultées et dates, si utilisées.",
            "Point de reprise minimisé et compréhensible.",
        ],
        "Corrigez immédiatement toute conclusion juridique automatique. Demandez : quel fait la soutient, quelle information manque et qui peut valider ?",
    )
    next_page(story)

    # 9 - Séance 2 sur 2
    session_page(
        story,
        "Séance 2 sur 2",
        "2 heures : acculturer et planifier",
        "Objectif : adapter les mesures aux fonctions et transformer les constats en actions courtes, attribuées et révisables.",
        [
            ["0:00-0:10", "Réactivation", "Faire reformuler l'usage, l'orientation provisoire et une information inconnue."],
            ["0:10-0:30", "M3 - méthode", "Relier fonctions, usages, compétences, activités, règles d'arrêt et protections."],
            ["0:30-1:00", "M3 - pratique", "Construire le plan pour trois groupes, limiter les preuves et prévoir la mise à jour."],
            ["1:00-1:20", "M4 - démonstration", "Transformer les constats en actions 30-60-90 avec pilote, validations, livrable et source."],
            ["1:20-1:50", "M4 - pratique", "Limiter à huit actions, hiérarchiser et fixer une revue de 30 minutes."],
            ["1:50-1:55", "M4 - synthèse", "Enregistrer l'exercice 4 ou la reprise ciblée."],
            ["1:55-2:00", "Clôture", "Expliquer le cas final, les quatre critères, les reprises, attestations et satisfaction."],
        ],
        [
            "Présence finale et durée réellement suivie.",
            "Exercices 3 et 4 avec commentaires et versions utiles.",
            "Consigne et modèle du cas final transmis.",
            "Adaptation ou incident uniquement si nécessaire et avec information minimisée.",
        ],
        "Une feuille de route longue n'est pas une meilleure réponse. Faites supprimer les actions sans pilote, résultat, justification ou condition de revue.",
    )
    next_page(story)

    # 10 - Format 4 x 1 h
    page(story, "Format 4 x 1 h", "Un module et son exercice par séance", "Ce format facilite l'assimilation d'un grand débutant et respecte directement le principe exercice lié au module.")
    story.append(trainer_table(
        ["Séance", "Déroulé conseillé", "Trace de fin de séance"],
        [
            ["1. Cartographie", "10 min accueil, 20 min repères, 25 min exercice, 5 min synthèse.", "Usage décrit, inconnues et responsables de confirmation identifiés."],
            ["2. Premier tri", "10 min reprise, 20 min démonstration, 25 min exercice, 5 min synthèse.", "Signaux distingués, orientation prudente et questions tracées."],
            ["3. Acculturation", "10 min reprise, 20 min méthode, 25 min exercice, 5 min synthèse.", "Trois groupes, compétences, actions, arrêts et preuves adaptés."],
            ["4. Feuille de route", "10 min reprise, 20 min démonstration, 25 min exercice, 5 min clôture.", "Priorités à 30-60-90 jours et cas final expliqués."],
        ],
        [33 * mm, 72 * mm, 66 * mm],
        7.5,
    ))
    story.append(Spacer(1, 5 * mm))
    story.append(p("Continuité entre les séances", "h2"))
    story.extend(bullets([
        "Commencer chaque séance par la dernière trace validée ou le point précis à reprendre.",
        "Conserver le même cas sauf si un signal impose de suspendre l'analyse et d'utiliser le cas fictif de secours.",
        "Ne pas imposer de production supplémentaire entre les séances ; la pratique prévue reste accompagnée.",
        "Après la séance 4, rappeler que le cas final consolide les quatre exercices en 45 minutes d'e-learning.",
    ]))
    story.append(callout("Vigilance", "Une séance d'une heure ne permet pas un long tour d'actualité. Réservez les informations réglementaires aux repères nécessaires pour décider de la prochaine vérification.", "amber"))
    next_page(story)

    # 11 - Démonstrations
    page(story, "Animation", "Quatre démonstrations et réponses attendues", "Chaque démonstration utilise des faits fictifs courts. Faites prédire la prochaine décision avant de montrer la réponse.")
    story.append(trainer_table(
        ["Module", "Démonstration", "Réponse attendue / signe de compréhension"],
        [
            ["1", "Cartographier un assistant qui prépare des brouillons de réponses.", "L'apprenant distingue finalité, résultat, action, acteurs, données et validation ; il écrit inconnu au lieu d'inventer."],
            ["2", "Comparer un assistant de rédaction et un outil envisagé pour classer des candidatures.", "Il repère les conséquences différentes, suspend le second cas pour analyse spécialisée et ne qualifie pas juridiquement sans faits."],
            ["3", "Remplacer un webinaire identique pour tous par trois parcours proportionnés.", "Il adapte compétences, activités, contrôles et arrêts aux fonctions sans promettre qu'un certificat prouve la conformité."],
            ["4", "Transformer une liste vague en feuille de route à 30, 60 et 90 jours.", "Il traite d'abord les signaux forts, attribue les actions et relie chaque échéance à un livrable, une preuve et une source datée."],
        ],
        [20 * mm, 65 * mm, 86 * mm],
        7.2,
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Technique de démonstration", "h2"))
    story.extend(bullets([
        "Annoncer l'objectif et le critère observé avant d'ouvrir l'outil.",
        "Verbaliser ce qui est connu, ce qui manque et ce qui exige une validation compétente.",
        "Montrer une conclusion trop rapide, puis corriger la démarche sans effacer la première version.",
        "Ouvrir réellement la source officielle lorsque l'exemple dépend d'une règle ou d'une date.",
        "Terminer par une question de transfert vers le contexte de l'apprenant, sans demander de donnée réelle.",
    ]))
    story.append(callout("Réponse acceptable", "Une formulation différente du modèle est recevable si les faits, inconnues, protections, contrôles et limites sont explicites. Évaluez la compétence, pas la ressemblance avec l'exemple."))
    next_page(story)

    # 12 - Correction des exercices
    page(story, "Exercices", "Réponses attendues et correction des quatre activités", "Corriger la dernière réponse terminée, citer une preuve et demander une reprise sur l'écart prioritaire.")
    story.append(trainer_table(
        ["Exercice", "Minimum attendu", "Retour formateur utile"],
        [
            ["1. Cartographie", "Finalité, résultat, action, acteurs, personnes, catégories de données, supervision, inconnues et sources à consulter.", "Citer un fait bien distingué et une supposition à retirer ou confirmer."],
            ["2. Premier tri", "Faits, inconnues, effets, signaux, protections, questions, fonctions à consulter et orientation prudente.", "Nommer le signal à vérifier et la prochaine action proportionnée."],
            ["3. Acculturation", "Trois groupes de fonctions, compétences, activités, règles d'arrêt, preuves minimales et déclencheurs de mise à jour.", "Montrer en quoi une action doit être mieux adaptée à un usage ou une responsabilité."],
            ["4. Feuille de route", "Actions limitées, priorisées, attribuées, datées, reliées à un livrable, une preuve, une source et une revue.", "Identifier l'action non pilotable et l'élément concret qui la rendrait vérifiable."],
        ],
        [34 * mm, 79 * mm, 58 * mm],
        7.1,
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Règle de correction", "h2"))
    story.extend(bullets([
        "Valider lorsque les quatre critères de l'exercice sont observables dans la réponse.",
        "En cas de reprise, nommer le critère concerné, la preuve attendue et l'échéance convenue.",
        "Ne pas corriger à la place de l'apprenant et ne pas remplacer un fait manquant par une hypothèse.",
        "Conserver les versions et commentaires dans l'espace apprenant ; une nouvelle version ne doit pas effacer l'ancienne.",
    ]))
    story.append(callout("Exemple de retour", "La finalité et les acteurs sont clairement décrits. La supervision reste à préciser : indiquez qui relit le résultat, à quel moment et avec quel pouvoir de correction avant de remettre une nouvelle version.", "green"))
    next_page(story)

    # 13 - Cas final
    page(story, "Évaluation finale", "Corriger le cas pratique de 45 minutes", "Le cas final consolide les quatre exercices. Il n'évalue ni la mémorisation d'articles, ni la capacité à produire un avis juridique.")
    story.append(content_table(
        ["Critère", "Niveau Acquis attendu"],
        [
            ["Cartographie de l'usage et des acteurs", "Finalité, résultat, acteurs, personnes, catégories de données et supervision décrits avec des faits vérifiables."],
            ["Premier tri et orientation", "Signaux, informations manquantes et effets distingués ; suite prudente et validations nécessaires justifiées."],
            ["Acculturation, contrôles et protection", "Compétences, activités, contrôles, arrêts, protections et preuves adaptés aux fonctions et usages."],
            ["Feuille de route, responsabilités et limites", "Actions 30-60-90 limitées, justifiées, attribuées et reliées à des livrables, échéances, sources, preuves et revues."],
        ],
        [66 * mm, 105 * mm],
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Règle de décision", "h2"))
    story.extend(bullets([
        "Le cas final est validé lorsque les quatre critères atteignent au minimum le niveau Acquis.",
        "Le niveau Maîtrisé valorise une autonomie supplémentaire et n'est pas obligatoire.",
        "Un critère Non acquis ou En cours d'acquisition entraîne une reprise ciblée.",
        "L'appréciation et les axes de progrès doivent correspondre aux observations de la dernière remise.",
        "La satisfaction reste distincte de l'évaluation des acquis et de la présence.",
    ]))
    story.append(p("Avant de valider", "h2"))
    story.append(checklist([
        "Je corrige la dernière remise et j'identifie sa version.",
        "Les quatre livrables correspondent au même usage et restent cohérents.",
        "Aucune promesse de conformité ou qualification non justifiée n'est acceptée comme preuve.",
        "Les quatre niveaux sont renseignés à partir d'éléments observables.",
        "L'appréciation et les axes de progrès sont présents.",
    ]))
    next_page(story)

    # 14 - Accompagnement et accessibilité
    page(story, "Accompagnement", "Relances et adaptations pour un grand débutant", "Une relance utile aide à distinguer, décider et vérifier sans donner immédiatement la réponse.")
    story.append(content_table(
        ["Situation observée", "Relance possible", "Adaptation sans changer l'objectif"],
        [
            ["Le cas reste trop général.", "Quel résultat l'outil produit-il et quelle action vient ensuite ?", "Fournir un cas fictif à trous ou accepter une description orale."],
            ["L'apprenant invente un rôle.", "Quel document ou quelle personne permettrait de le confirmer ?", "Proposer une liste d'acteurs possibles et demander de conserver inconnu."],
            ["Tout risque devient haut risque.", "Quel effet précis observez-vous et quelle information manque ?", "Comparer deux cas contrastés et faire séparer signal et qualification."],
            ["Le plan est identique pour tous.", "Quelles responsabilités ou décisions diffèrent entre ces fonctions ?", "Réduire à deux groupes, puis ajouter le troisième lorsque la logique est comprise."],
            ["La feuille de route est trop longue.", "Quelles trois actions évitent le dommage le plus important ou lèvent une inconnue ?", "Fournir huit lignes maximum et faire prioriser oralement."],
            ["Lecture ou navigation difficile.", "Quel format vous aide à suivre et à répondre ?", "Zoom, contraste, support imprimé, clavier, reformulation orale ou temps supplémentaire convenu."],
        ],
        [45 * mm, 60 * mm, 66 * mm],
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Règles d'accompagnement", "h2"))
    story.extend(bullets([
        "Fractionner la tâche tout en conservant le même résultat observable et les mêmes critères.",
        "Ne pas confondre vitesse de lecture, aisance juridique et compréhension de la méthode.",
        "Permettre une réponse orale ou un support agrandi lorsque cela répond au besoin convenu.",
        "Tracer uniquement le besoin pédagogique, l'adaptation retenue et son effet, sans détail médical inutile.",
    ]))
    story.append(callout("Alerte", "Si l'objectif reste inaccessible malgré les adaptations raisonnables disponibles, expliquer la limite, convenir de la suite et tracer la décision avec la personne concernée.", "amber"))
    next_page(story)

    # 15 - Preuves et incidents
    page(story, "Suivi", "Preuves pédagogiques et conduite après chaque séance", "Conserver ce qui démontre la mise en oeuvre réelle sans constituer un dossier excessif sur l'apprenant.")
    story.append(trainer_table(
        ["Moment", "À conserver", "À éviter"],
        [
            ["Avant le parcours", "Positionnement, besoin identifié, modalité et adaptation convenue si nécessaire.", "Données personnelles sans utilité pédagogique ou diagnostic médical."],
            ["À chaque séance", "Date, horaires réels, présence, module traité, exercice, statut et retour formateur.", "Temps reconstitué, validation automatique ou capture d'écran non expliquée."],
            ["Après une reprise", "Version concernée, critère insuffisant, élément attendu, nouvelle réponse et décision.", "Écraser l'ancienne version ou remplacer le travail de l'apprenant."],
            ["Fin de parcours", "Quatre exercices, cas final, grille, appréciation, axes de progrès, satisfaction séparée et attestations si délivrables.", "Confondre satisfaction, présence, progression et acquisition."],
            ["Mise à jour", "Version des supports, sources officielles consultées, date et décision de modification.", "Présenter un support ancien comme preuve que l'information reste actuelle."],
        ],
        [34 * mm, 80 * mm, 57 * mm],
        7.3,
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Conduite en cas d'aléa", "h2"))
    story.extend(bullets([
        "Panne : utiliser le cahier et les réponses préparées, tracer l'impact et reprogrammer uniquement le temps réellement perdu.",
        "Retard ou absence : conserver la durée réelle, préciser les éléments manqués et convenir d'une suite sans valider automatiquement la présence.",
        "Donnée confidentielle exposée : arrêter le partage, limiter la diffusion et suivre la procédure de l'organisme sans recopier la donnée.",
        "Source inaccessible : écrire non vérifié, utiliser la source officielle de secours ou reporter la conclusion.",
    ]))
    story.append(callout("Repère Qualiopi", "Ces exemples de preuves sont à adapter à la prestation. Ils ne constituent ni une liste exhaustive, ni une garantie d'audit : la preuve doit montrer la mise en oeuvre réelle et rester proportionnée.", "amber"))
    next_page(story)

    # 16 - Maintenance et clôture
    page(story, "Clôture", "Sources, actualisation et contrôle final", "Le cadre évolue. Le formateur doit pouvoir montrer quelles sources ont été utilisées et quand elles ont été consultées.")
    story.append(content_table(
        ["Source de référence", "Usage pédagogique"],
        [
            ["Règlement (UE) 2024/1689 sur EUR-Lex", "Vérifier le texte officiel et éviter les citations reconstruites de mémoire."],
            ["Cadre réglementaire de l'IA de la Commission européenne", "Vérifier le calendrier, les étapes d'application et les ressources publiées."],
            ["Questions-réponses de la Commission sur la maîtrise de l'IA", "Préparer le module 3 sans inventer de certificat obligatoire ou de mesure unique."],
            ["Documentation du système étudié", "Confirmer la finalité, les fonctionnalités, les conditions et les informations effectivement disponibles."],
        ],
        [72 * mm, 99 * mm],
    ))
    story.append(Spacer(1, 5 * mm))
    story.append(p("Revue recommandée", "h2"))
    story.extend(bullets([
        "Avant chaque session : ouvrir les liens officiels et dater la consultation utile.",
        "Après un changement de texte, de calendrier, d'outil ou de pratique : revoir les exemples et les consignes concernés.",
        "Après un retour apprenant ou un incident : corriger la formulation ambiguë et versionner le support.",
        "Ne jamais présenter la date d'un support comme une garantie que son contenu reste juridiquement à jour.",
    ]))
    story.append(p("Clôture formateur", "h2"))
    story.append(checklist([
        "Présences et durées réelles vérifiées.",
        "Positionnement exploité et adaptations utiles tracées.",
        "Quatre exercices suivis, avec reprises et versions conservées.",
        "Cas final corrigé sur les quatre critères.",
        "Satisfaction et évaluation des acquis distinguées.",
        "Attestations contrôlées uniquement à partir de preuves complètes.",
        "Sources et supports à actualiser identifiés.",
    ]))
    story.append(callout("Dernier repère", "Une bonne animation apprend à décrire, vérifier, transmettre et réviser. Elle ne transforme jamais un support, un quiz ou une attestation en promesse automatique de conformité.", "green"))

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
        title="Guide formateur - IA Act",
        author="FormaPrompt - Thierry FREZARD",
        subject="Animation, evaluation et suivi de la formation IA Act",
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
