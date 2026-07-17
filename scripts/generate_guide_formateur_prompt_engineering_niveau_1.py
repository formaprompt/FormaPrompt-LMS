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


OUTPUT = ROOT / "output" / "pdf" / "guide-formateur-prompt-engineering-niveau-1-formaprompt.pdf"
PUBLIC_COPY = ROOT / "webapp" / "public" / "assets" / "guide-formateur-prompt-engineering-niveau-1-formaprompt.pdf"


def cover_page(canvas, doc):
    canvas.saveState()
    canvas.setTitle("Guide formateur - Prompt Engineering - Niveau 1")
    canvas.setAuthor("FormaPrompt - Thierry FREZARD")
    canvas.setSubject("Déroulés pédagogiques, animation, évaluation et preuves de la formation Prompt Engineering - Niveau 1")
    canvas.setKeywords("guide formateur, prompt engineering, déroulé pédagogique, évaluation, Qualiopi, FormaPrompt")
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
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, PAGE_HEIGHT - 12 * mm, "Guide formateur - Prompt Engineering - Niveau 1")
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
        p("Guide formateur<br/>Prompt Engineering - Niveau 1", "cover_title"),
        p("Concevoir, tester et améliorer des prompts professionnels - 7 heures", "cover_subtitle"),
        callout(
            "Deux organisations prêtes à animer",
            "Présentiel en une journée de 4 h + 3 h, ou présentiel / classe virtuelle en 2 séances de 3 h 30. Les six modules, les exercices et les critères d'évaluation restent identiques.",
        ),
        Spacer(1, 4 * mm),
        p("Déroulés - démonstrations - relances - corrections - preuves", "cover_subtitle"),
    ])
    next_page(story)

    # 2 - Mode d'emploi
    page(
        story,
        "Cadre",
        "Comment utiliser ce guide",
        "Ce document complète l'espace apprenant et les supports imprimables. Il aide à conduire les 7 heures sans transformer le minutage en scénario rigide.",
    )
    story.append(content_table(
        ["Repère", "Règle de conduite"],
        [
            ["Durée", "Les 7 heures correspondent au temps pédagogique accompagné : 6 h 30 pour les six modules et 30 min pour le cas pratique final. Les pauses sont ajoutées sans réduire ce volume."],
            ["Progression", "Conserver l'ordre des six modules. Dans le format en deux séances, le module 3 se poursuit au début de la seconde séance avec un point de reprise explicite."],
            ["Grand débutant", "Montrer une seule décision à la fois, verbaliser le raisonnement, laisser reproduire, puis faire expliquer la méthode avec ses propres mots."],
            ["Exercices", "Construire l'exercice en même temps que le module. Préparer dans le cahier ou un brouillon, puis enregistrer la version officielle dans l'espace apprenant."],
            ["Évaluation", "Observer le cadrage, l'itération, les contrôles et l'explication des choix. Un texte fluide mais invérifiable ne suffit pas."],
            ["Traçabilité", "Conserver des preuves proportionnées et minimisées. Les exemples de ce guide ne remplacent pas les obligations définies pour chaque prestation."],
        ],
        [34 * mm, 137 * mm],
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(callout(
        "À ne pas faire",
        "Ne pas demander de transmettre une donnée personnelle, sensible ou confidentielle, un mot de passe, une signature ou un dossier client dans un outil d'IA. Ne jamais laisser un prompt déclencher seul un envoi, une publication ou une décision.",
        "red",
    ))
    story.append(p("Documents associés", "h2"))
    story.extend(bullets([
        "Guide pratique : apports, exemples, prompts complets, lexique et checklist.",
        "Cahier d'activités : préparation, réalisation, bilan et retour formateur des six exercices.",
        "Bibliothèque Notion : six modèles de prompts, variables et contrôles à conserver.",
        "Modèle du cas final : quatre livrables, décision d'usage et plan d'action individuel.",
    ]))
    next_page(story)

    # 3 - Préparation
    page(story, "Préparation", "Checklist avant la première séance", "Préparer le cadre, les démonstrations et les solutions de repli avant l'accueil du groupe.")
    story.append(checklist([
        "Vérifier la convention, le format choisi, les dates, les horaires et le nombre de participants.",
        "Contrôler l'accessibilité du lieu ou de la classe virtuelle et les adaptations convenues.",
        "Tester la connexion, le partage d'écran, le son et une solution de secours sans IA.",
        "Vérifier que chaque apprenant possède son accès à l'espace apprenant sans demander son mot de passe.",
        "Préparer des sources, messages, publics et cas fictifs sans donnée personnelle ou confidentielle.",
        "Ouvrir le guide pratique, le cahier, la bibliothèque de prompts et le modèle du cas final.",
        "Préparer pour chaque démonstration un résultat fragile et une version améliorée.",
        "Consulter les positionnements disponibles et repérer les besoins sans étiqueter les personnes.",
        "Prévoir une reformulation orale, un binôme, un support agrandi ou un temps supplémentaire si nécessaire.",
        "Préparer l'émargement et la procédure de validation de présence prévue pour chaque séance.",
    ]))
    story.append(Spacer(1, 5 * mm))
    story.append(p("Ouverture recommandée", "h2"))
    story.extend(bullets([
        "Présenter l'objectif : savoir cadrer, tester, corriger et contrôler un prompt, pas mémoriser une formule magique.",
        "Rappeler le droit à l'erreur dans les cas fictifs et l'interdiction d'utiliser des données réelles non autorisées.",
        "Expliquer la différence entre brouillon, réponse terminée et correction officielle dans l'espace apprenant.",
        "Demander un usage souhaité et une difficulté anticipée, sans collecter d'information inutile.",
    ]))
    story.append(callout(
        "Point d'attention",
        "Si une adaptation importante apparaît en séance, convenir d'une solution avec l'apprenant et tracer uniquement le besoin pédagogique, la solution et son effet. Ne pas inscrire de diagnostic médical.",
        "amber",
    ))
    next_page(story)

    # 4 - Matrice des modules
    page(story, "Architecture", "Matrice commune des six modules", "Chaque module produit une trace observable et prépare directement un élément du cas pratique final.")
    story.append(trainer_table(
        ["Module", "Objectif observable", "Exercice / preuve", "Lien avec le cas final"],
        [
            ["1. Cadrer", "Transformer une demande vague en consigne avec résultat, public, informations, format et critères.", "Demande initiale, prompt structuré et écart corrigé.", "Cadrer le besoin, le public et le résultat attendu."],
            ["2. Sourcer", "Produire une synthèse fidèle et signaler ce qui n'est pas présent dans la source.", "Source autorisée, synthèse et vérification des quatre catégories.", "Prouver la fidélité aux faits et les limites."],
            ["3. Adapter", "Adapter vocabulaire, exemples et niveau de détail sans perdre le message invariant.", "Deux versions comparées pour deux publics.", "Justifier les choix selon le destinataire."],
            ["4. Aligner", "Concevoir une ressource pédagogique reliant objectif, consigne, production, corrigé et critères.", "Ressource testée et problème de faisabilité corrigé.", "Démontrer l'alignement et la validation humaine."],
            ["5. Spécifier", "Préparer puis contrôler une page HTML simple, accessible et responsive.", "Cahier des charges, maquette ou code et tests manuels.", "Documenter les contraintes et les contrôles."],
            ["6. Organiser", "Décomposer une tâche en étapes avec entrées, résultats, critères, validations et arrêts.", "Workflow, test fictif, écart et correction ciblée.", "Présenter un modèle réutilisable et ses limites."],
        ],
        [26 * mm, 52 * mm, 49 * mm, 44 * mm],
        7.0,
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Répartition des 7 heures", "h2"))
    story.append(content_table(
        ["Bloc", "Durée", "Production"],
        [
            ["Modules 1 et 2", "2 h 30", "Prompt cadré et synthèse sourcée."],
            ["Modules 3 et 4", "2 h 30", "Deux adaptations et ressource pédagogique alignée."],
            ["Modules 5 et 6", "1 h 30", "Page spécifiée et workflow contrôlé."],
            ["Cas pratique final", "30 min", "Quatre livrables contrôlés et remis ou reprise planifiée."],
        ],
        [57 * mm, 25 * mm, 89 * mm],
    ))
    story.append(callout("Règle commune", "Réduire d'abord le nombre d'exemples, jamais le temps nécessaire à l'apprenant pour pratiquer, comparer et expliquer son contrôle."))
    next_page(story)

    # 5 - Présentiel aperçu
    page(story, "Présentiel - 1 journée", "Vue d'ensemble du rythme 4 h + 3 h", "Le matin traite les trois premiers modules. L'après-midi construit les usages plus complexes et se termine par le cas final.")
    story.append(content_table(
        ["Période", "Répartition", "Résultats attendus"],
        [
            ["Matin - 4 h", "Module 1 : 1 h 15<br/>Module 2 : 1 h 15<br/>Module 3 : 1 h 30", "Prompt professionnel structuré ; synthèse fidèle ; deux versions adaptées sans perte du message invariant."],
            ["Après-midi - 3 h", "Module 4 : 1 h<br/>Module 5 : 45 min<br/>Module 6 : 45 min<br/>Cas final : 30 min", "Ressource pédagogique alignée ; page HTML spécifiée ; workflow contrôlé ; quatre livrables remis ou reprise ciblée."],
        ],
        [34 * mm, 59 * mm, 78 * mm],
    ))
    story.append(Spacer(1, 5 * mm))
    story.append(p("Organisation matérielle", "h2"))
    story.extend(bullets([
        "Prévoir un poste ou un appareil par apprenant, une projection lisible et les sources fictives déjà ouvertes.",
        "Alterner démonstration, pratique individuelle, comparaison et verbalisation au moins toutes les 25 minutes.",
        "Ajouter une pause au cours du matin, une vraie pause déjeuner et une pause l'après-midi sans réduire les 7 heures accompagnées.",
        "Faire enregistrer chaque exercice avant de passer au module suivant afin d'éviter une accumulation en fin de journée.",
    ]))
    story.append(callout("Fatigue cognitive", "Une journée complète exige des consignes courtes et des changements de rythme. Ne gardez jamais le cas final pour une correction précipitée après l'horaire prévu.", "amber"))
    story.append(p("Point de contrôle avant déjeuner", "h2"))
    story.extend(bullets([
        "Les exercices 1 à 3 sont terminés ou accompagnés d'une reprise précise.",
        "Chaque apprenant sait quel travail des six modules il réutilisera pour le cas final.",
    ]))
    next_page(story)

    # 6 - Présentiel matin
    session_page(
        story,
        "Présentiel - matin",
        "4 heures : cadrer, sourcer et adapter",
        "Objectif : produire trois résultats contrôlables sans transmettre de donnée confidentielle.",
        [
            ["0:00-0:20", "Accueil et positionnement", "Cadre, présence, données, objectifs. Faire verbaliser une demande vague et une vigilance."],
            ["0:20-0:45", "M1 - explication", "Besoin, résultat, public, informations, contraintes, format et critères."],
            ["0:45-1:10", "M1 - démonstration", "Transformer une demande d'e-mail vague et faire prédire les informations manquantes."],
            ["1:10-1:15", "M1 - exercice", "Conserver demande initiale, prompt structuré, résultat et correction."],
            ["1:15-1:45", "M2 - méthode", "Délimiter une source et distinguer fait, décision, action et point à confirmer."],
            ["1:45-2:25", "M2 - pratique", "Créer la synthèse, retrouver chaque élément dans la source et corriger tout ajout."],
            ["2:25-2:30", "M2 - exercice", "Enregistrer la synthèse et la preuve de contrôle."],
            ["2:30-3:00", "M3 - méthode", "Définir message invariant, deux publics, vocabulaire, exemples et action attendue."],
            ["3:00-3:45", "M3 - pratique", "Produire deux versions, comparer fidélité, niveau de détail et action."],
            ["3:45-4:00", "M3 - exercice et reprise", "Finaliser l'exercice 3 et annoncer le cas retenu pour l'après-midi."],
        ],
        [
            "Présence du segment selon la procédure prévue.",
            "Positionnement initial ou note factuelle sur son exploitation.",
            "Dernières versions des exercices 1, 2 et 3 et leurs éventuelles reprises.",
            "Adaptation ou incident uniquement si nécessaire, sans donnée sensible superflue.",
        ],
        "Les pauses du matin sont ajoutées au planning. Si le groupe avance lentement, fournissez une source plus courte au module 2, mais conservez la vérification dans le document d'origine.",
    )
    next_page(story)

    # 7 - Présentiel après-midi
    session_page(
        story,
        "Présentiel - après-midi",
        "3 heures : aligner, spécifier, organiser et évaluer",
        "Objectif : produire une ressource, une spécification et un workflow contrôlés, puis finaliser le cas pratique.",
        [
            ["0:00-0:15", "M4 - réactivation", "Faire citer le cas retenu, un critère et un contrôle, puis cadrer la ressource à construire."],
            ["0:15-0:45", "M4 - ressource", "Construire une activité alignée, simuler le déroulé et corriger un problème de faisabilité."],
            ["0:45-1:00", "M4 - exercice", "Vérifier objectif, consigne, production, corrigé, critères et adaptation validée."],
            ["1:00-1:25", "M5 - cahier des charges", "Définir public, objectif, contenus, arborescence, mobile, clavier et données interdites."],
            ["1:25-1:45", "M5 - production et test", "Valider le plan avant le code, puis tester ordre, lisibilité et interactions."],
            ["1:45-2:10", "M6 - workflow", "Décomposer la tâche avec entrées, résultats, critères, validation et condition d'arrêt."],
            ["2:10-2:30", "M6 - test", "Tester un cas fictif, repérer un écart et corriger uniquement l'étape concernée."],
            ["2:30-3:00", "Cas final et clôture", "Contrôler les quatre livrables, remettre ou dater la reprise, expliquer correction et suite."],
        ],
        [
            "Présence et durée réellement suivie selon le dispositif.",
            "Exercices 4, 5 et 6, avec références des productions utiles.",
            "Remise du cas final ou reprise ciblée avec critère, preuve attendue et échéance.",
            "Évaluation, appréciation et axes de progrès enregistrés après correction ; satisfaction conservée séparément.",
        ],
        "Le cas final dispose de 30 minutes dans les 7 heures pour finaliser, contrôler et remettre les quatre livrables. La correction formateur peut être enregistrée après la séance si elle exige une vérification approfondie.",
    )
    next_page(story)

    # 8 - Deux séances aperçu
    page(story, "Deux séances de 3 h 30", "Vue d'ensemble du rythme fractionné", "Ce format laisse une reprise naturelle au milieu du module 3 et limite la fatigue en classe virtuelle.")
    story.append(content_table(
        ["Séance", "Répartition", "Point de sortie"],
        [
            ["1 - 3 h 30", "Module 1 : 1 h 15<br/>Module 2 : 1 h 15<br/>Module 3 : 1 h sur 1 h 30", "Demande cadrée ; synthèse vérifiée ; message invariant, publics et premières versions préparés."],
            ["2 - 3 h 30", "Fin module 3 : 30 min<br/>Module 4 : 1 h<br/>Module 5 : 45 min<br/>Module 6 : 45 min<br/>Cas final : 30 min", "Deux versions comparées ; ressource, page et workflow contrôlés ; remise finale ou reprise datée."],
        ],
        [31 * mm, 61 * mm, 79 * mm],
    ))
    story.append(Spacer(1, 5 * mm))
    story.append(p("Point de reprise obligatoire", "h2"))
    story.extend(bullets([
        "Sujet et trois informations invariantes à conserver.",
        "Description des deux publics et de l'action attendue pour chacun.",
        "Premières versions ou, à défaut, prompt prêt à tester au début de la séance 2.",
        "Difficulté précise sur laquelle l'apprenant souhaite un retour.",
    ]))
    story.append(p("Conditions de réussite", "h2"))
    story.extend(bullets([
        "Envoyer ou afficher le point de reprise sans demander de travail interséance obligatoire non prévu.",
        "Faire ouvrir le brouillon au début de la seconde séance avant tout nouvel apport.",
        "Prévoir une coupure pendant chaque demi-journée en plus du temps pédagogique accompagné.",
        "En classe virtuelle, vérifier régulièrement que l'apprenant manipule et ne suit pas seulement le partage d'écran.",
    ]))
    story.append(callout("Vigilance", "Si l'exercice 3 n'a pas été commencé, utilisez un cas fictif préparé pour retrouver le rythme sans sacrifier les contrôles des modules suivants.", "amber"))
    next_page(story)

    # 9 - Séance 1
    session_page(
        story,
        "Séance 1 sur 2",
        "3 h 30 : cadrer, sourcer et commencer l'adaptation",
        "Objectif : structurer un prompt, produire une synthèse fidèle et préparer deux adaptations contrôlables.",
        [
            ["0:00-0:20", "Accueil", "Présence, technique, positionnement, confidentialité et objectifs."],
            ["0:20-0:45", "M1 - méthode", "Faire définir résultat, public, informations, contraintes, format et critères."],
            ["0:45-1:10", "M1 - pratique", "Transformer la demande vague, tester et corriger un écart."],
            ["1:10-1:15", "M1 - exercice", "Enregistrer la version et l'autoévaluation."],
            ["1:15-1:45", "M2 - démonstration", "Synthétiser une source courte sans inventer l'information absente."],
            ["1:45-2:25", "M2 - pratique", "Retrouver fait, décision et action dans la source, puis corriger l'ajout."],
            ["2:25-2:30", "M2 - exercice", "Enregistrer synthèse, écart et correction."],
            ["2:30-3:00", "M3 - cadrage", "Choisir message invariant, deux publics et actions attendues."],
            ["3:00-3:25", "M3 - premier test", "Produire les deux versions et repérer une différence à contrôler."],
            ["3:25-3:30", "Clôture", "Noter le point de reprise et la question restante."],
        ],
        [
            "Présence de la séance.",
            "Positionnement exploité et exercices 1 et 2.",
            "Brouillon ou version partielle de l'exercice 3 avec point de reprise.",
            "Adaptation ou incident si nécessaire, avec information minimisée.",
        ],
        "Ne demandez pas à l'apprenant de terminer seul une notion non comprise entre les séances. La reprise doit permettre de repartir avec les mêmes informations et critères.",
    )
    next_page(story)

    # 10 - Séance 2
    session_page(
        story,
        "Séance 2 sur 2",
        "3 h 30 : finaliser, construire et évaluer",
        "Objectif : conclure l'adaptation, produire trois objets contrôlés et finaliser le cas pratique.",
        [
            ["0:00-0:10", "Réactivation", "Faire reformuler message invariant, publics, critère et écart observé."],
            ["0:10-0:30", "M3 - correction", "Comparer les deux versions, corriger l'écart et expliquer ce qui reste invariant."],
            ["0:30-1:15", "M4 - ressource", "Concevoir l'activité, simuler le déroulé et corriger une incohérence."],
            ["1:15-1:30", "M4 - exercice", "Valider objectif, consigne, production, corrigé et quatre critères."],
            ["1:30-2:00", "M5 - spécification", "Préparer le cahier des charges et faire valider l'arborescence avant le code."],
            ["2:00-2:15", "M5 - test", "Contrôler mobile, clavier, contenus inventés et accessibilité essentielle."],
            ["2:15-2:45", "M6 - workflow", "Définir les étapes, validations, conditions d'arrêt et prompts à variables."],
            ["2:45-3:00", "M6 - test", "Tester un cas fictif, conserver l'écart et la correction ciblée."],
            ["3:00-3:25", "Cas final", "Finaliser les quatre livrables et l'autoévaluation."],
            ["3:25-3:30", "Clôture", "Remettre ou dater la reprise ; expliquer correction, ressources et bilan à chaud."],
        ],
        [
            "Présence finale et durée réellement suivie.",
            "Exercices 3 à 6 et références des productions.",
            "Cas final remis ou reprise datée et ciblée.",
            "Évaluation et satisfaction conservées séparément.",
        ],
        "Si la remise finale est incomplète, n'accordez pas une validation générale. Nommez le critère insuffisant, la preuve attendue et l'échéance de reprise.",
    )
    next_page(story)

    # 11 - Démonstrations
    page(story, "Animation", "Six démonstrations et réponses attendues", "Chaque démonstration part d'un cas fictif court. Faites prédire la décision suivante avant de montrer votre choix.")
    story.append(trainer_table(
        ["Module", "Démonstration", "Réponse attendue / signe de compréhension"],
        [
            ["1", "Transformer « Fais-moi un bon mail » en consigne exploitable.", "L'apprenant nomme résultat, public, faits, contraintes, format et critères ; il demande une clarification au lieu d'inventer."],
            ["2", "Synthétiser une note contenant un fait, une décision, une action et une information absente.", "Il retrouve chaque élément dans la source, écrit « non précisé » pour l'absence et corrige tout ajout."],
            ["3", "Expliquer le même sujet à un débutant et à un professionnel.", "Il conserve les trois informations invariantes et adapte vocabulaire, exemples, détail et action attendue."],
            ["4", "Concevoir une activité de 30 minutes sur un cas maîtrisé.", "Il aligne objectif, étapes, production, corrigé et critères, puis soumet durée et adaptation à la validation humaine."],
            ["5", "Passer d'une idée de page à un cahier des charges, puis à une maquette ou un code simple.", "Il valide l'arborescence avant la production et contrôle mobile, clavier, libellés, contrastes et contenus autorisés."],
            ["6", "Décomposer une tâche récurrente en workflow de trois à cinq étapes.", "Chaque étape possède entrée, résultat, critères, validation et arrêt ; aucun envoi ni publication n'est automatique."],
        ],
        [20 * mm, 65 * mm, 86 * mm],
        7.1,
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Technique de démonstration", "h2"))
    story.extend(bullets([
        "Annoncer le résultat attendu et le critère observé avant de manipuler l'outil.",
        "Verbaliser les choix, les informations refusées et le moment où une validation humaine est nécessaire.",
        "Montrer une erreur utile, conserver la première version, puis réaliser une correction ciblée.",
        "Terminer par une question de transfert : « Que changeriez-vous pour votre situation ? »",
    ]))
    story.append(callout("Réponse acceptable", "Une formulation différente du modèle peut être correcte si le besoin, les critères, les contrôles et la décision d'usage sont explicites. Évaluez la compétence, pas la ressemblance avec votre prompt."))
    next_page(story)

    # 12 - Correction des exercices
    page(story, "Exercices", "Réponses attendues et correction des six activités", "Corriger la dernière réponse terminée, citer une preuve et demander une reprise uniquement sur l'écart prioritaire.")
    story.append(trainer_table(
        ["Exercice", "Minimum attendu", "Retour formateur utile"],
        [
            ["1. Consigne", "Demande initiale, prompt structuré, test, écart observable et amélioration justifiée.", "Nommer l'élément de cadrage réussi et celui qui manque encore."],
            ["2. Synthèse", "Source délimitée, quatre catégories, information absente signalée et ajout corrigé.", "Citer le fait retrouvé ou l'invention retirée."],
            ["3. Deux publics", "Message invariant, deux profils, deux versions et comparaison fidèle.", "Distinguer adaptation de forme et perte de sens."],
            ["4. Ressource", "Objectif observable, étapes, production, corrigé, critères et adaptation à confirmer.", "Signaler l'incohérence ou le problème de faisabilité corrigé."],
            ["5. Page HTML", "Cahier des charges validé avant production, tests mobile, clavier et contenus.", "Nommer le test réussi et le défaut encore présent."],
            ["6. Workflow", "Trois à cinq étapes, critères, validations, arrêts, test fictif et correction ciblée.", "Vérifier qu'aucune étape ne déclenche seule une action externe."],
        ],
        [34 * mm, 75 * mm, 62 * mm],
        7.2,
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Forme du retour", "h2"))
    story.extend(bullets([
        "Un point réussi relié à une preuve précise de la réponse.",
        "Une amélioration prioritaire formulée comme une action observable.",
        "Le statut validé ou reprise demandée, avec la version concernée.",
        "Une échéance seulement lorsqu'une reprise est nécessaire et convenue.",
    ]))
    story.append(callout("Exemple", "« Le message invariant est conservé dans les deux versions. Reprise ciblée : précisez maintenant l'action attendue pour le public professionnel et comparez-la à celle du public débutant. »", "green"))
    next_page(story)

    # 13 - Relances et adaptations
    page(story, "Accompagnement", "Relances et adaptations pour un grand débutant", "Une relance utile aide à raisonner sans fournir immédiatement le prompt final.")
    story.append(content_table(
        ["Situation observée", "Relance possible", "Adaptation sans changer l'objectif"],
        [
            ["« Je ne sais pas quoi écrire. »", "« Quel résultat exact doit recevoir quelle personne ? »", "Faire compléter une fiche à trous ou répondre oralement aux champs du cahier."],
            ["Le prompt devient très long.", "« Quelle information aide réellement à réussir le critère ? »", "Surligner objectif, faits, contraintes et format avec quatre couleurs."],
            ["Le premier résultat est accepté.", "« Quel critère prouve qu'il est prêt ? »", "Limiter d'abord la comparaison à un critère, puis en ajouter deux."],
            ["La source n'est pas contrôlée.", "« Où retrouvez-vous exactement cette information ? »", "Utiliser une source d'une demi-page avec un élément volontairement absent."],
            ["Le code impressionne ou bloque.", "« Que doit permettre la page avant de parler du code ? »", "Évaluer d'abord l'arborescence et la maquette ; utiliser un exemple de code préparé."],
            ["Le workflow paraît complexe.", "« Quelle est l'entrée et quel résultat doit être validé ? »", "Commencer par trois cartes papier : entrée, action, résultat, puis ajouter les contrôles."],
            ["Difficulté de lecture ou de navigation.", "« Quel format vous aide à suivre ? »", "Zoom, contraste, clavier, support imprimé, lecture structurée ou rythme ralenti selon le besoin convenu."],
        ],
        [43 * mm, 61 * mm, 67 * mm],
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Règles d'accompagnement", "h2"))
    story.extend(bullets([
        "Fractionner la tâche tout en conservant le même résultat observable et les mêmes critères.",
        "Faire expliquer le choix ; ne pas confondre vitesse de saisie et compréhension.",
        "Permettre l'erreur dans un exemple fictif, puis demander une correction visible.",
        "Tracer l'adaptation de façon factuelle, limitée et respectueuse, sans information médicale inutile.",
    ]))
    story.append(callout("Alerte", "Si l'objectif reste inaccessible malgré les adaptations raisonnables disponibles, expliquer la limite, convenir de la suite et tracer la décision avec la personne concernée.", "amber"))
    next_page(story)

    # 14 - Évaluation finale
    page(story, "Évaluation", "Corriger le cas pratique final", "La correction porte sur les quatre livrables et la version réellement remise dans l'espace apprenant.")
    story.append(content_table(
        ["Critère", "Niveau Acquis au minimum", "Reprise ciblée possible"],
        [
            ["Cadrage du besoin et du public", "Besoin, public, résultat, informations autorisées et contraintes utiles sont définis.", "Préciser le public, la source ou l'usage du résultat."],
            ["Prompt, critères et amélioration", "Le prompt est structuré, possède des critères observables et une correction ciblée justifiée.", "Montrer l'écart initial, la modification et son effet."],
            ["Contrôles et maîtrise des risques", "Le résultat est comparé aux critères et sources ; données, incertitudes et validation humaine sont traitées.", "Ouvrir la source, retirer la donnée ou motiver corriger / rejeter."],
            ["Explication des choix et réutilisation", "Écart, correction, décision, limites, variables et contrôle à conserver sont expliqués.", "Ajouter les variables, les cas exclus ou le prochain usage réaliste."],
        ],
        [48 * mm, 76 * mm, 47 * mm],
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Règle de décision", "h2"))
    story.extend(bullets([
        "Le cas final est validé lorsque les quatre critères atteignent au minimum « Acquis ».",
        "« Maîtrisé » valorise l'autonomie et le transfert ; ce niveau n'est pas obligatoire.",
        "Un critère insuffisant entraîne une reprise ciblée, même si la moyenne globale paraît satisfaisante.",
        "Enregistrer appréciation et axes de progrès dans l'administration sans modifier une ancienne évaluation.",
    ]))
    story.append(callout("Exemple de retour", "« Le prompt et le résultat sont cohérents. La décision d'usage reste à justifier : retrouvez les trois faits dans la source, indiquez la limite restante et précisez la validation humaine avant utilisation. »", "green"))
    story.append(p("Avant de valider", "h2"))
    story.append(checklist([
        "Je corrige la dernière remise et j'identifie sa version.",
        "Les quatre niveaux reposent sur des observations précises.",
        "L'appréciation et les axes de progrès sont présents.",
        "La décision calculée correspond aux quatre niveaux.",
    ]))
    next_page(story)

    # 15 - Preuves
    page(story, "Suivi", "Preuves pédagogiques et Qualiopi à conserver", "Conserver ce qui démontre la mise en oeuvre réelle, sans constituer un dossier excessif sur l'apprenant.")
    story.append(trainer_table(
        ["Moment", "À conserver", "À éviter"],
        [
            ["Avant la formation", "Convention, programme, besoins identifiés, positionnement et adaptations convenues.", "Collecter une information personnelle sans utilité pédagogique ou administrative."],
            ["Présence", "Séance, date, horaires réellement suivis et validations prévues par l'émargement.", "Reconstituer une durée non suivie ou utiliser une capture isolée comme seule preuve."],
            ["Progression", "Dernière version utile de chaque exercice, statut, retour et éventuelle reprise.", "Multiplier les copies locales contenant des réponses ou adresses e-mail."],
            ["Adaptation", "Besoin constaté, solution convenue et effet pédagogique, uniquement si nécessaire.", "Diagnostic, détail médical ou jugement personnel."],
            ["Évaluation", "Remise finale, grille, appréciation, axes de progrès et reprise éventuelle.", "Confondre satisfaction, assiduité et acquisition des compétences."],
            ["Fin de parcours", "Durée réelle, évaluation, satisfaction séparée et attestation réellement délivrée si les preuves sont complètes.", "Produire une attestation sur la seule base d'une inscription ou d'un paiement."],
        ],
        [36 * mm, 78 * mm, 57 * mm],
        7.2,
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Après chaque séance", "h2"))
    story.extend(bullets([
        "Valider la présence et la durée réellement suivie selon la procédure prévue.",
        "Vérifier les exercices terminés, enregistrer les retours et dater les reprises.",
        "Noter le point de reprise pour le format en deux séances.",
        "Tracer uniquement les adaptations et incidents ayant un effet sur la formation.",
        "Séparer les preuves d'acquisition, la satisfaction et les documents administratifs.",
    ]))
    story.append(callout("Repère Qualiopi", "Ces éléments sont des exemples de preuves FormaPrompt à adapter au contexte. Ils ne constituent pas une liste exhaustive ni une garantie d'audit ; la preuve doit montrer la mise en oeuvre réelle et rester proportionnée.", "amber"))
    next_page(story)

    # 16 - Aléas et clôture
    page(story, "Clôture", "Gérer les aléas et fermer le dossier formateur", "Une difficulté technique ou pédagogique doit être traitée sans inventer une présence, une production ou une validation.")
    story.append(content_table(
        ["Aléa", "Conduite attendue", "Trace minimale"],
        [
            ["Panne ou outil indisponible", "Passer aux réponses préparées, au cahier ou à la comparaison papier. Reprogrammer uniquement le temps pédagogique réellement perdu.", "Durée touchée, activité de repli et suite convenue."],
            ["Retard ou absence", "Tracer la durée réelle, préciser les éléments manqués et proposer une solution adaptée sans valider automatiquement.", "Horaires réels et action de rattrapage convenue."],
            ["Exercice incomplet", "Conserver le brouillon et formuler une reprise ciblée. Ne pas produire la réponse à la place de l'apprenant.", "Critère concerné, preuve attendue et échéance."],
            ["Donnée confidentielle exposée", "Arrêter le partage, limiter la diffusion et suivre la procédure de l'organisme. Ne pas recopier la donnée dans le suivi.", "Fait minimisé, mesure prise et responsable informé."],
            ["Action externe déclenchée", "Stopper le processus, vérifier les conséquences et rétablir une validation humaine avant toute reprise.", "Action, impact, mesure corrective et condition de reprise."],
        ],
        [41 * mm, 83 * mm, 47 * mm],
    ))
    story.append(Spacer(1, 5 * mm))
    story.append(p("Checklist de clôture", "h2"))
    story.append(checklist([
        "Présences et durées réellement suivies vérifiées.",
        "Six exercices et reprises suivis dans l'espace apprenant.",
        "Cas final évalué sur les quatre critères.",
        "Appréciation et axes de progrès enregistrés.",
        "Satisfaction et évaluation des acquis distinguées.",
        "Dossier d'attestation contrôlé uniquement à partir de preuves complètes.",
        "Copies locales inutiles et données temporaires traitées selon la durée de conservation prévue.",
    ]))
    story.append(callout("Dernier contrôle", "Le guide formateur est un document interne sans donnée personnelle. Les preuves officielles restent dans les outils prévus et ne doivent pas être ajoutées dans ce PDF."))

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
        title="Guide formateur - Prompt Engineering - Niveau 1",
        author="FormaPrompt - Thierry FREZARD",
        subject="Déroulés pédagogiques et suivi de la formation Prompt Engineering - Niveau 1",
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
