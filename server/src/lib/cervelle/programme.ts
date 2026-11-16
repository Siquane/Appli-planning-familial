// Programme officiel de l'Éducation nationale, par classe et par matière,
// tel qu'il s'applique en 2026-2027.
//
// Sert à deux choses :
//   - Claude reçoit les chapitres de la classe de l'élève quand il prépare une
//     révision : il range le cours dans un chapitre et cale les fiches sur ce
//     que le programme attend (vocabulaire officiel, notions essentielles) ;
//   - l'appli montre, matière par matière, les chapitres de l'année et ceux
//     qui ont déjà été révisés.
//
// Sources : les textes officiels eux-mêmes, rangés dans docs/programmes/
// (PDF et texte extrait), et les pages Éduscol « Enseigner au cycle 3 / 4 »
// qui disent quel texte s'applique à chaque classe en 2026-2027.
// Intitulés repris des textes ; notions résumées à partir des objectifs
// d'apprentissage. `verifie` = relu sur le texte officiel.
//
// Pour ajouter une classe : une entrée dans PROGRAMMES, avec des `id` stables
// (ils sont enregistrés sur les révisions).

export interface Chapter {
  id: string;
  title: string;
  /** Ce que le programme attend dans ce chapitre, en quelques mots. */
  notions: string[];
}

export interface SubjectProgramme {
  subject: string;
  source: string;
  verifie: boolean;
  /** Le programme fixe des thèmes pour tout le cycle : l'ordre dans l'année dépend du professeur. */
  cycleWide?: boolean;
  chapters: Chapter[];
}

export const SCHOOL_YEAR = "2026-2027";

