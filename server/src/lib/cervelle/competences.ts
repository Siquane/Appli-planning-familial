// Compétences officielles par chapitre (CM2 et 5e, année 2026-2027) : ce que
// l'élève doit savoir faire à la fin du chapitre. Rangées par id de chapitre de
// programme.ts, rattachées aux chapitres par withCompetences.
//
// Sources (docs/programmes/texte/) :
//   - français et maths CM2 : « Objectifs d'apprentissage » du cours moyen
//     deuxième année (BO n° 16 du 17 avril 2025) ;
//   - français et maths 5e : « Objectifs d'apprentissage » de la classe de
//     cinquième (BO n° 10 du 5 mars 2026) ;
//   - sciences et technologie CM2 : « Attendus de fin de cycle » et
//     « Connaissances et compétences attendues en fin de cours moyen » (BO n° 25
//     du 22 juin 2023) ;
//   - technologie 5e : « Repères de progressivité » de la 5e (BO n° 9 du 29
//     février 2024) ;
//   - histoire-géographie (BO n° 31 du 30 juillet 2020), EMC (BO n° 24 du 13
//     juin 2024), vie affective (BO n° 6 du 6 février 2025) et langues : tirées
//     des « Démarches et contenus d'enseignement » et des compétences du cycle.
// Formulations reprises des textes, parfois raccourcies pour être lisibles par
// un enfant. Un chapitre sans entrée n'a simplement pas de compétences listées.