export const PROGRAMMES: Record<string, SubjectProgramme[]> = {
  CM2: [
    {
      subject: "Français",
      source: "Programme de français du cycle 3, BO n° 16 du 17 avril 2025 (en vigueur au CM2 à la rentrée 2026)",
      verifie: true,
      chapters: [
        { id: "cm2-fr-lecture", title: "Lire avec fluidité et comprendre", notions: ["Lire à voix haute avec aisance et expressivité (environ 120 mots par minute)", "Restituer l'essentiel d'un texte : informations explicites et implicites", "Reconnaître les principaux genres littéraires", "Comprendre un document composite, rapprocher deux documents"] },
        { id: "cm2-fr-culture", title: "Culture littéraire et artistique", notions: ["Découvrir des héroïnes, des héros", "Se confronter au merveilleux, à l'étrange", "Imaginer et vivre d'autres vies", "Comprendre et interroger la morale", "Savourer le goût des mots, imaginer et créer en poésie", "Se découvrir, s'affirmer dans le rapport aux autres"] },
        { id: "cm2-fr-ecrire", title: "Écriture", notions: ["Copier et produire des textes, stratégies de copie", "Écrire pour réfléchir, apprendre et comparer des documents", "Décrire, dialoguer, imaginer une suite", "Cohérence du texte, utiliser le brouillon"] },
        { id: "cm2-fr-oral", title: "Oral", notions: ["Écouter pour comprendre un message, une interview, un reportage", "Raconter, expliquer, argumenter devant les autres", "Participer à un échange en respectant les codes de la communication"] },
        { id: "cm2-fr-vocabulaire", title: "Vocabulaire", notions: ["Comprendre un mot inconnu grâce au contexte et à sa formation", "Utiliser le dictionnaire", "Polysémie, relations de sens et de forme entre les mots", "Orthographe des mots fréquents"] },
        { id: "cm2-fr-phrase", title: "Grammaire : la phrase", notions: ["Les trois types de phrases et leurs formes", "Constituants de la phrase simple : sujet (y compris inversé), verbe, compléments", "Attribut du sujet ou complément d'objet", "Phrase simple et phrase complexe"] },
        { id: "cm2-fr-nature-fonction", title: "Grammaire : nature et fonction des mots", notions: ["Distinguer nature (classe grammaticale) et fonction", "Prépositions, pronoms personnels compléments d'objet", "Le groupe nominal : adjectif, complément du nom", "Épithète ou attribut du sujet"] },
        { id: "cm2-fr-accords", title: "Orthographe grammaticale : les accords", notions: ["Chaîne d'accords dans le groupe nominal", "Accord sujet-verbe et sujet-attribut", "Accord du participe passé avec être, et avec avoir quand le COD est placé avant"] },
        { id: "cm2-fr-conjugaison", title: "Conjugaison", notions: ["Passé simple", "Temps composés : passé composé et plus-que-parfait (auxiliaire + participe passé)", "Verbes être, avoir, 1er et 2e groupes et faire, aller, dire, venir, pouvoir, voir, vouloir, prendre", "Marques de temps et de personne, variations du radical"] },
      ],
    },
    {
      subject: "Mathématiques",
      source: "Programme de mathématiques du cycle 3, BO n° 16 du 17 avril 2025 (en vigueur au CM2 à la rentrée 2026)",
      verifie: true,
      chapters: [
        { id: "cm2-ma-entiers", title: "Les nombres entiers", notions: ["Lire, écrire, décomposer les nombres jusqu'à 999 999 999", "Comparer, encadrer, ranger, placer sur une demi-droite graduée", "Multiples et diviseurs, critères de divisibilité par 2, 5 et 10"] },
        { id: "cm2-ma-fractions", title: "Les fractions", notions: ["Lire, écrire, représenter une fraction", "Fraction supérieure à 1 = entier + fraction", "Comparer, additionner et soustraire des fractions", "Calculer une fraction d'une quantité (deux tiers de 12 €)"] },
        { id: "cm2-ma-decimaux", title: "Les nombres décimaux", notions: ["Fractions décimales et écriture à virgule, jusqu'aux millièmes", "Comparer, ranger, encadrer, placer sur une demi-droite graduée", "Partie entière et arrondi à l'unité"] },
        { id: "cm2-ma-calcul-mental", title: "Le calcul mental", notions: ["Tables et faits numériques, moitiés, fractions usuelles", "Multiplier et diviser par 10, 100, 1 000", "Ajouter 9, 19, 99…, multiplier par 5 et par 50", "Doubles et moitiés de décimaux"] },
        { id: "cm2-ma-operations", title: "Les quatre opérations", notions: ["Estimer un résultat, calculs avec parenthèses", "Multiplier un décimal par un entier", "Division décimale par un nombre à un chiffre"] },
        { id: "cm2-ma-problemes", title: "Résoudre des problèmes", notions: ["Problèmes additifs, multiplicatifs, mixtes en plusieurs étapes", "Comparaison multiplicative, dénombrement, optimisation", "Comprendre, modéliser, calculer, répondre et vérifier"] },
        { id: "cm2-ma-algebre", title: "Initiation à l'algèbre", notions: ["Suites et motifs, trouver une règle", "Égalités à trou, premières écritures avec une inconnue"] },
        { id: "cm2-ma-grandeurs", title: "Aires, angles et durées", notions: ["Comparer et calculer des aires (carré, rectangle), convertir", "Les angles : vocabulaire, notation, angle droit = 90°", "Lire l'heure, calculer des durées"] },
        { id: "cm2-ma-geometrie", title: "Géométrie plane", notions: ["Utiliser règle, équerre et compas", "Perpendiculaires et parallèles", "Élaborer un programme de construction"] },
        { id: "cm2-ma-solides", title: "Solides et espace", notions: ["Cube, pavé, pyramide, prisme, cylindre, cône, boule", "Patrons du cube et du pavé", "Décrire un déplacement, assemblages de cubes"] },
        { id: "cm2-ma-donnees", title: "Données et probabilités", notions: ["Lire et produire tableaux, diagrammes en barres, diagrammes circulaires, courbes", "Issues d'une expérience aléatoire", "Probabilité « a chances sur b », comparer des probabilités"] },
        { id: "cm2-ma-proportionnalite", title: "Proportionnalité", notions: ["Reconnaître une situation de proportionnalité", "Résoudre un problème de proportionnalité"] },
        { id: "cm2-ma-info", title: "Pensée informatique", notions: ["Suivre et écrire une suite d'instructions", "Programmes de construction simples"] },
      ],
    },
    {
      subject: "Histoire",
      source: "Programme d'histoire du cycle 3, BO n° 31 du 30 juillet 2020 (en vigueur au CM2 en 2026-2027)",
      verifie: true,
      chapters: [
        { id: "cm2-hi-republique", title: "Le temps de la République", notions: ["1892 : la République fête ses cent ans", "L'école primaire au temps de Jules Ferry", "Des républiques, une démocratie : des libertés, des droits et des devoirs"] },
        { id: "cm2-hi-industriel", title: "L'âge industriel en France", notions: ["Les énergies majeures de l'âge industriel (charbon puis pétrole) et les machines", "Le travail à la mine, à l'usine, à l'atelier, au grand magasin", "La ville industrielle", "Le monde rural"] },
        { id: "cm2-hi-guerres-ue", title: "La France, des guerres mondiales à l'Union européenne", notions: ["Deux guerres mondiales au vingtième siècle (Résistance, collaboration, génocide des Juifs)", "La construction européenne"] },
      ],
    },
    {
      subject: "Géographie",
      source: "Programme de géographie du cycle 3, BO n° 31 du 30 juillet 2020 (en vigueur au CM2 en 2026-2027)",
      verifie: true,
      chapters: [
        { id: "cm2-ge-deplacer", title: "Se déplacer", notions: ["Se déplacer au quotidien en France", "Se déplacer au quotidien dans un autre lieu du monde", "Se déplacer de ville en ville, en France, en Europe et dans le monde", "Déplacement et développement durable"] },
        { id: "cm2-ge-internet", title: "Communiquer d'un bout à l'autre du monde grâce à l'Internet", notions: ["Un monde de réseaux", "Un habitant connecté au monde", "Des habitants inégalement connectés dans le monde"] },
        { id: "cm2-ge-habiter", title: "Mieux habiter", notions: ["Favoriser la place de la « nature » en ville", "Recycler", "Habiter un écoquartier"] },
      ],
    },
    {
      subject: "Sciences et technologie",
      source: "Programme de sciences et technologie du cycle 3, BO n° 25 du 22 juin 2023 (attendus de fin de cours moyen)",
      verifie: true,
      chapters: [
        { id: "cm2-st-matiere", title: "La matière et ses transformations", notions: ["Décrire un échantillon de matière : masse, volume", "États de la matière et changements d'état", "Mélanges et transformations de la matière"] },
        { id: "cm2-st-mouvement", title: "Les mouvements", notions: ["Décrire un mouvement en précisant le point de vue", "Caractériser un mouvement par des mesures"] },
        { id: "cm2-st-energie", title: "L'énergie", notions: ["Formes d'énergie dans un dispositif de conversion", "Ressources en énergie et leur utilisation"] },
        { id: "cm2-st-lumiere-electricite", title: "Lumière, ombres et circuits électriques", notions: ["Formation des ombres, système Soleil-Terre-Lune", "Circuits électriques à une boucle"] },
        { id: "cm2-st-classer", title: "Le vivant : diversité et classification", notions: ["Unité et diversité du vivant, actuel et passé", "Classer les organismes, liens de parenté"] },
        { id: "cm2-st-alimentation", title: "Alimentation et fonctionnement de l'organisme", notions: ["Rôle des aliments pour le corps", "Transformer et conserver les aliments"] },
        { id: "cm2-st-developpement", title: "Développement et reproduction", notions: ["Cycle de vie d'une plante à fleurs et d'un animal", "Changements de la puberté et capacité de se reproduire"] },
        { id: "cm2-st-besoins-objets", title: "Besoins et objets techniques", notions: ["Associer un besoin de la société à des objets techniques", "Objet technique ou objet naturel"] },
        { id: "cm2-st-fonctionnement", title: "Décrire le fonctionnement d'un objet", notions: ["Besoins, fonctions techniques et solutions", "Schéma et croquis d'un objet"] },
        { id: "cm2-st-projet", title: "Concevoir et fabriquer un objet", notions: ["Démarche technologique et travail de projet", "Choix de conception et cycle de vie de l'objet"] },
        { id: "cm2-st-programmer", title: "Objets programmables", notions: ["Chaîne d'information et chaîne d'action", "Programmer un objet pour obtenir un comportement attendu"] },
        { id: "cm2-st-terre", title: "La planète Terre, météo et climat", notions: ["Activité de la planète Terre et ses conséquences", "Conditions de la vie sur Terre", "Différencier météorologie et climat"] },
        { id: "cm2-st-ecosystemes", title: "Écosystèmes et êtres vivants dans leur environnement", notions: ["Décrire un écosystème et les interactions", "Réseaux trophiques : qui mange qui ?"] },
      ],
    },
    {
      subject: "Enseignement moral et civique",
      source: "Programme d'EMC, BO n° 24 du 13 juin 2024 — CM2 : Vivre en République",
      verifie: true,
      chapters: [
        { id: "cm2-emc-citoyennete", title: "Citoyenneté et nationalité", notions: ["Acquérir la nationalité française, lien entre citoyenneté et nationalité", "Droits civils et droits politiques (vote, éligibilité)", "Devoirs du citoyen : respecter les lois, payer l'impôt"] },
        { id: "cm2-emc-libertes", title: "Libertés et droits fondamentaux", notions: ["Libertés d'expression, d'opinion, de conscience", "Déclaration des droits de l'homme et du citoyen, droits de l'enfant", "Liberté d'expression en ligne, liberté de l'information"] },
        { id: "cm2-emc-droits-tous", title: "Respecter les droits de tous", notions: ["Préjugés et stéréotypes", "Lutter contre les discriminations", "Dignité de la personne et égalité des droits"] },
        { id: "cm2-emc-laicite", title: "À l'école laïque", notions: ["Le principe de laïcité", "La liberté de conscience à l'école"] },
      ],
    },
    {
      subject: "Vie affective et relationnelle",
      source: "Programme d'éducation à la vie affective et relationnelle, école élémentaire, BO n° 6 du 6 février 2025 (3 séances par an)",
      verifie: true,
      chapters: [
        { id: "cm2-evar-corps", title: "Se connaître, vivre et grandir avec son corps", notions: ["Les changements du corps à la puberté, à des moments différents pour chacun", "Les organes reproducteurs et leur fonction", "Les règles, sans tabou ni moquerie"] },
        { id: "cm2-evar-relations", title: "Rencontrer les autres et construire des relations", notions: ["Les différentes formes d'affection et de sentiments", "Exprimer ses émotions", "Le consentement : le demander, le donner, respecter un refus", "Repérer et se protéger des violences sexistes et sexuelles"] },
        { id: "cm2-evar-numerique", title: "Trouver sa place dans la société", notions: ["Prévenir les risques liés au numérique et à Internet", "Savoir à qui parler et où trouver de l'aide"] },
      ],
    },
    {
      subject: "Anglais",
      source: "Programme de langues vivantes du cycle 3, BO n° 31 du 30 juillet 2020 (en vigueur au CM2 en 2026-2027)",
      verifie: true,
      cycleWide: true,
      chapters: [
        { id: "cm2-an-moi", title: "La personne et la vie quotidienne", notions: ["Le corps humain, les vêtements, les modes de vie", "Le portrait physique et moral", "La ville, la maison, l'écohabitat", "Le développement durable : tri, recyclage, transports, énergie"] },
        { id: "cm2-an-reperes", title: "Des repères géographiques, historiques et culturels", notions: ["Situation et paysages des pays anglophones", "Repères culturels, fêtes et traditions", "Figures historiques et contemporaines, grandes pages d'histoire"] },
        { id: "cm2-an-imaginaire", title: "L'imaginaire", notions: ["Albums et littérature de jeunesse", "Contes, mythes et légendes", "Héros et personnages de fiction, BD, séries, cinéma"] },
        { id: "cm2-an-grammaire", title: "Grammaire", notions: ["Le verbe : accord avec le sujet, présent, passé, futur, auxiliaires", "Le groupe nominal : articles, possessifs, démonstratifs, place de l'adjectif, génitif", "Types de phrases : déclarative, interrogative, exclamative, impérative, négative", "Mots de liaison simples (and, or, because)"] },
        { id: "cm2-an-phonologie", title: "Prononciation", notions: ["Les sons propres à l'anglais", "Accent tonique, rythme et intonation", "L'alphabet et le lien entre sons et écriture"] },
      ],
    },
  ],
  "5e": [
    {
      subject: "Français",
      source: "Programme de français du cycle 4, BO n° 10 du 5 mars 2026 (en vigueur en 5e à la rentrée 2026) — « Éprouver, expérimenter : la découverte de soi, d'autrui et du monde »",
      verifie: true,
      chapters: [
        { id: "5e-fr-heros", title: "Devenir héroïne/héros : destins romanesques", notions: ["Récit et fiction", "Le personnage et son parcours", "Narration et point de vue"] },
        { id: "5e-fr-poesie", title: "Voyager en poésie : « Du monde entier au cœur du monde »", notions: ["Vers, strophes, rimes, rythme", "Images poétiques", "Le voyage et l'ailleurs"] },
        { id: "5e-fr-theatre", title: "Expérimenter et jouer au théâtre : la société sens dessus dessous", notions: ["Répliques, didascalies, mise en scène", "Le comique et le renversement des rôles"] },
        { id: "5e-fr-imaginer", title: "Imaginer, sentir, raisonner : des histoires pour plaire et instruire", notions: ["Récits qui divertissent et font réfléchir (fables, contes, nouvelles)", "La morale d'une histoire"] },
        { id: "5e-fr-phrase", title: "Grammaire : la phrase", notions: ["Ponctuation et constituants de la phrase", "Trois types et formes de phrases (exclamative, négative)", "Phrase simple, complexe, non verbale ; juxtaposition et coordination"] },
        { id: "5e-fr-fonctions", title: "Grammaire : les constituants de la phrase", notions: ["Sujet, COD, COI, attribut du sujet", "Compléments circonstanciels de lieu, temps, cause, manière", "Groupe nominal minimal et étendu", "Prépositions, adverbes, subordonnants ; déterminants et pronoms"] },
        { id: "5e-fr-paroles", title: "Paroles rapportées et registres de langue", notions: ["Discours direct et indirect", "Insérer un dialogue dans un récit", "Grammaire de l'oral et de l'écrit, registres de langue"] },
        { id: "5e-fr-conjugaison", title: "Conjugaison et emploi des temps", notions: ["Radical et terminaison (marques de temps et de personne)", "Présent, futur, imparfait, passé simple, conditionnel, impératif", "Passé composé, plus-que-parfait ; passé antérieur et futur antérieur", "Valeurs des temps, modes indicatif et impératif"] },
        { id: "5e-fr-accords", title: "Les accords", notions: ["Chaînes d'accord du groupe nominal et de l'attribut", "Accord sujet-verbe dans les cas complexes", "Participe passé avec être et avec avoir (COD placé avant)"] },
        { id: "5e-fr-vocabulaire", title: "Vocabulaire et orthographe lexicale", notions: ["Relations de sens et de forme entre les mots", "Préfixes, radical, suffixes, dérivation", "Étymologie : quelques racines latines et grecques", "Registres de langue, néologismes"] },
      ],
    },
    {
      subject: "Mathématiques",
      source: "Programme de mathématiques du cycle 4, BO n° 10 du 5 mars 2026 (repères de la classe de 5e)",
      verifie: true,
      chapters: [
        { id: "5e-ma-operations", title: "Opérations et priorités", notions: ["Enchaîner des opérations, priorités opératoires", "Distributivité simple", "Multiples, diviseurs, critères de divisibilité par 3 et 9", "Diviser par un nombre décimal"] },
        { id: "5e-ma-relatifs", title: "Nombres relatifs", notions: ["Opposé, valeur absolue, positif et négatif", "Repérage sur une droite graduée, comparer et ranger", "Additionner et soustraire des relatifs"] },
        { id: "5e-ma-fractions", title: "Nombres rationnels : fractions", notions: ["Comparer des fractions", "Additionner et soustraire des fractions de dénominateurs quelconques"] },
        { id: "5e-ma-puissances", title: "Puissances", notions: ["Carré et cube d'un nombre", "Carrés des entiers de 0 à 12"] },
        { id: "5e-ma-litteral", title: "Calcul littéral et équations", notions: ["Produire une formule, substituer une valeur", "Développer, factoriser, réduire ax + b", "Tester une égalité, contre-exemple", "Résoudre ax = c et x + b = c"] },
        { id: "5e-ma-reperage", title: "Repérage et représentation de l'espace", notions: ["Repérage sur une droite graduée et dans un repère du plan", "Perspective cavalière et patrons (pavé, prisme, cylindre)", "Volumes du cube, du pavé, du prisme, du cylindre ; aire du disque"] },
        { id: "5e-ma-symetrie-angles", title: "Symétrie centrale et angles", notions: ["Le demi-tour (symétrie centrale) et ses propriétés", "Angles alternes-internes et correspondants, parallélisme"] },
        { id: "5e-ma-triangles", title: "Triangles", notions: ["Somme des angles d'un triangle", "Construire un triangle", "Hauteurs, médianes, médiatrices et cercle circonscrit", "Aire d'un triangle"] },
        { id: "5e-ma-parallelogrammes", title: "Parallélogrammes", notions: ["Définition et propriétés (côtés, diagonales)", "Rectangle, losange, carré", "Aire d'un parallélogramme, conversions d'unités"] },
        { id: "5e-ma-statistiques", title: "Statistiques", notions: ["Effectifs et fréquences", "Tableaux, diagrammes en barres et circulaires, graphiques", "Moyenne d'une série"] },
        { id: "5e-ma-probabilites", title: "Probabilités", notions: ["Expérience aléatoire, issue, évènement", "Probabilités en situation d'équiprobabilité", "Fréquences observées"] },
        { id: "5e-ma-proportionnalite", title: "Proportionnalité et fonctions", notions: ["Proportions et pourcentages", "Reconnaître la proportionnalité (prix, recettes, échelles)", "Premières dépendances entre grandeurs"] },
      ],
    },
    {
      subject: "Histoire",
      source: "Programme d'histoire du cycle 4, BO n° 31 du 30 juillet 2020",
      verifie: true,
      chapters: [
        { id: "5e-hi-chretientes-islam", title: "Chrétientés et islam (VIe-XIIIe siècles), des mondes en contact", notions: ["Byzance et l'Europe carolingienne", "De la naissance de l'islam à la prise de Bagdad par les Mongols : pouvoirs, sociétés, cultures"] },
        { id: "5e-hi-feodal", title: "Société, Église et pouvoir politique dans l'Occident féodal (XIe-XVe siècles)", notions: ["L'ordre seigneurial : la formation et la domination des campagnes", "L'émergence d'une nouvelle société urbaine", "L'affirmation de l'État monarchique dans le Royaume des Capétiens et des Valois"] },
        { id: "5e-hi-europe-monde", title: "Transformations de l'Europe et ouverture sur le monde aux XVIe et XVIIe siècles", notions: ["Le monde au temps de Charles Quint et Soliman le Magnifique", "Humanisme, réformes et conflits religieux", "Du Prince de la Renaissance au roi absolu (François Ier, Henri IV, Louis XIV)"] },
      ],
    },
    {
      subject: "Géographie",
      source: "Programme de géographie du cycle 4, BO n° 31 du 30 juillet 2020",
      verifie: true,
      chapters: [
        { id: "5e-ge-demographie", title: "La question démographique et l'inégal développement", notions: ["La croissance démographique et ses effets", "Répartition de la richesse et de la pauvreté dans le monde"] },
        { id: "5e-ge-ressources", title: "Des ressources limitées, à gérer et à renouveler", notions: ["L'énergie, l'eau : des ressources à ménager et à mieux utiliser", "L'alimentation : comment nourrir une humanité en croissance démographique et aux besoins alimentaires accrus ?"] },
        { id: "5e-ge-environnement", title: "L'environnement, du local au planétaire", notions: ["Le changement climatique et ses principaux effets géographiques régionaux", "Prévenir et s'adapter aux risques (industriels, technologiques et sanitaires ou liés au changement climatique)"] },
      ],
    },
    {
      subject: "Enseignement moral et civique",
      source: "Programme d'EMC, BO n° 24 du 13 juin 2024 — 5e : Égalité, fraternité et solidarité",
      verifie: true,
      chapters: [
        { id: "5e-emc-egalite", title: "Agir pour l'égalité femmes-hommes et lutter contre les discriminations", notions: ["L'égalité femmes-hommes, principe de la République, et les lois qui l'ont construite", "Stéréotypes de genre, violences sexistes et sexuelles", "Discriminations, racisme, harcèlement, discours de haine en ligne"] },
        { id: "5e-emc-solidarite", title: "La solidarité et ses échelles", notions: ["Fraternité et solidarité nationale", "Risques sociaux et Sécurité sociale", "Solidarité face aux risques, santé (ODD 3), engagement associatif"] },
      ],
    },
    {
      subject: "SVT",
      source: "Programme de SVT du cycle 4, BO n° 31 du 30 juillet 2020",
      verifie: true,
      cycleWide: true,
      chapters: [
        { id: "c4-svt-terre", title: "La planète Terre, l'environnement et l'action humaine", notions: ["Phénomènes géologiques liés au fonctionnement de la Terre", "Météorologie et climatologie", "Risques, ressources et écosystèmes : l'action humaine"] },
        { id: "c4-svt-vivant", title: "Le vivant et son évolution", notions: ["Organisation et fonctionnement du monde vivant à différentes échelles", "Nutrition des organismes, reproduction, diversité génétique", "Biodiversité et évolution"] },
        { id: "c4-svt-corps", title: "Le corps humain et la santé", notions: ["Activités musculaire, nerveuse, cardio-vasculaire et respiratoire", "Alimentation et digestion", "Microorganismes et défenses de l'organisme", "Puberté et reproduction"] },
      ],
    },
    {
      subject: "Physique-chimie",
      source: "Programme de physique-chimie du cycle 4, BO n° 31 du 30 juillet 2020",
      verifie: true,
      cycleWide: true,
      chapters: [
        { id: "c4-pc-matiere", title: "Organisation et transformations de la matière", notions: ["Constitution et états de la matière", "Transformations physiques et transformations chimiques", "Mélanges, corps purs, masse volumique"] },
        { id: "c4-pc-mouvement", title: "Mouvements et interactions", notions: ["Caractériser un mouvement, vitesse", "Modéliser une action par une force"] },
        { id: "c4-pc-energie", title: "L'énergie et ses conversions", notions: ["Sources, transferts, conversions et formes d'énergie", "Conservation de l'énergie, circuits électriques"] },
        { id: "c4-pc-signaux", title: "Des signaux pour observer et communiquer", notions: ["Signaux lumineux, sonores, radio", "Propagation de la lumière et du son"] },
      ],
    },
    {
      subject: "Technologie",
      source: "Programme de technologie du cycle 4, BO n° 9 du 29 février 2024",
      verifie: true,
      cycleWide: true,
      chapters: [
        { id: "c4-te-usages", title: "Les objets et les systèmes techniques : leurs usages et leurs interactions", notions: ["Évolution des objets et systèmes techniques", "Usages et impacts du numérique", "L'objet dans son environnement, choix et développement durable", "Performances d'un objet"] },
        { id: "c4-te-fonctionnement", title: "Structure, fonctionnement, comportement des objets et systèmes techniques", notions: ["Chaîne d'énergie et chaîne d'information", "Matériaux et procédés", "Données et réseaux informatiques", "Dépanner, réparer, programmer une nouvelle fonctionnalité"] },
        { id: "c4-te-creation", title: "Création, conception, réalisation, innovations", notions: ["Gestion de projet technique", "Prototyper une solution, choisir matériaux et énergie", "Modélisation et fabrication"] },
      ],
    },
    {
      subject: "Vie affective et relationnelle",
      source: "Programme d'éducation à la vie affective et relationnelle, et à la sexualité, collège, BO n° 6 du 6 février 2025 (3 séances par an)",
      verifie: true,
      chapters: [
        { id: "5e-evars-personnalite", title: "Se connaître, vivre et grandir avec son corps", notions: ["Développer librement sa personnalité sans se sentir obligé ou contraint", "Sexe, genre et orientation : respecter les différences", "La santé, état de bien-être physique, mental et social"] },
        { id: "5e-evars-relations", title: "Rencontrer les autres et construire des relations", notions: ["Choisir ses relations, comprendre qu'elles peuvent évoluer", "Relation respectueuse et consentement", "Diversité et non-discrimination"] },
        { id: "5e-evars-societe", title: "Trouver sa place dans la société", notions: ["Distinguer vie publique et vie privée", "Liberté individuelle et réseaux sociaux"] },
      ],
    },
    {
      subject: "Anglais",
      source: "Programme d'anglais pour les classes de collège, BO n° 22 du 29 mai 2025 — 5e : niveau A2 (LVA)",
      verifie: true,
      chapters: [
        { id: "5e-an-portrait", title: "Portrait, autoportrait", notions: ["Parler de soi et des autres", "Le portrait en mots et en images"] },
        { id: "5e-an-quotidien", title: "Le quotidien : lieux, rythmes, saisons", notions: ["Modes de vie, rythmes scolaires, saisons", "Repas, transports, vacances"] },
        { id: "5e-an-imaginaire", title: "Le réel et l'imaginaire", notions: ["Personnages de la littérature anglophone", "Mondes réels, mondes rêvés"] },
        { id: "5e-an-ecole", title: "École et loisirs", notions: ["La vie des élèves anglophones", "Clubs et activités"] },
        { id: "5e-an-langues", title: "Des langues, des lieux, des histoires", notions: ["Diversité de la langue anglaise", "Fêtes et patrimoine (Thanksgiving, Juneteenth…)"] },
        { id: "5e-an-royaume-uni", title: "Le Royaume-Uni (axe obligatoire)", notions: ["Nations et régions du Royaume-Uni", "Repères d'histoire, de géographie et de culture britanniques"] },
      ],
    },
    {
      subject: "Italien",
      source: "Programme d'italien pour les classes de collège, BO n° 22 du 29 mai 2025 — 5e",
      verifie: true,
      chapters: [
        { id: "5e-it-portrait", title: "Portrait, autoportrait", notions: ["Parler de soi et des autres"] },
        { id: "5e-it-quotidien", title: "Le quotidien : lieux, rythmes et saisons", notions: ["Modes de vie et rythmes en Italie"] },
        { id: "5e-it-ecole", title: "École et loisirs", notions: ["La vie des élèves italiens"] },
        { id: "5e-it-imaginaire", title: "Le réel et l'imaginaire", notions: ["Contes et personnages italiens"] },
        { id: "5e-it-langues", title: "Des langues, des lieux, des histoires", notions: ["Régions, villes et patrimoine italiens"] },
        { id: "5e-it-rome", title: "Rome (axe obligatoire)", notions: ["Rome antique et Rome d'aujourd'hui", "Monuments, histoire et culture romaines"] },
      ],
    },
  ],
};

/** « CM2 », « cm2 », « 5ème », « 5e »… → la clé de PROGRAMMES, ou null. */
export function programmeKey(grade: string): string | null {
  const g = grade.trim().toLowerCase().replace(/\s+/g, "").replace(/ème|eme|è$/, "e");
  if (g === "cm2") return "CM2";
  if (g === "5e" || g === "5") return "5e";
  return null;
}

export function programmeFor(grade: string): SubjectProgramme[] | null {
  const key = programmeKey(grade);
  return key ? PROGRAMMES[key] : null;
}

export function findChapter(grade: string, chapterId: string): { subject: SubjectProgramme; chapter: Chapter } | null {
  for (const subject of programmeFor(grade) ?? []) {
    const chapter = subject.chapters.find((c) => c.id === chapterId);
    if (chapter) return { subject, chapter };
  }
  return null;
}

/** The chapter list as Claude sees it in the prompt. */
export function programmeForPrompt(grade: string): string | null {
  const subjects = programmeFor(grade);
  if (!subjects) return null;
  return subjects
    .map((s) => `## ${s.subject}\n${s.chapters.map((c) => `- [${c.id}] ${c.title} : ${c.notions.join(" ; ")}`).join("\n")}`)
    .join("\n\n");
}

/** Chapter ids are unique across classes. */
export function chapterById(chapterId: string): { grade: string; subject: SubjectProgramme; chapter: Chapter } | null {
  for (const [grade, subjects] of Object.entries(PROGRAMMES)) {
    for (const subject of subjects) {
      const chapter = subject.chapters.find((c) => c.id === chapterId);
      if (chapter) return { grade, subject, chapter };
    }
  }
  return null;
}