export const COMPETENCES: Record<string, string[]> = {
  // ─── CM2 · Français ───────────────────────────────────────────────────
  "cm2-fr-lecture": [
    "Lire correctement environ 120 mots par minute",
    "Lire à voix haute, après préparation, un texte long avec expressivité",
    "Restituer l'essentiel d'un texte, y compris ce qui n'est pas dit directement",
    "Reconnaître et nommer les principaux genres littéraires",
    "Rapprocher deux documents pour repérer et compléter les informations",
  ],
  "cm2-fr-culture": [
    "Mettre en relation le texte lu avec une autre œuvre ou une référence culturelle",
    "Mettre en relation le texte lu avec ses expériences personnelles",
    "Comprendre les valeurs portées par les personnages et les conséquences de leurs actions",
    "S'engager et persévérer dans sa lecture",
  ],
  "cm2-fr-ecrire": [
    "Copier et produire des textes avec des stratégies de copie",
    "Reformuler l'essentiel d'une leçon, y compris sous forme de schéma",
    "Écrire pour comparer deux documents",
    "Décrire, dialoguer, imaginer une suite de texte",
    "Utiliser le brouillon et améliorer son texte",
  ],
  "cm2-fr-oral": [
    "Comprendre un message oral venant d'un média (interview, reportage)",
    "Raconter, expliquer, argumenter, justifier de façon claire et organisée",
    "Lire un texte de façon expressive devant un public",
    "Prendre la parole en respectant les codes de la communication",
    "Adapter son discours à la situation",
  ],
  "cm2-fr-vocabulaire": [
    "Comprendre un mot inconnu grâce au contexte et à sa formation",
    "Utiliser des dictionnaires",
    "Utiliser à bon escient les mots qui ont plusieurs sens",
    "Réemployer le vocabulaire étudié",
    "Écrire correctement les mots fréquents",
  ],
  "cm2-fr-phrase": [
    "Analyser une phrase simple",
    "Distinguer phrase simple et phrase complexe en repérant les verbes conjugués",
    "Identifier les conjonctions de subordination",
  ],
  "cm2-fr-nature-fonction": [
    "Distinguer la nature (classe) d'un mot et sa fonction",
    "Identifier le sujet, même inversé",
    "Différencier attribut du sujet et complément d'objet",
    "Différencier complément d'objet direct (COD) et indirect (COI)",
    "Différencier les compléments circonstanciels de temps, de lieu, de cause",
    "Reconnaître le complément du nom et différencier épithète et attribut",
  ],
  "cm2-fr-accords": [
    "Réaliser la chaîne d'accords dans le groupe nominal",
    "Accorder le sujet et le verbe, même quand le sujet est inversé",
    "Accorder l'attribut avec le sujet",
    "Accorder le participe passé avec le sujet quand l'auxiliaire est être",
  ],
  "cm2-fr-conjugaison": [
    "Conjuguer au passé simple et au plus-que-parfait (être, avoir, 1er et 2e groupes, faire, aller, dire, venir, pouvoir, voir, vouloir, prendre)",
    "Savoir qu'un temps composé = auxiliaire + participe passé",
    "Repérer dans la terminaison la marque de temps et la marque de personne",
    "Mettre un verbe à un temps composé à la forme négative",
  ],

  // ─── CM2 · Mathématiques ──────────────────────────────────────────────
  "cm2-ma-entiers": [
    "Lire et écrire les nombres jusqu'à 999 999 999",
    "Connaître la valeur d'un chiffre selon sa position",
    "Comparer, encadrer, ranger des nombres entiers avec =, < et >",
    "Placer des nombres sur une demi-droite graduée",
    "Trouver les diviseurs d'un nombre et des multiples communs",
  ],
  "cm2-ma-fractions": [
    "Lire, écrire et représenter des fractions",
    "Écrire une fraction plus grande que 1 comme un entier plus une fraction",
    "Placer une fraction sur une demi-droite graduée",
    "Comparer, additionner et soustraire des fractions",
    "Calculer une fraction d'une quantité (deux tiers de 12 €)",
  ],
  "cm2-ma-decimaux": [
    "Connaître les dixièmes, centièmes et millièmes",
    "Passer d'une fraction décimale à une écriture à virgule, et l'inverse",
    "Placer un nombre décimal sur une demi-droite graduée",
    "Donner la partie entière et l'arrondi à l'unité",
    "Comparer, encadrer, ranger des nombres décimaux",
  ],
  "cm2-ma-calcul-mental": [
    "Connaître ses tables et des faits numériques usuels",
    "Connaître l'écriture décimale des fractions usuelles",
    "Multiplier et diviser un décimal par 10, 100 ou 1 000",
    "Ajouter ou soustraire 9, 19, 99… à un nombre",
    "Calculer le double et la moitié d'un nombre décimal",
  ],
  "cm2-ma-operations": [
    "Estimer le résultat d'une opération",
    "Faire un calcul avec une ou deux paires de parenthèses",
    "Poser la multiplication d'un nombre décimal par un nombre entier",
    "Poser une division décimale par un nombre à un chiffre",
  ],
  "cm2-ma-problemes": [
    "Résoudre des problèmes additifs en une ou plusieurs étapes",
    "Résoudre des problèmes multiplicatifs « parties-tout »",
    "Résoudre des problèmes de comparaison multiplicative",
    "Résoudre des problèmes de dénombrement et d'optimisation",
  ],
  "cm2-ma-algebre": [
    "Trouver le nombre manquant dans une égalité à trous",
    "Exécuter ou produire un programme de calcul",
    "Trouver la règle d'une suite de nombres et la poursuivre",
    "Trouver le nombre d'éléments à une étape d'une suite de motifs",
  ],
  "cm2-ma-grandeurs": [
    "Comparer et déterminer des aires",
    "Utiliser cm², dm² et m², et convertir des aires",
    "Calculer l'aire d'un carré ou d'un rectangle",
    "Savoir qu'un angle droit mesure 90° et comparer des angles",
    "Lire l'heure et calculer des durées en heures, minutes et secondes",
  ],
  "cm2-ma-geometrie": [
    "Utiliser règle, équerre et compas",
    "Reconnaître et utiliser perpendicularité et parallélisme",
    "Reconnaître les figures usuelles et connaître leurs propriétés",
    "Construire une figure et écrire un programme de construction",
    "Construire le symétrique d'une figure sur quadrillage",
  ],
  "cm2-ma-solides": [
    "Nommer cube, boule, pavé, cône, pyramide, cylindre, prisme droit",
    "Décrire un solide avec le bon vocabulaire",
    "Reconnaître et construire un patron de cube, reconnaître celui d'un pavé",
    "Décrire un déplacement avec une suite d'instructions",
  ],
  "cm2-ma-donnees": [
    "Présenter des données dans un tableau ou un diagramme en barres",
    "Lire un tableau, un diagramme en barres, circulaire ou une courbe",
    "Trouver toutes les issues d'une expérience aléatoire simple",
    "Exprimer une probabilité sous la forme « a chances sur b »",
    "Comparer des probabilités dans des cas simples",
  ],
  "cm2-ma-proportionnalite": [
    "Reconnaître une situation de proportionnalité",
    "Résoudre un problème de proportionnalité",
  ],
  "cm2-ma-info": [
    "Coder un déplacement avec une suite d'instructions",
    "Exécuter un programme de calcul de trois instructions",
    "Écrire un programme de construction dans des cas simples",
  ],

  // ─── CM2 · Histoire et géographie ─────────────────────────────────────
  "cm2-hi-republique": [
    "Situer 1892 et le centenaire de la République sur une frise",
    "Expliquer le rôle de l'école gratuite, laïque et obligatoire de Jules Ferry",
    "Reconnaître les symboles de la République",
    "Expliquer que nos libertés et nos droits ont été conquis peu à peu",
  ],
  "cm2-hi-industriel": [
    "Citer les énergies de l'âge industriel (charbon, pétrole) et des machines",
    "Décrire le travail à la mine, à l'usine ou au grand magasin",
    "Expliquer comment l'industrie a changé les villes et les campagnes",
  ],
  "cm2-hi-guerres-ue": [
    "Situer les deux guerres mondiales dans le temps",
    "Repérer des traces des guerres près de chez soi (monuments, commémorations)",
    "Expliquer ce que sont la Résistance, la collaboration et le génocide des Juifs",
    "Expliquer que des pays autrefois ennemis forment l'Union européenne",
  ],
  "cm2-ge-deplacer": [
    "Décrire les modes de transport utilisés au quotidien et pour voyager",
    "Lire une carte de réseaux de transport",
    "Expliquer les liens entre déplacements et développement durable",
  ],
  "cm2-ge-internet": [
    "Expliquer comment fonctionne le réseau Internet (câbles, serveurs)",
    "Décrire comment Internet change notre rapport à l'espace et au temps",
    "Constater les inégalités d'accès à Internet dans le monde",
  ],
  "cm2-ge-habiter": [
    "Donner des exemples de nature en ville et de recyclage",
    "Décrire un écoquartier",
    "Expliquer les choix faits pour mieux habiter et protéger l'environnement",
  ],

  // ─── CM2 · Sciences et technologie ────────────────────────────────────
  "cm2-st-matiere": [
    "Décrire la matière avec masse et volume",
    "Identifier les états solide, liquide et gazeux",
    "Classer des matériaux selon leurs propriétés, par exemple pour le tri",
  ],
  "cm2-st-mouvement": [
    "Décrire un mouvement en précisant le point de vue",
    "Caractériser un mouvement par des mesures",
  ],
  "cm2-st-energie": [
    "Identifier les formes d'énergie dans un appareil qui la convertit",
    "Chercher des informations sur les ressources en énergie avec esprit critique",
  ],
  "cm2-st-lumiere-electricite": [
    "Expliquer la formation des ombres, aussi avec le Soleil, la Terre et la Lune",
    "Réaliser un circuit électrique à une boucle en sécurité",
    "Citer des exemples de signaux qui transmettent une information",
  ],
  "cm2-st-classer": [
    "Décrire la diversité du vivant, actuelle et passée",
    "Classer les êtres vivants et établir leurs liens de parenté",
  ],
  "cm2-st-alimentation": [
    "Expliquer le rôle des aliments pour le fonctionnement du corps",
    "Expliquer comment on transforme et conserve les aliments",
  ],
  "cm2-st-developpement": [
    "Décrire le cycle de vie d'une plante à fleurs et d'un animal",
    "Décrire les changements de la puberté",
  ],
  "cm2-st-besoins-objets": [
    "Associer un besoin à des objets techniques qui y répondent",
    "Distinguer un objet technique d'un objet naturel",
    "Repérer comment les objets ont évolué au fil du temps",
  ],
  "cm2-st-fonctionnement": [
    "Distinguer besoin, fonction technique et solution technique",
    "Décrire un objet par un schéma et par un croquis",
  ],
  "cm2-st-projet": [
    "Suivre la démarche technologique dans un projet",
    "Participer à un travail collectif",
  ],
  "cm2-st-programmer": [
    "Repérer la chaîne d'information et la chaîne d'action d'un objet programmable",
    "Programmer un objet pour obtenir le comportement voulu",
  ],
  "cm2-st-terre": [
    "Décrire l'activité de la planète Terre et ses conséquences",
    "Décrire les conditions de la vie sur Terre",
    "Différencier météo et climat",
    "Expliquer le réchauffement climatique actuel avec des arguments scientifiques",
  ],
  "cm2-st-ecosystemes": [
    "Décrire un écosystème et les interactions qui s'y déroulent",
    "Expliquer qui mange qui dans un réseau alimentaire",
    "Décrire les conséquences d'une action humaine sur un écosystème",
  ],

  // ─── CM2 · EMC ────────────────────────────────────────────────────────
  "cm2-emc-citoyennete": [
    "Expliquer le lien entre nationalité et citoyenneté",
    "Distinguer droits civils et droits politiques (voter, être élu)",
    "Citer des devoirs du citoyen : respecter les lois, payer l'impôt",
    "Connaître les symboles de la République : drapeau, hymne, devise",
  ],
  "cm2-emc-libertes": [
    "Citer des libertés de la Déclaration des droits de l'homme et du citoyen",
    "Citer des droits de la Convention internationale des droits de l'enfant",
    "Savoir que la liberté d'expression en ligne a des limites",
  ],
  "cm2-emc-droits-tous": [
    "Repérer un préjugé ou un stéréotype",
    "Reconnaître une discrimination et savoir qu'elle est interdite",
    "Respecter la dignité de chacun et l'égalité des droits",
  ],
  "cm2-emc-laicite": [
    "Expliquer le principe de laïcité à l'école",
    "Savoir que chacun est libre de croire ou de ne pas croire",
  ],

  // ─── CM2 · Vie affective et relationnelle ─────────────────────────────
  "cm2-evar-corps": [
    "Nommer les parties du corps et les organes reproducteurs",
    "Savoir que la puberté arrive à des moments différents pour chacun",
    "Parler des règles sans moquerie",
  ],
  "cm2-evar-relations": [
    "Exprimer ses émotions et écouter celles des autres",
    "Demander et respecter le consentement, accepter un refus",
    "Repérer une situation de violence et savoir s'en protéger",
  ],
  "cm2-evar-numerique": [
    "Repérer les risques d'Internet et des réseaux",
    "Savoir à quel adulte parler et où trouver de l'aide",
  ],

  // ─── CM2 · Anglais ────────────────────────────────────────────────────
  "cm2-an-moi": [
    "Se présenter et présenter quelqu'un (portrait physique et moral)",
    "Parler de sa maison, de sa ville, de sa vie quotidienne",
    "Comprendre des consignes et des phrases simples sur la vie de tous les jours",
  ],
  "cm2-an-reperes": [
    "Situer quelques pays anglophones sur une carte",
    "Citer des fêtes et des traditions des pays anglophones",
  ],
  "cm2-an-imaginaire": [
    "Comprendre un conte ou un album lu à voix haute",
    "Raconter une courte histoire avec des phrases simples",
  ],
  "cm2-an-grammaire": [
    "Conjuguer un verbe au présent et accorder avec le sujet",
    "Utiliser articles, possessifs et la bonne place de l'adjectif",
    "Poser une question et répondre à la forme négative",
    "Relier des idées avec and, or, because",
  ],
  "cm2-an-phonologie": [
    "Reproduire les sons propres à l'anglais",
    "Respecter l'accent tonique, le rythme et l'intonation",
    "Épeler un mot avec l'alphabet anglais",
  ],

  // ─── 5e · Français ────────────────────────────────────────────────────
  "5e-fr-heros": [
    "Comprendre le parcours d'un héros ou d'une héroïne et les enjeux de l'œuvre",
    "Repérer les stéréotypes héroïques et leur évolution, de l'épopée au roman",
    "Justifier son point de vue de lecteur",
    "Écrire un récit narratif et descriptif",
  ],
  "5e-fr-poesie": [
    "Lire un poème de manière expressive (voix, rythme, regard)",
    "Réciter un court texte en vers",
    "Repérer les effets des sonorités, des rythmes et des images",
    "Écrire un texte poétique en jouant avec les contraintes",
  ],
  "5e-fr-theatre": [
    "Connaître les spécificités du texte de théâtre et de sa mise en scène",
    "Comprendre ce qui fait rire et ce que le comique dénonce",
    "Jouer une scène en utilisant la voix et le corps",
  ],
  "5e-fr-imaginer": [
    "Comprendre la morale d'un conte ou d'une fable",
    "Interroger la conduite des personnages",
    "Écrire ou réécrire un court récit qui instruit (apologue)",
  ],
  "5e-fr-phrase": [
    "Identifier les types de phrases et leurs effets",
    "Reconnaître les formes exclamative et négative",
    "Distinguer phrase simple, complexe et non verbale",
    "Comprendre juxtaposition et coordination entre propositions",
    "Utiliser la ponctuation à bon escient",
  ],
  "5e-fr-fonctions": [
    "Identifier sujet, COD, COI et attribut du sujet",
    "Identifier les compléments circonstanciels de lieu, cause, temps, manière",
    "Identifier le groupe nominal minimal et étendu",
    "Distinguer déterminants et pronoms",
    "Identifier prépositions, adverbes et mots subordonnants",
  ],
  "5e-fr-paroles": [
    "Identifier le discours direct et le discours indirect",
    "Insérer des paroles au discours direct dans un texte",
    "Distinguer les registres de langue et s'adapter au contexte",
  ],
  "5e-fr-conjugaison": [
    "Repérer radical et terminaison (marques de temps et de personne)",
    "Conjuguer aux temps simples : présent, futur, imparfait, passé simple, conditionnel, impératif",
    "Conjuguer aux temps composés : passé composé, plus-que-parfait",
    "Choisir le bon temps selon le sens du texte",
  ],
  "5e-fr-accords": [
    "Maîtriser les accords dans le groupe nominal",
    "Accorder le verbe avec un sujet éloigné ou composé de plusieurs noms",
    "Accorder l'attribut du sujet",
    "Justifier l'accord du participe passé avec être et avec avoir",
  ],
  "5e-fr-vocabulaire": [
    "Trouver le sens d'un mot (contexte, dictionnaire)",
    "Utiliser préfixes, radical et suffixes pour comprendre un mot",
    "Nommer les relations de sens entre les mots",
    "Connaître quelques racines latines et grecques",
    "Mémoriser l'orthographe du vocabulaire rencontré",
  ],

  // ─── 5e · Mathématiques ───────────────────────────────────────────────
  "5e-ma-operations": [
    "Connaître et utiliser les priorités opératoires",
    "Traduire un programme de calcul en une seule expression",
    "Distinguer somme et produit, termes et facteurs",
    "Utiliser la distributivité simple",
    "Connaître les critères de divisibilité par 3 et par 9",
  ],
  "5e-ma-relatifs": [
    "Définir un nombre relatif, son opposé et sa valeur absolue",
    "Placer et lire un nombre relatif sur une droite graduée",
    "Comparer et ranger des nombres relatifs",
    "Additionner et soustraire des nombres relatifs",
  ],
  "5e-ma-fractions": [
    "Comparer des fractions",
    "Additionner et soustraire des fractions de dénominateurs quelconques",
    "Résoudre des problèmes avec des fractions",
  ],
  "5e-ma-puissances": [
    "Connaître la notation du carré et du cube",
    "Connaître les carrés des entiers de 0 à 12 et le cube de 10",
    "Calculer une expression avec des puissances simples",
  ],
  "5e-ma-litteral": [
    "Produire une formule et la calculer en remplaçant la lettre",
    "Tester si une égalité est vraie ou fausse",
    "Développer et factoriser avec k(a + b) = ka + kb",
    "Réduire une expression de la forme ax + b",
    "Résoudre des équations ax = c ou x + b = c",
  ],
  "5e-ma-reperage": [
    "Lire et placer un point sur une droite graduée",
    "Lire et placer un point dans un repère",
    "Représenter un pavé, un cube, un cylindre, un prisme en perspective cavalière",
    "Calculer le volume d'un cube, d'un pavé, d'un prisme, d'un cylindre",
    "Calculer l'aire d'un disque",
  ],
  "5e-ma-symetrie-angles": [
    "Construire le symétrique d'une figure par symétrie centrale (demi-tour)",
    "Connaître les propriétés de la symétrie centrale",
    "Reconnaître les angles alternes-internes et correspondants",
    "Caractériser le parallélisme par les angles",
  ],
  "5e-ma-triangles": [
    "Connaître et démontrer la somme des angles d'un triangle (180°)",
    "Construire un triangle à partir de quelques données",
    "Tracer hauteurs et médianes d'un triangle",
    "Calculer l'aire d'un triangle",
  ],
  "5e-ma-parallelogrammes": [
    "Définir et construire un parallélogramme",
    "Connaître les propriétés des côtés et des diagonales",
    "Reconnaître rectangle, losange et carré par leurs propriétés",
    "Calculer l'aire d'un parallélogramme",
  ],
  "5e-ma-statistiques": [
    "Calculer des effectifs et des fréquences",
    "Lire et construire tableaux, diagrammes et graphiques",
    "Choisir une représentation adaptée",
    "Calculer et interpréter une moyenne",
  ],
  "5e-ma-probabilites": [
    "Utiliser le vocabulaire : expérience aléatoire, issue, évènement",
    "Calculer une probabilité dans un cas d'équiprobabilité",
    "Répéter une expérience et noter les fréquences observées",
  ],
  "5e-ma-proportionnalite": [
    "Reconnaître une situation de proportionnalité (tableau, graphique)",
    "Utiliser un coefficient de proportionnalité (prix unitaire, vitesse, échelle)",
    "Calculer et appliquer un pourcentage",
    "Produire un tableau de valeurs et lire un graphique « en fonction de »",
  ],

  // ─── 5e · Histoire et géographie ──────────────────────────────────────
  "5e-hi-chretientes-islam": [
    "Situer Byzance, l'empire carolingien et le monde musulman dans le temps et sur une carte",
    "Décrire la naissance et l'expansion de l'islam",
    "Montrer les contacts entre ces mondes (échanges, conflits, croisades)",
  ],
  "5e-hi-feodal": [
    "Décrire la seigneurie et la vie des paysans",
    "Expliquer le rôle de l'Église dans la société médiévale",
    "Décrire l'essor des villes et des marchands",
    "Expliquer comment le roi affirme son pouvoir",
  ],
  "5e-hi-europe-monde": [
    "Situer les grandes découvertes et leurs conséquences",
    "Expliquer ce que sont l'humanisme et les réformes religieuses",
    "Décrire le passage du roi de la Renaissance au roi absolu (François Ier à Louis XIV)",
  ],
  "5e-ge-demographie": [
    "Décrire la répartition de la population mondiale et sa croissance",
    "Comparer des pays selon leur niveau de développement",
    "Lire et compléter une carte et un graphique",
  ],
  "5e-ge-ressources": [
    "Expliquer pourquoi l'eau et l'énergie sont des ressources à ménager",
    "Expliquer les défis pour nourrir une population qui grandit",
    "Donner des exemples de solutions pour mieux utiliser les ressources",
  ],
  "5e-ge-environnement": [
    "Décrire les effets du changement climatique dans différentes régions",
    "Expliquer comment prévenir les risques et s'y adapter",
  ],

  // ─── 5e · EMC ─────────────────────────────────────────────────────────
  "5e-emc-egalite": [
    "Expliquer que l'égalité femmes-hommes est le résultat de combats et de lois",
    "Repérer un stéréotype de genre",
    "Savoir qu'une discrimination est un délit et que le harcèlement est puni",
  ],
  "5e-emc-solidarite": [
    "Expliquer le lien entre fraternité et solidarité",
    "Décrire le rôle de la Sécurité sociale face aux risques de la vie",
    "Donner des exemples d'engagement solidaire (associations, entraide)",
  ],

  // ─── 5e · SVT et physique-chimie (attendus de fin de cycle 4, BO n° 31 du 30 juillet 2020) ──
  // Ids « c4-… » : ceux de la 5e (la 4e et la 3e ont leurs propres ids, sans compétences ici).
  "c4-svt-terre": [
    "Expliquer quelques phénomènes géologiques (séismes, volcans)",
    "Expliquer des éléments de météo et de climat",
    "Repérer les effets de l'action humaine sur la planète, bénéfices et risques",
    "Proposer des comportements responsables pour préserver les ressources",
  ],
  "c4-svt-vivant": [
    "Expliquer l'organisation du vivant à différentes échelles",
    "Expliquer la nutrition des organismes",
    "Expliquer la classification du vivant et la biodiversité",
  ],
  "c4-svt-corps": [
    "Expliquer le fonctionnement des muscles, du cœur, de la respiration et de la digestion",
    "Expliquer nos relations avec les microbes et les défenses du corps",
    "Relier ces connaissances à des comportements bons pour la santé",
  ],
  "c4-pc-matiere": [
    "Décrire la constitution et les états de la matière",
    "Distinguer transformation physique et transformation chimique",
    "Distinguer mélange et corps pur, utiliser la masse volumique",
  ],
  "c4-pc-mouvement": [
    "Caractériser un mouvement et calculer une vitesse",
    "Représenter une action par une force (direction, sens, valeur)",
  ],
  "c4-pc-energie": [
    "Identifier les sources, les formes et les conversions d'énergie",
    "Utiliser la conservation de l'énergie",
    "Réaliser des circuits électriques simples",
  ],
  "c4-pc-signaux": [
    "Caractériser des signaux lumineux, sonores, radio",
    "Utiliser la propagation de la lumière et du son",
  ],

  // ─── 5e · Technologie ─────────────────────────────────────────────────
  "c4-te-usages": [
    "Comparer des principes techniques pour une même fonction",
    "Ranger et retrouver des fichiers, connaître les bases de la cybersécurité",
    "Repérer les choix de conception liés à la sécurité et au développement durable",
    "Mesurer une performance d'un objet en suivant un protocole",
  ],
  "c4-te-fonctionnement": [
    "Repérer matériaux, énergies et traitement de l'information d'un objet",
    "Identifier les composants d'un réseau local",
    "Repérer une pièce défectueuse et réparer en suivant un protocole",
    "Modifier les paramètres d'un programme et observer les effets",
  ],
  "c4-te-creation": [
    "Suivre un projet avec des tâches et une durée",
    "Choisir un matériau et une source d'énergie adaptés",
    "Assembler des constituants pour réaliser un prototype",
    "Écrire et mettre au point un programme simple qui commande un objet",
  ],

  // ─── 5e · Vie affective et relationnelle ──────────────────────────────
  "5e-evars-personnalite": [
    "Développer sa personnalité sans se sentir obligé",
    "Respecter les différences de chacun",
    "Prendre soin de sa santé physique et mentale",
  ],
  "5e-evars-relations": [
    "Construire des relations respectueuses",
    "Demander et respecter le consentement",
    "Refuser les discriminations",
  ],
  "5e-evars-societe": [
    "Distinguer vie publique et vie privée",
    "Protéger sa vie privée sur les réseaux sociaux",
  ],

  // ─── 5e · Anglais (niveau visé A1+ à A2) ──────────────────────────────
  "5e-an-portrait": ["Se décrire et décrire quelqu'un à l'oral et à l'écrit", "Comprendre un portrait lu ou entendu", "Poser des questions sur quelqu'un"],
  "5e-an-quotidien": ["Parler de ses habitudes et de son emploi du temps", "Dire l'heure, la date, la saison", "Comparer sa vie avec celle d'un élève anglophone"],
  "5e-an-imaginaire": ["Comprendre l'essentiel d'une histoire", "Raconter une histoire au passé avec des phrases simples"],
  "5e-an-ecole": ["Parler de son école et de ses loisirs", "Dire ce qu'on aime ou n'aime pas, et pourquoi"],
  "5e-an-langues": ["Repérer des accents et des mots de différents pays anglophones", "Présenter une fête ou un lieu du monde anglophone"],
  "5e-an-royaume-uni": ["Situer les nations du Royaume-Uni et leurs capitales", "Citer des repères d'histoire et de culture britanniques"],

  // ─── 5e · Italien (niveau visé A1) ────────────────────────────────────
  "5e-it-portrait": ["Se présenter : nom, âge, ville, goûts", "Décrire quelqu'un avec des mots simples"],
  "5e-it-quotidien": ["Parler de sa journée et de ses habitudes", "Dire l'heure, la date, la saison"],
  "5e-it-ecole": ["Parler de son école et de ses loisirs", "Dire ce qu'on aime ou n'aime pas"],
  "5e-it-imaginaire": ["Comprendre un conte court lu ou entendu", "Nommer quelques personnages italiens célèbres"],
  "5e-it-langues": ["Situer quelques régions et villes d'Italie", "Présenter un monument ou une spécialité"],
  "5e-it-rome": ["Situer Rome et citer des monuments antiques et modernes", "Présenter un lieu de Rome en quelques phrases"],
};
