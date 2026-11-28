// Programme officiel de l'Éducation nationale, par classe et par matière
// (CM2, 6e, 5e, 4e, 3e),
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
//
// Années scolaires : PROGRAMMES est l'année 2026-2027. Les années suivantes
// (PROGRAMMES_BY_YEAR) reprennent l'année d'avant et ne remplacent que les
// matières dont le programme change (CHANGES_2027). L'année bascule le
// 1er août (schoolYearOn) : avant, Cervelle garde les programmes en vigueur.

import { COMPETENCES } from "./competences";

export interface Chapter {
  id: string;
  title: string;
  /** Ce que le programme attend dans ce chapitre, en quelques mots. */
  notions: string[];
  /** Ce que l'élève doit savoir faire à la fin du chapitre (competences.ts). Vide si non listé. */
  competences?: string[];
}

export interface SubjectProgramme {
  subject: string;
  source: string;
  verifie: boolean;
  /** Le programme fixe des thèmes pour tout le cycle : l'ordre dans l'année dépend du professeur. */
  cycleWide?: boolean;
  chapters: Chapter[];
}

/** Première année scolaire couverte (celle de PROGRAMMES). */
export const SCHOOL_YEAR = "2026-2027";

// SVT et physique-chimie (BO n° 31 du 30 juillet 2020) : thèmes communs aux trois
// années du cycle 4. Les ids « c4-… » sont ceux de la 5e ; forClass les préfixe
// pour la 4e et la 3e.
const SVT_C4: SubjectProgramme = {
  subject: "SVT",
  source: "Programme de SVT du cycle 4, BO n° 31 du 30 juillet 2020",
  verifie: true,
  cycleWide: true,
  chapters: [
    { id: "c4-svt-terre", title: "La planète Terre, l'environnement et l'action humaine", notions: ["Phénomènes géologiques liés au fonctionnement de la Terre", "Météorologie et climatologie", "Risques, ressources et écosystèmes : l'action humaine"] },
    { id: "c4-svt-vivant", title: "Le vivant et son évolution", notions: ["Organisation et fonctionnement du monde vivant à différentes échelles", "Nutrition des organismes, reproduction, diversité génétique", "Biodiversité et évolution"] },
    { id: "c4-svt-corps", title: "Le corps humain et la santé", notions: ["Activités musculaire, nerveuse, cardio-vasculaire et respiratoire", "Alimentation et digestion", "Microorganismes et défenses de l'organisme", "Puberté et reproduction"] },
  ],
};

const PC_C4: SubjectProgramme = {
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
};

/** Même matière pour une autre classe : ids préfixés par la classe (« c4-svt-terre » → « 4e-svt-terre »). */
function forClass(prefix: string, subject: SubjectProgramme): SubjectProgramme {
  return { ...subject, chapters: subject.chapters.map((c) => ({ ...c, id: `${prefix}-${c.id.replace(/^c4-/, "")}` })) };
}

// Français 2020, cycle 4 (en vigueur en 4e et en 3e en 2026-2027) : l'étude de
// la langue est commune aux trois années du cycle, sans découpage annuel.
function francaisLangue2020(prefix: string): Chapter[] {
  return [
    { id: `${prefix}-fr-oral-ecrit`, title: "Oral et écrit", notions: ["Syntaxe de l'oral et de l'écrit, niveaux de langue", "Paroles rapportées : discours direct, indirect, indirect libre", "Liaison et élision"] },
    { id: `${prefix}-fr-phrase`, title: "Grammaire : la phrase simple et la phrase complexe", notions: ["Sujet (même éloigné), COD, COI, compléments circonstanciels, attribut du COD", "Expansions du nom : épithète, complément du nom, apposition", "Classes de mots : déterminants, adjectif et ses degrés, pronoms", "Types et formes de phrases (négative, passive, exclamative, impersonnelle)", "Juxtaposition, coordination, subordination ; subordonnées conjonctive, interrogative indirecte, relative, infinitive, participiale ; fonction du pronom relatif", "Rôle de la ponctuation"] },
    { id: `${prefix}-fr-accords`, title: "Orthographe grammaticale : les accords", notions: ["Accord dans le groupe nominal complexe (tout, chaque, leur…)", "Accord du participe passé avec être et avec avoir (COD placé avant)", "Accord de l'adjectif et du participe passé apposés", "Accord du verbe dans les cas complexes (sujet éloigné, plusieurs sujets, pronom relatif, collectif)"] },
    { id: `${prefix}-fr-conjugaison`, title: "Conjugaison et valeur des temps", notions: ["Radical, marques de mode, de temps et de personne ; verbes pronominaux", "Indicatif (présent, imparfait, futur, passé simple, temps composés), conditionnel présent et passé, impératif, subjonctif présent, passé, imparfait et plus-que-parfait", "Verbes irréguliers : faire, aller, dire, venir, pouvoir, voir, vouloir, prendre, savoir, falloir, valoir", "Construire le passif et analyser ses effets", "Valeur des temps : accompli / non accompli, premier plan / arrière-plan, emplois des modes"] },
    { id: `${prefix}-fr-lexique`, title: "Lexique", notions: ["Formation des mots : dérivation, composition, racines latines et grecques, préfixes et suffixes", "Champ lexical, famille de mots, champ sémantique", "Polysémie, synonymie, antonymie, homonymie", "Dénotation, connotation, niveaux de langue", "Utiliser les dictionnaires"] },
    { id: `${prefix}-fr-discours`, title: "Analyser les textes et les discours", notions: ["Situation d'énonciation et niveaux de langue", "Variation de la langue selon les époques : néologie, emprunts", "Cohérence et organisation d'un texte, connecteurs"] },
  ];
}

// Mathématiques 2020, cycle 4 (en vigueur en 4e et en 3e en 2026-2027) : le texte
// donne les attendus de fin de cycle, sans découpage annuel.
function maths2020(prefix: string): SubjectProgramme {
  return {
    subject: "Mathématiques",
    source: "Programme de mathématiques du cycle 4, BO n° 31 du 30 juillet 2020 (le programme 2026 ne s'applique qu'en 5e cette année)",
    verifie: true,
    cycleWide: true,
    chapters: [
      { id: `${prefix}-ma-relatifs-fractions`, title: "Nombres relatifs et fractions", notions: ["Nombres décimaux et rationnels positifs et négatifs, opposé, inverse", "Comparer, ranger, placer sur une droite graduée", "Calculer avec des relatifs et des fractions, égalité de fractions"] },
      { id: `${prefix}-ma-puissances`, title: "Puissances et racine carrée", notions: ["Puissances d'un nombre (exposants positifs ou négatifs)", "Puissances de 10, notation scientifique, préfixes de nano à giga", "Carrés parfaits de 1 à 144, racine carrée"] },
      { id: `${prefix}-ma-arithmetique`, title: "Arithmétique", notions: ["Multiples, diviseurs, critères de divisibilité par 2, 3, 5, 9 et 10", "Division euclidienne", "Nombres premiers, décomposition en facteurs premiers", "Fractions irréductibles"] },
      { id: `${prefix}-ma-litteral`, title: "Calcul littéral et équations", notions: ["Développer, factoriser, réduire ; distributivité simple et double", "Identité a² − b² = (a − b)(a + b)", "Mettre un problème en équation", "Résoudre des équations du premier degré, équation produit nul, x² = a"] },
      { id: `${prefix}-ma-statistiques`, title: "Statistiques", notions: ["Effectifs et fréquences", "Moyenne, médiane, étendue", "Lire et construire des tableaux et des graphiques, tableur"] },
      { id: `${prefix}-ma-probabilites`, title: "Probabilités", notions: ["Vocabulaire : issue, événement certain, impossible, contraire", "Calculer des probabilités dans des cas simples", "Lien entre fréquence et probabilité"] },
      { id: `${prefix}-ma-proportionnalite`, title: "Proportionnalité et pourcentages", notions: ["Quatrième proportionnelle, coefficient de proportionnalité", "Pourcentages, taux d'évolution, coefficient multiplicateur", "Ratio, partage dans un ratio donné", "Utiliser une formule liant deux grandeurs"] },
      { id: `${prefix}-ma-fonctions`, title: "Fonctions", notions: ["Variable, fonction, image, antécédent ; notations f(x) et x ↦ f(x)", "Tableau de valeurs, graphique, formule", "Fonctions linéaires et affines, représentation graphique"] },
      { id: `${prefix}-ma-grandeurs`, title: "Grandeurs et mesures", notions: ["Grandeurs produits et quotients", "Aire du parallélogramme", "Volumes : prisme, pyramide, cylindre, cône, boule", "Conversions d'unités, 1 L = 1 dm³", "Agrandissement, réduction et échelles"] },
      { id: `${prefix}-ma-geometrie`, title: "Géométrie plane", notions: ["Angles alternes-internes, correspondants, parallélisme", "Triangles : somme des angles, cas d'égalité, triangles semblables", "Théorème de Pythagore et sa réciproque", "Théorème de Thalès et sa réciproque", "Cosinus, sinus, tangente dans le triangle rectangle", "Translation, symétries, rotation, homothétie ; démontrer"] },
      { id: `${prefix}-ma-espace`, title: "Espace et repérage", notions: ["Se repérer dans le plan et dans l'espace : abscisse, ordonnée, altitude", "Latitude et longitude", "Reconnaître et représenter les solides (perspective, patrons, sections)"] },
      { id: `${prefix}-ma-algo`, title: "Algorithmique et programmation", notions: ["Algorithme et programme, variable informatique", "Événements, séquences, boucles, instructions conditionnelles", "Écrire, tester et corriger un programme (Scratch)"] },
    ],
  };
}

// Langues vivantes 2020, cycle 4 (en vigueur en 4e et en 3e en 2026-2027) : quatre
// thèmes culturels pour tout le cycle, traités dans l'ordre choisi par le professeur.
function langue2020(prefix: string, subject: "Anglais" | "Italien", aire: string, code: string): SubjectProgramme {
  return {
    subject,
    source: `Programme de langues vivantes du cycle 4, BO n° 31 du 30 juillet 2020 (objectif fin de cycle : A2 à B1 en LV1, A2 en LV2)`,
    verifie: true,
    cycleWide: true,
    chapters: [
      { id: `${prefix}-${code}-langages`, title: "Langages", notions: ["Médias, réseaux sociaux, publicité", `Arts dans les pays ${aire} : peinture, musique, poésie, cinéma, BD`, "Codes socio-culturels, cartes et repères"] },
      { id: `${prefix}-${code}-ecole-societe`, title: "École et société", notions: ["Comparer les systèmes scolaires", "Environnement au quotidien : eau, déchets, recyclage, énergie", "Loisirs, monde du travail et métiers"] },
      { id: `${prefix}-${code}-voyages`, title: "Voyages et migrations", notions: ["Voyages scolaires et tourisme, tourisme écoresponsable", "Exil, migration et émigration", "L'imaginaire, le rêve, le fantastique"] },
      { id: `${prefix}-${code}-rencontres`, title: "Rencontres avec d'autres cultures", notions: ["Repères historiques et géographiques, patrimoine", "Parcs nationaux, climat et biodiversité", "Inclusion et exclusion"] },
      { id: `${prefix}-${code}-grammaire`, title: "Grammaire", notions: ["Genre, pronoms compléments et réfléchis, articles et quantifieurs", "Exprimer le présent, le passé et l'avenir ; modaux ; passif", "Coordination, subordination, relatifs, connecteurs", "Discours indirect, interrogation indirecte"] },
      { id: `${prefix}-${code}-phonologie`, title: "Prononciation", notions: ["Régularités de la langue orale", "Fluidité et intelligibilité (pas d'« accent natif » exigé)"] },
    ],
  };
}

/** Rattache à chaque chapitre ses compétences officielles (competences.ts). */
function withCompetences(programmes: Record<string, SubjectProgramme[]>): Record<string, SubjectProgramme[]> {
  const out: Record<string, SubjectProgramme[]> = {};
  for (const [grade, subjects] of Object.entries(programmes)) {
    out[grade] = subjects.map((s) => ({ ...s, chapters: s.chapters.map((c) => (COMPETENCES[c.id] ? { ...c, competences: COMPETENCES[c.id] } : c)) }));
  }
  return out;
}

export const PROGRAMMES: Record<string, SubjectProgramme[]> = withCompetences({
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
    SVT_C4,
    PC_C4,
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
  "6e": [
    {
      subject: "Français",
      source: "Programme de français du cycle 3, BO n° 16 du 17 avril 2025 — Sixième",
      verifie: true,
      chapters: [
        { id: "6e-fr-lecture", title: "Lire avec fluidité et comprendre", notions: ["Lire à voix haute avec un phrasé adapté, environ 130 mots par minute", "Informations explicites et implicites, liens logiques, reprises nominales", "Rattacher un texte à son genre, justifier son interprétation", "Comparer des documents de genres différents, lire une image"] },
        { id: "6e-fr-origines", title: "Créer, recréer le monde : récits des origines", notions: ["Textes fondateurs (dont ceux des religions monothéistes)", "Mythes et contes étiologiques de différents continents", "Symboles et métaphores, valeurs portées par ces récits"] },
        { id: "6e-fr-poesie", title: "Chanter et enchanter le monde : mots et merveilles", notions: ["La poésie : vers, rimes, images", "Le pouvoir d'évocation du langage poétique", "Poésies de différentes traditions, y compris francophones"] },
        { id: "6e-fr-theatre", title: "Se masquer, jouer, déjouer : ruses en action", notions: ["Le théâtre : illusion et réel, être et paraître", "La ruse, ressort dramatique et comique", "Mise en voix, mise en jeu, mise en scène"] },
        { id: "6e-fr-aventure", title: "Partir à l'aventure !", notions: ["Le récit d'aventure et son élan", "Écrire un récit personnel"] },
        { id: "6e-fr-monstres", title: "Rencontrer des monstres : expérience de l'autre, expérience de soi", notions: ["La part d'humanité du monstre : peur ou compassion", "La visée éducative du conte", "Créer un monstre et le mettre en récit"] },
        { id: "6e-fr-ecrire", title: "Écriture", notions: ["Copier sans erreur, soigner la présentation", "Résumer, synthétiser, hiérarchiser des idées", "Donner un avis justifié, écrire un récit, expliquer une démarche", "Utiliser le brouillon, réviser son texte"] },
        { id: "6e-fr-oral", title: "Oral", notions: ["Comprendre un message, une interview, un reportage, reformuler", "Exposé : raconter, expliquer, argumenter devant un public", "Participer à un échange en respectant les codes"] },
        { id: "6e-fr-vocabulaire", title: "Vocabulaire", notions: ["Comprendre un mot inconnu : déduire, vérifier, chercher", "Mots simples, dérivés, composés", "Synonymes et antonymes de même classe grammaticale", "Étymologie et évolution du sens des mots, mots polysémiques"] },
        { id: "6e-fr-phrase", title: "Grammaire : la phrase", notions: ["Constituants de la phrase simple", "Attribut du sujet ou COD", "Pronoms personnels, leur fonction et leur antécédent", "Groupe nominal : épithète ou complément du nom", "Phrase complexe : propositions juxtaposées, coordonnées, subordonnées ; conjonctions de coordination et de subordination"] },
        { id: "6e-fr-accords", title: "Orthographe grammaticale : les accords", notions: ["Chaîne d'accords dans le groupe nominal", "Accord sujet-verbe", "Accord du participe passé avec être, et avec avoir quand le COD (pronom) est placé avant"] },
        { id: "6e-fr-conjugaison", title: "Conjugaison", notions: ["Temps composés : passé composé et plus-que-parfait (auxiliaire + participe passé)", "Impératif présent et conditionnel présent", "Être, avoir, 1er et 2e groupes, et faire, aller, dire, venir, pouvoir, voir, vouloir, prendre", "Premières valeurs des temps : temps du discours et temps du récit"] },
      ],
    },
    {
      subject: "Mathématiques",
      source: "Programme de mathématiques du cycle 3, BO n° 16 du 17 avril 2025 — Sixième",
      verifie: true,
      chapters: [
        { id: "6e-ma-decimaux", title: "Nombres entiers et décimaux", notions: ["Valeur des chiffres selon leur rang, grands nombres jusqu'au milliard", "Écritures d'un décimal : virgule, fraction, nombre mixte, pourcentage", "Comparer, ranger, encadrer, placer sur une demi-droite graduée", "Arrondir à l'unité, au dixième, au centième"] },
        { id: "6e-ma-operations", title: "Opérations sur les décimaux", notions: ["Additionner et soustraire des décimaux", "Multiplier par 0,1, 0,01, 0,001 ; lien avec la division par 10, 100, 1 000", "Multiplier deux décimaux, ordres de grandeur", "Division décimale par un entier inférieur à 10, division euclidienne"] },
        { id: "6e-ma-fractions", title: "Les fractions", notions: ["La fraction comme quotient : a/b est le nombre qui multiplié par b donne a", "Égalités de fractions, comparer, encadrer, ranger", "Additionner et soustraire des fractions, multiplier une fraction par un entier", "Appliquer une fraction à un nombre"] },
        { id: "6e-ma-pourcentages", title: "Pourcentages", notions: ["Comprendre le sens d'un pourcentage", "Exprimer une proportion en pourcentage", "Appliquer un pourcentage à une grandeur"] },
        { id: "6e-ma-algebre", title: "Initiation à l'algèbre", notions: ["Modèles pré-algébriques pour résoudre des problèmes", "Motifs évolutifs : repérer une régularité"] },
        { id: "6e-ma-grandeurs", title: "Longueurs, aires, volumes et durées", notions: ["Périmètre et formule du périmètre du disque", "Conversions d'aires, aire du carré et du rectangle", "Volume : le centimètre cube", "Calculs sur les horaires et les durées, conversions"] },
        { id: "6e-ma-geometrie", title: "Géométrie plane", notions: ["Distance entre deux points, milieu d'un segment", "Cercle, disque, rayon, diamètre, corde", "Médiatrice d'un segment et sa propriété", "Angles : vocabulaire, mesure, construction ; bissectrice", "Triangles particuliers, somme des angles = 180°, cercle circonscrit", "Symétrie axiale"] },
        { id: "6e-ma-espace", title: "Vision dans l'espace", notions: ["Reconnaître les solides : cube, pavé, prisme, pyramide, cylindre, cône, boule", "Assemblages de cubes"] },
        { id: "6e-ma-donnees", title: "Données et probabilités", notions: ["Mener une enquête statistique, construire un tableau", "Filtrer les données d'un tableau", "Une probabilité est un nombre entre 0 et 1", "Calculer des probabilités simples, comparer avec une expérience répétée"] },
        { id: "6e-ma-proportionnalite", title: "Proportionnalité", notions: ["Reconnaître une situation de proportionnalité", "Résoudre un problème : linéarité (multiplication, addition), retour à l'unité", "Tableau de proportionnalité", "Problèmes d'échelles"] },
        { id: "6e-ma-info", title: "Pensée informatique", notions: ["Instructions et séquences d'instructions", "Répéter une séquence (boucle)", "Programmer un chemin simple"] },
      ],
    },
    {
      subject: "Histoire",
      source: "Programme d'histoire du cycle 3, BO n° 31 du 30 juillet 2020 — Classe de sixième",
      verifie: true,
      chapters: [
        { id: "6e-hi-humanite", title: "La longue histoire de l'humanité et des migrations", notions: ["Les débuts de l'humanité", "La « révolution » néolithique : agriculture, élevage, sédentarisation", "Premiers États, premières écritures (Égypte ou Mésopotamie)"] },
        { id: "6e-hi-mediterranee", title: "Récits fondateurs, croyances et citoyenneté dans la Méditerranée antique au Ier millénaire avant J.-C.", notions: ["Le monde des cités grecques, la naissance de la démocratie à Athènes", "Rome du mythe à l'histoire", "La naissance du monothéisme juif dans un monde polythéiste"] },
        { id: "6e-hi-rome", title: "L'empire romain dans le monde antique", notions: ["Conquêtes, paix romaine et romanisation", "Des chrétiens dans l'empire", "Les relations avec les autres mondes anciens : la route de la soie et la Chine des Han"] },
      ],
    },
    {
      subject: "Géographie",
      source: "Programme de géographie du cycle 3, BO n° 31 du 30 juillet 2020 — Classe de sixième",
      verifie: true,
      chapters: [
        { id: "6e-ge-metropole", title: "Habiter une métropole", notions: ["Les métropoles et leurs habitants (pays développé et pays émergent)", "La ville de demain"] },
        { id: "6e-ge-faible-densite", title: "Habiter un espace de faible densité", notions: ["Espace à fortes contraintes naturelles ou de grande biodiversité", "Espace de faible densité à vocation agricole"] },
        { id: "6e-ge-littoraux", title: "Habiter les littoraux", notions: ["Littoral industrialo-portuaire", "Littoral touristique"] },
        { id: "6e-ge-monde-habite", title: "Le monde habité", notions: ["La répartition de la population mondiale et ses dynamiques", "La variété des formes d'occupation spatiale dans le monde"] },
      ],
    },
    {
      subject: "Sciences et technologie",
      source: "Programme de sciences et technologie du cycle 3, BO n° 25 du 22 juin 2023 (attendus de fin de sixième)",
      verifie: true,
      chapters: [
        { id: "6e-st-matiere", title: "La matière", notions: ["Trier les matériaux selon leurs propriétés (conductivité, aimant), durée de décomposition", "Températures et paliers de changement d'état", "Masse et volume, conversions, proportionnalité masse-volume", "Mesurer un volume de gaz, liquides non miscibles"] },
        { id: "6e-st-mouvement", title: "Mouvements et vitesse", notions: ["Calculer une vitesse (mouvement uniforme)", "Vitesse constante ou variable", "Année = révolution de la Terre autour du Soleil, jour = rotation"] },
        { id: "6e-st-energie", title: "L'énergie", notions: ["Formes d'énergie : pesanteur, cinétique, chimique, thermique, électrique, nucléaire, lumineuse", "Chaîne énergétique", "Ressources renouvelables ou non, conséquences sur l'environnement"] },
        { id: "6e-st-signaux", title: "Lumière, électricité et signaux", notions: ["Alternance jour-nuit et saisons", "Circuit à une boucle avec moteur, capteur ; schéma normalisé", "Sécurité électrique", "Signaux pour transmettre une information"] },
        { id: "6e-st-vivant", title: "Le vivant : cellules, classification, biodiversité", notions: ["La cellule, unité de tous les êtres vivants ; observer au microscope", "Classer les êtres vivants, lire un arbre de parenté", "Diversité au sein d'une espèce, clé de détermination", "Biodiversité passée, grandes crises biologiques"] },
        { id: "6e-st-alimentation", title: "Alimentation et santé", notions: ["Comportements alimentaires favorables à la santé", "Diversité des aliments selon les cultures", "Conserver les aliments, limiter les risques", "Fermentations par des microorganismes"] },
        { id: "6e-st-reproduction", title: "Reproduction et puberté", notions: ["Pollinisation : de la fleur au fruit, coopération avec les pollinisateurs, effet des pesticides", "Appareil reproducteur humain et ses fonctions", "Puberté, fécondation interne, développement et placenta", "Reproduction et sexualité humaine"] },
        { id: "6e-st-terre", title: "La Terre et le climat", notions: ["Conditions de la vie sur Terre, place dans le système solaire", "Réchauffement climatique récent et gaz à effet de serre", "Conséquences et stratégies d'atténuation ou d'adaptation"] },
        { id: "6e-st-ecosystemes", title: "Écosystèmes", notions: ["Composantes d'un paysage, milieu et peuplement", "Changements au fil des saisons, perturbations", "Production primaire des végétaux, chaînes alimentaires", "Décomposition de la matière organique dans le sol"] },
      ],
    },
    {
      subject: "Enseignement moral et civique",
      source: "Programme d'EMC, BO n° 24 du 13 juin 2024 — 6e : Apprendre à vivre dans une société démocratique",
      verifie: true,
      chapters: [
        { id: "6e-emc-representer", title: "Représenter les autres et servir l'intérêt général", notions: ["Représentants élus, du délégué de classe au Parlement européen", "Le vote", "L'intérêt général et le développement durable", "Responsabilité des élus"] },
        { id: "6e-emc-laicite", title: "Respecter des règles : l'exemple de la laïcité à l'École", notions: ["Liberté de conscience et égalité des citoyens", "Loi de 1905 : neutralité de l'État, libre exercice des cultes", "Loi du 15 mars 2004 et Charte de la laïcité"] },
        { id: "6e-emc-vie-privee", title: "Le droit à la vie privée", notions: ["Intimité et droit à l'image", "Majorité numérique à 15 ans", "Données personnelles, traces et réputation numériques"] },
      ],
    },
    {
      subject: "Vie affective et relationnelle",
      source: "Programme d'éducation à la vie affective et relationnelle, et à la sexualité, collège, BO n° 6 du 6 février 2025 — Sixième (3 séances par an)",
      verifie: true,
      chapters: [
        { id: "6e-evars-corps", title: "Se connaître, vivre et grandir avec son corps", notions: ["Les changements de la puberté, à des rythmes différents pour chacun", "Les règles ; des règles douloureuses demandent une consultation"] },
        { id: "6e-evars-relations", title: "Rencontrer les autres et construire des relations", notions: ["Les relations peuvent changer", "Influence des pairs", "Vie privée et intimité en ligne, cyberharcèlement"] },
        { id: "6e-evars-societe", title: "Trouver sa place dans la société", notions: ["Règles, normes, modèles et stéréotypes", "Être soi-même et respecter les autres", "Coopération et entraide"] },
      ],
    },
    {
      subject: "Anglais",
      source: "Programme d'anglais pour les classes de collège, BO n° 22 du 29 mai 2025 — 6e : niveau A1 vers A1+ (les cinq axes sont étudiés dans l'année)",
      verifie: true,
      chapters: [
        { id: "6e-an-personnages", title: "Personnes et personnages", notions: ["Familles fictives et réelles", "Journal de bord, journal intime", "Animaux et leçons de vie dans les fictions"] },
        { id: "6e-an-quotidien", title: "Le quotidien : vivre, jouer, apprendre", notions: ["L'école et son organisation", "Sports populaires et traditionnels", "Lieux de vie et vacances des jeunes anglophones"] },
        { id: "6e-an-paysages", title: "Pays et paysages", notions: ["Le Mississippi, les Highlands, les parcs du Kenya", "Mers et océans des pays anglophones"] },
        { id: "6e-an-imaginaire", title: "Imaginaire, contes et légendes", notions: ["Le dragon, sorciers et magiciens", "L'Irlande, terre de mythes", "L'univers du Dr. Seuss"] },
        { id: "6e-an-arts", title: "Arts et expression des sentiments", notions: ["Musique et art", "Fêtes de fin d'année"] },
        { id: "6e-an-grammaire", title: "Grammaire", notions: ["Présent simple, be et have, 3e personne du singulier (-s)", "Can, must, impératif ; présent be + -ing ; premiers prétérits (was, went…)", "Articles, this/that, pluriels irréguliers, possessifs, génitif ('s)", "Pronoms sujets et compléments, mots interrogatifs", "Dates, prépositions de lieu, connecteurs and, but, or, then"] },
        { id: "6e-an-phonologie", title: "Prononciation", notions: ["Le -s de la 3e personne et du génitif", "Voyelles longues et courtes, diphtongues", "Lettres muettes, accent et intonation"] },
      ],
    },
  ],
  "4e": [
    {
      subject: "Français",
      source: "Programme de français du cycle 4, BO n° 31 du 30 juillet 2020 — Quatrième (le programme 2026 ne s'applique qu'en 5e cette année)",
      verifie: true,
      chapters: [
        { id: "4e-fr-amour", title: "Dire l'amour", notions: ["Poèmes d'amour de l'Antiquité à nos jours", "Les nuances du sentiment amoureux", "Images et références dans la poésie amoureuse"] },
        { id: "4e-fr-individu-societe", title: "Individu et société : confrontations de valeurs ?", notions: ["Tragédie ou tragicomédie du XVIIe siècle, ou comédie du XVIIIe siècle", "Conflits et valeurs des personnages", "Conciliations possibles ou non entre les valeurs"] },
        { id: "4e-fr-reel", title: "La fiction pour interroger le réel", notions: ["Roman et nouvelle réalistes ou naturalistes du XIXe siècle", "La nouvelle fantastique et les limites du réel", "Représentation de la société et des personnages"] },
        { id: "4e-fr-informer", title: "Informer, s'informer, déformer ?", notions: ["Articles, reportages, images d'information", "Vérifier et recouper les sources ; fait brut et information", "Propagande et manipulation de l'information"] },
        { id: "4e-fr-ville", title: "La ville, lieu de tous les possibles ? (questionnement complémentaire)", notions: ["La ville chez les poètes et les romanciers", "Lieu de liberté ou de solitude", "La ville dans le roman policier et d'anticipation"] },
        ...francaisLangue2020("4e"),
      ],
    },
    maths2020("4e"),
    {
      subject: "Histoire",
      source: "Programme d'histoire du cycle 4, BO n° 31 du 30 juillet 2020 — Classe de 4e",
      verifie: true,
      chapters: [
        { id: "4e-hi-xviiie", title: "Le XVIIIe siècle. Expansions, Lumières et révolutions", notions: ["Bourgeoisies marchandes, négoces internationaux, traites négrières et esclavage", "L'Europe des Lumières : circulation des idées, despotisme éclairé, contestation de l'absolutisme", "La Révolution française et l'Empire : nouvel ordre politique en France et en Europe"] },
        { id: "4e-hi-xixe-monde", title: "L'Europe et le monde au XIXe siècle", notions: ["L'Europe de la « révolution industrielle »", "Conquêtes et sociétés coloniales"] },
        { id: "4e-hi-france-xixe", title: "Société, culture et politique dans la France du XIXe siècle", notions: ["Une difficile conquête : voter de 1815 à 1870", "La Troisième République", "Conditions féminines dans une société en mutation"] },
      ],
    },
    {
      subject: "Géographie",
      source: "Programme de géographie du cycle 4, BO n° 31 du 30 juillet 2020 — Classe de 4e",
      verifie: true,
      chapters: [
        { id: "4e-ge-urbanisation", title: "L'urbanisation du monde", notions: ["Espaces et paysages de l'urbanisation : centres et périphéries", "Des villes inégalement connectées aux réseaux de la mondialisation"] },
        { id: "4e-ge-mobilites", title: "Les mobilités humaines transnationales", notions: ["Un monde de migrants", "Le tourisme et ses espaces"] },
        { id: "4e-ge-mondialisation", title: "Des espaces transformés par la mondialisation", notions: ["Mers et océans : un monde maritimisé", "L'adaptation du territoire des États-Unis à la mondialisation", "Les dynamiques d'un grand ensemble africain (Afrique de l'Ouest, orientale ou australe)"] },
      ],
    },
    {
      subject: "Enseignement moral et civique",
      source: "Programme d'EMC, BO n° 24 du 13 juin 2024 — 4e : Défendre les droits et les libertés",
      verifie: true,
      chapters: [
        { id: "4e-emc-etat-droit", title: "L'État de droit et les libertés", notions: ["Libertés individuelles et collectives (expression, réunion, association, presse)", "Des libertés limitées par la loi et l'ordre public", "État de droit et hiérarchie des normes, Conseil constitutionnel", "Indépendance de la justice, Cour européenne des droits de l'homme"] },
        { id: "4e-emc-defense", title: "Défendre le cadre démocratique : sécurité et défense nationale", notions: ["La sûreté, droit de l'homme ; police, gendarmerie, pompiers, douanes", "Les forces armées et la souveraineté nationale", "Cyberdéfense et guerre informationnelle", "Police de l'environnement"] },
      ],
    },
    forClass("4e", SVT_C4),
    forClass("4e", PC_C4),
    {
      subject: "Technologie",
      source: "Programme de technologie du cycle 4, BO n° 9 du 29 février 2024 — repères de la classe de 4e",
      verifie: true,
      chapters: [
        { id: "4e-te-usages", title: "Usages et évolutions des objets techniques", notions: ["Relier un objet à ses usages, justifier son évolution", "Avantages et inconvénients des évolutions technologiques", "Usage raisonné du numérique : propriété intellectuelle, identité numérique, cookies, géolocalisation"] },
        { id: "4e-te-choisir", title: "Choisir un objet technique", notions: ["Expérience de l'utilisateur, contraintes et exigences (sécurité, ergonomie, environnement)", "Comparer des objets : bilan carbone, efficacité énergétique", "Mesurer une performance avec le bon appareil"] },
        { id: "4e-te-chaines", title: "Chaîne d'énergie, chaîne d'information, matériaux", notions: ["Constituants de la chaîne d'énergie et leurs fonctions", "Constituants de la chaîne d'information", "Forme d'une pièce et procédé de réalisation"] },
        { id: "4e-te-donnees-reseaux", title: "Données et réseaux", notions: ["Transformation et structure des données d'un objet", "Adresse IP fixe, réseau local, communication entre terminaux"] },
        { id: "4e-te-reparer-programmer", title: "Dépanner et programmer", notions: ["Protocole pour trouver une panne, remplacer une pièce", "Compléter et tester un programme pour une fonctionnalité"] },
        { id: "4e-te-concevoir", title: "Concevoir et prototyper", notions: ["Organiser un projet en tâches", "Ajouter une fonction à un objet : croquis, schéma, modélisation", "Choisir matériaux et sources d'énergie, tester la tenue mécanique"] },
      ],
    },
    {
      subject: "Vie affective et relationnelle",
      source: "Programme d'éducation à la vie affective et relationnelle, et à la sexualité, collège, BO n° 6 du 6 février 2025 — Quatrième (3 séances par an)",
      verifie: true,
      chapters: [
        { id: "4e-evars-corps", title: "Se connaître, vivre et grandir avec son corps", notions: ["Les différents aspects de la sexualité, sa diversité", "Comprendre et gérer ses émotions", "Où s'informer, se faire dépister ou soigner (vaccin HPV…)"] },
        { id: "4e-evars-relations", title: "Rencontrer les autres et construire des relations", notions: ["Relation, réciprocité et consentement", "Réseaux sociaux et regard des autres", "Choix responsables pour sa santé, prévention des IST", "Savoir demander de l'aide"] },
        { id: "4e-evars-societe", title: "Trouver sa place dans la société", notions: ["Normes, modèles et stéréotypes", "Égalité et inégalités dans les représentations", "Décrypter les images de la sexualité dans les médias, interdiction de la pornographie aux mineurs"] },
      ],
    },
    langue2020("4e", "Anglais", "anglophones", "an"),
    langue2020("4e", "Italien", "italophones", "it"),
  ],
  "3e": [
    {
      subject: "Français",
      source: "Programme de français du cycle 4, BO n° 31 du 30 juillet 2020 — Troisième (le programme 2026 ne s'applique qu'en 5e cette année)",
      verifie: true,
      chapters: [
        { id: "3e-fr-soi", title: "Se raconter, se représenter", notions: ["Autobiographie, roman autobiographique, mémoires, journal", "Pourquoi se raconter : saisie de soi, recherche de la vérité", "L'autoportrait dans les autres arts"] },
        { id: "3e-fr-satire", title: "Dénoncer les travers de la société", notions: ["La satire : poésie, fable, conte philosophique, pamphlet", "Ironie, grossissement, caricature", "Dessins de presse et bande dessinée"] },
        { id: "3e-fr-poesie", title: "Visions poétiques du monde", notions: ["La poésie du romantisme à nos jours", "Le rapport à la nature, le « chant du monde »", "Ressources de la langue poétique"] },
        { id: "3e-fr-cite", title: "Agir dans la cité : individu et pouvoir", notions: ["Œuvres du XXe siècle sur les guerres mondiales et les totalitarismes", "Engagement et résistance", "La littérature au-delà du témoignage"] },
        { id: "3e-fr-progres", title: "Progrès et rêves scientifiques (questionnement complémentaire)", notions: ["Le progrès scientifique, exalté ou redouté", "La figure du savant", "Science-fiction, utopies et dystopies"] },
        ...francaisLangue2020("3e"),
      ],
    },
    maths2020("3e"),
    {
      subject: "Histoire",
      source: "Programme d'histoire du cycle 4, BO n° 31 du 30 juillet 2020 — Classe de 3e",
      verifie: true,
      chapters: [
        { id: "3e-hi-guerres", title: "L'Europe, un théâtre majeur des guerres totales (1914-1945)", notions: ["Civils et militaires dans la Première Guerre mondiale", "Démocraties fragilisées et expériences totalitaires dans l'entre-deux-guerres", "La Deuxième Guerre mondiale, une guerre d'anéantissement", "La France défaite et occupée : Vichy, collaboration, Résistance"] },
        { id: "3e-hi-monde-1945", title: "Le monde depuis 1945", notions: ["Indépendances et construction de nouveaux États", "Un monde bipolaire au temps de la guerre froide", "Affirmation et mise en œuvre du projet européen", "Enjeux et conflits dans le monde après 1989"] },
        { id: "3e-hi-republique", title: "Françaises et Français dans une République repensée", notions: ["1944-1947 : refonder la République, redéfinir la démocratie", "La Ve République, de la République gaullienne à l'alternance et à la cohabitation", "Femmes et hommes dans la société des années 1950 aux années 1980"] },
      ],
    },
    {
      subject: "Géographie",
      source: "Programme de géographie du cycle 4, BO n° 31 du 30 juillet 2020 — Classe de 3e",
      verifie: true,
      chapters: [
        { id: "3e-ge-dynamiques", title: "Dynamiques territoriales de la France contemporaine", notions: ["Les aires urbaines, une nouvelle géographie d'une France mondialisée", "Les espaces productifs et leurs évolutions", "Les espaces de faible densité et leurs atouts"] },
        { id: "3e-ge-amenager", title: "Pourquoi et comment aménager le territoire ?", notions: ["Aménager pour répondre aux inégalités entre territoires", "Les territoires ultramarins français"] },
        { id: "3e-ge-ue", title: "La France et l'Union européenne", notions: ["L'Union européenne, un nouveau territoire de référence et d'appartenance", "La France et l'Europe dans le monde"] },
      ],
    },
    {
      subject: "Enseignement moral et civique",
      source: "Programme d'EMC, BO n° 24 du 13 juin 2024 — 3e : Faire vivre la démocratie",
      verifie: true,
      chapters: [
        { id: "3e-emc-regles", title: "Les règles du jeu démocratique", notions: ["La Constitution de la Ve République, séparation des pouvoirs", "Une République laïque", "Les institutions européennes et la citoyenneté européenne"] },
        { id: "3e-emc-opinion", title: "Les acteurs du jeu démocratique : l'opinion", notions: ["Opinion publique, médias, sondages", "Information, désinformation, complotisme, intelligence artificielle", "Les lanceurs d'alerte"] },
        { id: "3e-emc-engagement", title: "Les acteurs du jeu démocratique : l'engagement", notions: ["Élections et référendums", "Engagement politique, syndical, associatif", "Le droit de manifester"] },
      ],
    },
    forClass("3e", SVT_C4),
    forClass("3e", PC_C4),
    {
      subject: "Technologie",
      source: "Programme de technologie du cycle 4, BO n° 9 du 29 février 2024 — repères de la classe de 3e",
      verifie: true,
      chapters: [
        { id: "3e-te-innovations", title: "Innovations et société", notions: ["Innovations de rupture dans l'évolution d'un objet", "D'une découverte scientifique à ses applications", "Effets d'un objet sur la société, place du numérique dans les métiers"] },
        { id: "3e-te-choisir", title: "Choisir un objet technique", notions: ["Représenter l'expérience de l'utilisateur", "Choisir selon le cycle de vie et les trois piliers du développement durable", "Coût, performances, indice de réparabilité ; protocole de mesure"] },
        { id: "3e-te-chaines", title: "Chaîne d'énergie, chaîne d'information, matériaux", notions: ["Schéma bloc de la chaîne d'énergie", "Caractériser la chaîne d'information, grandeurs analogiques et données", "Choisir un matériau et son procédé de mise en forme"] },
        { id: "3e-te-donnees-reseaux", title: "Données et réseaux", notions: ["Représenter et stocker les informations (texte, image, nombre)", "Circulation d'une information sur Internet, routage"] },
        { id: "3e-te-reparer-programmer", title: "Dépanner et programmer", notions: ["Hypothèses, protocole de dépannage puis de réparation", "Programmer un algorithme pour une nouvelle fonctionnalité, sous-programmes"] },
        { id: "3e-te-concevoir", title: "Concevoir et prototyper", notions: ["Élaborer un processus de conception", "Proposer et fabriquer un nouvel objet, assembler un prototype", "Interfacer deux objets communicants, simuler et tester"] },
      ],
    },
    {
      subject: "Vie affective et relationnelle",
      source: "Programme d'éducation à la vie affective et relationnelle, et à la sexualité, collège, BO n° 6 du 6 février 2025 — Troisième (3 séances par an)",
      verifie: true,
      chapters: [
        { id: "3e-evars-corps", title: "Se connaître, vivre et grandir avec son corps", notions: ["Émotions, bonheur et sexualité", "Désir et comportement : maîtriser ses impulsions", "Les mutilations sexuelles féminines, une atteinte aux droits"] },
        { id: "3e-evars-relations", title: "Rencontrer les autres et construire des relations", notions: ["Consentement, réciprocité, accepter un refus", "Risques et prévention (IST, VIH, contraception)", "Reconnaître l'emprise et les violences, y compris en ligne"] },
        { id: "3e-evars-societe", title: "Trouver sa place dans la société", notions: ["Droits et devoirs, égalité entre les femmes et les hommes", "Reconnaître les violences et les discriminations", "Les victimes ne sont jamais responsables ; où trouver de l'aide"] },
      ],
    },
    langue2020("3e", "Anglais", "anglophones", "an"),
    langue2020("3e", "Italien", "italophones", "it"),
  ],
});

// ---------------------------------------------------------------------------
// 2027-2028 : nouveaux programmes au CM2 et en 6e (article 3 de chaque arrêté) :
//   - sciences et technologie, BO n° 24 du 11 juin 2026 (CM2 et 6e) ;
//   - EPS et histoire-géographie, BO n° 22 du 28 mai 2026 (CM2 et 6e) ;
//   - langues vivantes de l'école élémentaire, BO n° 12 du 19 mars 2026 (CM2).
// Chaque entrée remplace la matière du même nom (ou s'ajoute) pour la classe.
// Ids nouveaux, préfixés « 27- » : les révisions déjà rangées gardent les leurs.
const HG_SRC = "Programme d'histoire-géographie du cycle 3, BO n° 22 du 28 mai 2026 (en vigueur au CM2 et en 6e à la rentrée 2027)";
const EPS_SRC = "Programme d'éducation physique et sportive du cycle 3, BO n° 22 du 28 mai 2026 (en vigueur au CM2 et en 6e à la rentrée 2027)";

const HISTOIRE_CM2_2027: SubjectProgramme = {
  subject: "Histoire",
  source: `${HG_SRC} — Cours moyen deuxième année`,
  verifie: true,
  chapters: [
    { id: "27-cm2-hi-republique-empire", title: "De la République à l'Empire (1792-1815)", notions: ["La chute du roi et la naissance de la République en pleine guerre (septembre 1792)", "Mars 1792 : la pétition de 319 femmes (Pauline Léon) ; avril 1792 : La Marseillaise", "1794 : première abolition de l'esclavage ; 1802 : son rétablissement", "Comment Bonaparte devient empereur : sacre de Napoléon Ier le 2 décembre 1804", "Les réformes de Napoléon : Code civil, lycées, préfets"] },
    { id: "27-cm2-hi-france-republicaine", title: "Vers une France républicaine (1848-1914)", notions: ["1848 : suffrage universel masculin et abolition définitive de l'esclavage", "1882-1886 : lois Ferry sur l'École ; 9 décembre 1905 : séparation des Églises et de l'État (laïcité)", "Les symboles de la République : drapeau tricolore, 14 juillet, Marianne, La Marseillaise, la devise", "La liberté de la presse", "L'empire colonial français au début du XXe siècle, sur un planisphère"] },
    { id: "27-cm2-hi-industriel", title: "L'âge industriel en France au XIXe siècle", notions: ["Les progrès techniques : nouvelles énergies, chemin de fer (locomotive de Stephenson), usines", "Les progrès de la médecine : le vaccin contre la rage de Pasteur", "La vie des ouvriers (mine, atelier, usine) et celle des bourgeois", "Grèves et syndicats : droit de grève et liberté syndicale", "Une société encore très rurale, des villes qui grandissent (urbanisation)"] },
    { id: "27-cm2-hi-premiere-guerre", title: "La France dans la Première Guerre mondiale (1914-1918)", notions: ["Les combats du front occidental, au nord et à l'est de la France", "La vie des poilus : guerre de mouvement, puis guerre de position", "Toute la population mobilisée, le rôle des femmes, l'aide des colonies", "11 novembre 1918 : l'armistice", "Le bilan : 10 millions de morts au combat, dont 1,4 million de Français"] },
    { id: "27-cm2-hi-seconde-guerre", title: "La France pendant la Seconde Guerre mondiale (1939-1945)", notions: ["Les étapes : « drôle de guerre », défaite de juin 1940, Occupation et collaboration, Libération", "18 juin 1940 : l'appel du général de Gaulle ; Jean Moulin et la Résistance", "La vie difficile sous l'Occupation", "Le régime de Vichy (Philippe Pétain), l'antisémitisme, la rafle du Vel d'Hiv' (1942), les Justes parmi les Nations", "6 juin 1944 : débarquement en Normandie ; 8 mai 1945 : capitulation de l'Allemagne nazie", "Le bilan : 60 à 70 millions de morts, dont 6 millions de Juifs"] },
    { id: "27-cm2-hi-depuis-1945", title: "La France depuis 1945 : 80 ans de transformations", notions: ["1944 : droit de vote des femmes ; 1965 : les femmes peuvent travailler et ouvrir un compte sans l'accord de leur mari", "Une République démocratique et sociale : la Sécurité sociale", "1958 : la Ve République, avec le général de Gaulle", "Une société transformée : transports, loisirs, société de consommation", "La construction européenne : traité de Rome (1957), l'euro remplace le franc (2000)"] },
  ],
};

const GEOGRAPHIE_CM2_2027: SubjectProgramme = {
  subject: "Géographie",
  source: `${HG_SRC} — Cours moyen deuxième année : la France, l'Union européenne`,
  verifie: true,
  chapters: [
    { id: "27-cm2-ge-territoire", title: "L'organisation du territoire français", notions: ["Les cinq principales agglomérations françaises", "Les grands axes autoroutiers et ferroviaires (TGV)", "Commune, département, région : les 18 Régions et leur capitale", "Ta région et ton département"] },
    { id: "27-cm2-ge-eau", title: "Les usages de l'eau douce en France", notions: ["L'eau douce, une ressource limitée ; la nappe phréatique", "Les différents usages de l'eau et les conflits d'usages", "Les grands fleuves : Garonne, Loire, Maroni, Rhin, Rhône, Seine", "Les massifs : Alpes, Corse, Jura, Massif central, Pyrénées, Vosges ; deux grands lacs"] },
    { id: "27-cm2-ge-union-europeenne", title: "L'Union européenne", notions: ["La différence entre l'Europe (un continent) et l'Union européenne (une construction politique)", "Dix pays de l'Union européenne, dont les six pays fondateurs", "1957 : traité de Rome ; 1992 : traité de Maastricht", "Un aménagement aidé par l'Union européenne près de chez toi"] },
  ],
};

const HISTOIRE_6E_2027: SubjectProgramme = {
  subject: "Histoire",
  source: `${HG_SRC} — Sixième : premiers humains, premières sociétés et premiers États`,
  verifie: true,
  chapters: [
    { id: "27-6e-hi-temps", title: "Se repérer dans le temps", notions: ["Écrire les siècles en chiffres romains", "Les grandes périodes sur une frise : Antiquité, Moyen Âge, Temps modernes, époque contemporaine", "Le découpage du temps est une convention"] },
    { id: "27-6e-hi-neolithique", title: "Du Paléolithique au Néolithique", notions: ["Les premiers humains en Afrique, Néandertal et Homo sapiens, les premières migrations", "Les chasseurs-cueilleurs du Paléolithique ; vers 400 000 av. J.-C. : domestication du feu", "Le Néolithique (vers 10 000 av. J.-C. au Proche-Orient) : agriculture, élevage, premiers villages", "Vers 4000 av. J.-C. : invention de la roue ; Lascaux et Chauvet"] },
    { id: "27-6e-hi-orient-egypte", title: "Des sociétés, des États, des dieux : Proche-Orient et Égypte", notions: ["Vers 3000 av. J.-C. : écriture cunéiforme et premières cités-États en Mésopotamie (Ur, Uruk)", "L'Égypte unifiée autour du Nil, le pharaon (Ramsès II), les hiéroglyphes", "Le roi conquérant et bâtisseur (Nabuchodonosor II), le rôle des temples", "Naissance du judaïsme, premier monothéisme ; la Bible hébraïque"] },
    { id: "27-6e-hi-grece", title: "Le monde grec, des cités aux conquêtes d'Alexandre", notions: ["Des cités-États en guerre mais une culture commune (L'Iliade et L'Odyssée, Jeux olympiques)", "Athènes au Ve siècle av. J.-C. (Périclès) : citoyens, démocratie et ses limites", "Les femmes et les esclaves, exclus de la citoyenneté", "Les conquêtes d'Alexandre le Grand (336-323 av. J.-C.)"] },
    { id: "27-6e-hi-celtes", title: "Les mondes celtes et la Méditerranée", notions: ["Les Celtes, des peuples de l'Europe tempérée ; les Gaulois", "Oppidum, artisanat, agriculture, druides ; Bibracte, La Tène", "600 av. J.-C. : les Grecs fondent Massalia (Marseille)", "52 av. J.-C. : Jules César bat Vercingétorix, fin de la guerre des Gaules"] },
  ],
};

const GEOGRAPHIE_6E_2027: SubjectProgramme = {
  subject: "Géographie",
  source: `${HG_SRC} — Sixième : habiter le monde`,
  verifie: true,
  chapters: [
    { id: "27-6e-ge-reperes", title: "Je me repère à la surface de la Terre", notions: ["Représenter la Terre déforme toujours : projections Mercator, Peters, Lambert, Equal Earth", "Équateur, tropiques, cercles polaires, méridien de Greenwich", "Continents et océans sur un planisphère"] },
    { id: "27-6e-ge-peuplement", title: "Le peuplement de la Terre", notions: ["Les grands foyers de peuplement et les principaux flux migratoires", "Taux de natalité, taux de mortalité, solde naturel, solde migratoire", "Espérance de vie, croissance démographique, vieillissement"] },
    { id: "27-6e-ge-metropole", title: "Habiter une métropole", notions: ["Qu'est-ce qu'une métropole ? Ses fonctions politiques, économiques, culturelles", "Une métropole d'un pays développé et une d'un pays émergent", "Quartier d'affaires, habitat informel, centre historique", "Les cinq premières métropoles mondiales"] },
    { id: "27-6e-ge-contraintes", title: "Habiter un espace soumis à des contraintes naturelles", notions: ["Qu'est-ce qu'une contrainte naturelle ?", "Déserts chauds et froids, forêts tropicales, haute montagne", "S'adapter : haute montagne ou littoral menacé de submersion marine", "Adaptation et atténuation face au dérèglement climatique"] },
    { id: "27-6e-ge-risques", title: "Habiter un espace exposé aux risques", notions: ["Aléa, risque, vulnérabilité", "Risques naturels et risques causés par l'humain", "Les aires sismiques et cycloniques (typhon, ouragan)", "Prévenir et gérer : tous les pays ne sont pas égaux face au risque"] },
  ],
};

const EPS_CM2_2027: SubjectProgramme = {
  subject: "EPS",
  source: `${EPS_SRC} — Cours moyen`,
  verifie: true,
  chapters: [
    { id: "27-cm2-eps-deplacer", title: "Se déplacer pour agir dans l'espace et sur une durée", notions: ["Courir vite jusqu'à l'arrivée, se relayer, franchir des obstacles sans ralentir", "Courir longtemps à l'aide de repères", "Course d'élan et pied d'appel pour sauter loin ou haut, lancer loin", "S'orienter avec des repères simples", "Mesurer une performance sans juger"] },
    { id: "27-cm2-eps-equilibres", title: "Construire des équilibres dans des milieux inhabituels", notions: ["Rouler vers l'arrière, se renverser, se suspendre, grimper sur un mur", "Circuler ou glisser avec un vélo, des rollers… seul et en groupe : le savoir rouler à vélo", "Se déplacer dans l'eau : le savoir nager", "Agir en sécurité pour soi et pour les autres"] },
    { id: "27-cm2-eps-exprimer", title: "S'exprimer avec son corps", notions: ["Créer et mémoriser un enchaînement artistique (danse, acrobatie)", "Se présenter en artiste devant les autres", "Apprécier une prestation et donner des conseils précis"] },
    { id: "27-cm2-eps-jouer", title: "Coopérer et s'opposer en respectant les règles", notions: ["Jeux collectifs et jeux d'opposition : viser la cible, enchaîner des actions", "Mener un projet d'action seul ou en équipe", "Être joueur, arbitre ou organisateur", "Faire respecter les règles du jeu"] },
  ],
};

const EPS_6E_2027: SubjectProgramme = {
  subject: "EPS",
  source: `${EPS_SRC} — Sixième`,
  verifie: true,
  chapters: [
    { id: "27-6e-eps-performance", title: "Produire une performance optimale mesurable", notions: ["Des appuis efficaces et des alignements du corps pour être plus performant", "Les principes et les phases d'un échauffement", "Adapter son effort, connaître ses performances", "Règles de pratique, d'hygiène et de sécurité"] },
    { id: "27-6e-eps-environnement", title: "S'engager en sécurité dans un environnement inhabituel", notions: ["Prévoir et réaliser un itinéraire (course d'orientation, escalade…)", "Reconnaître et réguler ses émotions", "Évoluer en groupe en sécurité, limiter son impact sur la nature", "Fin de 6e : l'attestation du savoir nager en sécurité (ASNS)"] },
    { id: "27-6e-eps-prestation", title: "Composer une prestation corporelle jugée ou appréciée", notions: ["Construire des formes corporelles et des figures acrobatiques", "Composer un enchaînement artistique et acrobatique", "Aider ses camarades, être juge ou spectateur", "Découvrir des courants artistiques et des performances gymniques"] },
    { id: "27-6e-eps-confrontation", title: "Conduire une confrontation collective ou à deux", notions: ["Lire la trajectoire et le déplacement de l'adversaire", "Se placer pour agir, enchaîner des actions tactiques", "Trouver son point fort et le point faible de l'adversaire", "Connaître et faire respecter les règles, être arbitre, coopérer en équipe"] },
  ],
};

const ST_SRC = "Programme de sciences et technologie du cycle 3, BO n° 24 du 11 juin 2026 (en vigueur au CM2 et en 6e à la rentrée 2027)";

const SCIENCES_CM2_2027: SubjectProgramme = {
  subject: "Sciences et technologie",
  source: `${ST_SRC} — Cours moyen deuxième année`,
  verifie: true,
  chapters: [
    { id: "27-cm2-st-matiere", title: "États et constitution de la matière", notions: ["Masse : convertir tonne, kilogramme, gramme, milligramme", "Mesurer le volume d'un liquide, et d'un solide par déplacement de liquide", "La masse se conserve quand on mélange un solide dans un liquide, pas forcément le volume", "Récupérer un solide dissous par évaporation (surface, vent, température)", "États solide, liquide, gazeux ; changements d'état réversibles et leurs noms ; l'eau dans la nature"] },
    { id: "27-cm2-st-mouvement", title: "Différents types de mouvement", notions: ["Mouvement rectiligne ou circulaire, selon l'observateur", "Le mouvement de la Terre autour du Soleil, la Terre dans le système solaire", "Convertir des unités de distance et de temps"] },
    { id: "27-cm2-st-electricite", title: "Signaux : l'électricité", notions: ["Circuit à une boucle : générateur, interrupteur, un ou deux récepteurs", "Matériaux conducteurs et isolants", "Règles de sécurité électrique"] },
    { id: "27-cm2-st-biodiversite", title: "Unité et diversité du vivant : biodiversité actuelle et passée", notions: ["Échelle des temps géologiques et échelle de l'histoire humaine", "Les fossiles racontent les changements de biodiversité", "Placer des espèces actuelles et fossiles sur une frise", "Une extinction massive : la crise Crétacé-Tertiaire (fin des dinosaures)"] },
    { id: "27-cm2-st-ecosystemes", title: "Les écosystèmes et les actions humaines", notions: ["Agir pour le développement durable : climat, biodiversité, ressources, déchets", "Agir seul et ensemble pour la nature", "Chercher des informations et vérifier ses sources"] },
    { id: "27-cm2-st-terre", title: "La Terre, une planète active", notions: ["Manifestations de l'activité interne et externe de la Terre", "Risque naturel : prévention et protection", "Le climat local : la météo sur plusieurs années", "Conséquences du changement climatique près de chez soi ; s'adapter et atténuer"] },
    { id: "27-cm2-st-alimentation", title: "Alimentation humaine", notions: ["Les besoins alimentaires changent avec la croissance et l'activité physique", "Organes du système digestif et leur fonction ; aliments transformés en nutriments", "Le sang apporte les nutriments aux organes", "Pendant un effort, le cœur bat plus vite pour les muscles"] },
    { id: "27-cm2-st-puberte", title: "Puberté et reproduction humaine", notions: ["Organes reproducteurs et leur fonction", "Les règles, une étape normale de la puberté", "Trajet de l'ovule et des spermatozoïdes, rencontre, implantation et gestation de l'embryon"] },
    { id: "27-cm2-st-conception", title: "Concevoir et réaliser un objet technique", notions: ["Chercher des solutions avec des croquis", "Choisir un matériau selon une contrainte : étanchéité, résistance, isolation, durée de vie", "Concevoir et fabriquer une maquette", "Comparer des solutions : efficacité, durée de vie, esthétique, développement durable"] },
    { id: "27-cm2-st-programmation", title: "Programmation d'objets techniques", notions: ["Comprendre un algorithme qui commande un objet", "Modifier, tester et valider un programme"] },
  ],
};

const SCIENCES_6E_2027: SubjectProgramme = {
  subject: "Sciences et technologie",
  source: `${ST_SRC} — Sixième`,
  verifie: true,
  chapters: [
    { id: "27-6e-st-matiere", title: "États et constitution de la matière", notions: ["Températures de changement d'état, paliers de température", "Mesurer le volume d'un gaz ; convertir masses et volumes", "Masse et volume : la proportionnalité dépend du matériau ; liquides non miscibles superposés", "Séparer des liquides non miscibles ; saturation d'un solide dans l'eau", "Composition de l'air, gaz à effet de serre"] },
    { id: "27-6e-st-mouvement", title: "Différents types de mouvement", notions: ["Distance, durée et vitesse (sans formule) ; vitesse constante ou variable", "Le jour et la nuit, les saisons et l'inclinaison du Soleil", "Une année = une révolution de la Terre autour du Soleil ; un jour = une rotation"] },
    { id: "27-6e-st-electricite", title: "Signaux : l'électricité", notions: ["Dans un circuit à une boucle, l'ordre des composants ne change rien", "Circuits avec moteur, cellule photovoltaïque ou capteur", "Schéma normalisé d'un circuit", "Règles de sécurité électrique"] },
    { id: "27-6e-st-vivant", title: "Unité et diversité du vivant", notions: ["La cellule, unité commune à tous les êtres vivants ; observer au microscope", "Classer les êtres vivants, lire un arbre de parenté", "Qu'est-ce qu'une espèce ? Diversité des individus et variations héréditaires"] },
    { id: "27-6e-st-reproduction", title: "Reproduction, croissance et développement", notions: ["La pollinisation : la fleur devient fruit, les ovules deviennent graines", "La coopération entre plantes et pollinisateurs", "Moins de pollinisateurs (insecticides) : conséquences pour les cultures"] },
    { id: "27-6e-st-ecosystemes", title: "Les écosystèmes", notions: ["Décrire un paysage : composantes biologiques, géologiques, humaines", "Un milieu et son peuplement, au fil des saisons ; passer la mauvaise saison", "Les végétaux à la base des réseaux alimentaires", "La décomposition de la matière organique par les microorganismes (le sol)", "Agir pour le développement durable"] },
    { id: "27-6e-st-alimentation", title: "Alimentation humaine", notions: ["Une alimentation favorable à la santé, diversité des traditions culinaires", "Conserver les aliments pour limiter les risques", "Fermentation : des microorganismes transforment les aliments"] },
    { id: "27-6e-st-puberte", title: "Puberté et reproduction humaine", notions: ["Les changements de la puberté rendent capable de se reproduire", "Caractères sexuels primaires et secondaires"] },
  ],
};

const LV_SRC = "Programme de langues vivantes étrangères et régionales pour le cours moyen, BO n° 12 du 19 mars 2026 (en vigueur au CM2 à la rentrée 2027 ; objectif fin de CM2 : niveau A1 consolidé)";

const ANGLAIS_CM2_2027: SubjectProgramme = {
  subject: "Anglais",
  source: LV_SRC,
  verifie: true,
  chapters: [
    { id: "27-cm2-an-ecouter", title: "Écouter et comprendre", notions: ["Suivre le fil d'une histoire simple", "Comprendre un message court sur un sujet familier, toutes les consignes de la classe", "Comprendre et agir : impératif, autorisation, obligation, interdiction", "Reconnaître une question, une affirmation, une exclamation à l'intonation"] },
    { id: "27-cm2-an-parler", title: "Parler en continu", notions: ["Prononcer correctement les mots appris, lire à voix haute un texte préparé", "Se présenter, présenter les autres, dire ses goûts", "Raconter une courte histoire avec des images", "Décrire son quotidien : école, famille, loisirs ; nombres au-delà de 100"] },
    { id: "27-cm2-an-dialoguer", title: "Réagir et dialoguer", notions: ["Saluer, se présenter, remercier, s'excuser, accepter, refuser, prendre congé", "Poser des questions simples et répondre brièvement", "Dire ses émotions, son accord ou son désaccord", "Épeler, demander de répéter, dire qu'on ne comprend pas"] },
    { id: "27-cm2-an-lire", title: "Lire et comprendre", notions: ["Comprendre des textes courts : carte postale, courriel, affiche, menu, BD", "Repérer la trame d'un récit illustré", "Suivre une recette ou un mode d'emploi simple"] },
    { id: "27-cm2-an-ecrire", title: "Écrire", notions: ["Copier et écrire sous la dictée des mots connus", "Écrire des phrases courtes sur soi, avec des mots de liaison simples", "Remplir une fiche de renseignements, répondre à un message, donner son avis"] },
    { id: "27-cm2-an-mediation", title: "Médiation et repères culturels", notions: ["Transmettre une information simple (nom, nombre, prix, horaire) d'une langue à l'autre", "Repérer des ressemblances et des différences culturelles", "Aider un camarade, demander de l'aide, coopérer"] },
    { id: "27-cm2-an-langue", title: "Grammaire et prononciation", notions: ["Le présent des verbes courants ; pour aller plus loin : l'action en cours, le passé, le futur", "Articles, démonstratifs, pronoms personnels, adjectifs possessifs", "Phrases affirmatives, négatives, interrogatives, exclamatives ; and, or", "Comparatifs et superlatifs ; verbes modaux (pouvoir, devoir)", "L'alphabet, l'intonation et le rythme"] },
  ],
};

export const CHANGES_2027: Record<string, SubjectProgramme[]> = {
  CM2: [HISTOIRE_CM2_2027, GEOGRAPHIE_CM2_2027, SCIENCES_CM2_2027, ANGLAIS_CM2_2027, EPS_CM2_2027],
  "6e": [HISTOIRE_6E_2027, GEOGRAPHIE_6E_2027, SCIENCES_6E_2027, EPS_6E_2027],
};

/** Une année = l'année d'avant, avec les matières remplacées ou ajoutées. */
function nextYear(base: Record<string, SubjectProgramme[]>, changes: Record<string, SubjectProgramme[]>): Record<string, SubjectProgramme[]> {
  const out: Record<string, SubjectProgramme[]> = {};
  for (const [grade, subjects] of Object.entries(base)) {
    const replaced = changes[grade] ?? [];
    const kept = subjects.map((s) => replaced.find((r) => r.subject === s.subject) ?? s);
    out[grade] = [...kept, ...replaced.filter((r) => !subjects.some((s) => s.subject === r.subject))];
  }
  return out;
}

export const PROGRAMMES_BY_YEAR: Record<string, Record<string, SubjectProgramme[]>> = {
  "2026-2027": PROGRAMMES,
  "2027-2028": nextYear(PROGRAMMES, CHANGES_2027),
};

const YEARS = Object.keys(PROGRAMMES_BY_YEAR).sort();

/** L'année scolaire à une date (bascule le 1er août), bornée aux années connues. */
export function schoolYearOn(date: Date = new Date()): string {
  const start = date.getUTCMonth() >= 7 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  const year = `${start}-${start + 1}`;
  if (year < YEARS[0]) return YEARS[0];
  if (year > YEARS[YEARS.length - 1]) return YEARS[YEARS.length - 1];
  return year;
}

function programmesOn(date: Date): Record<string, SubjectProgramme[]> {
  return PROGRAMMES_BY_YEAR[schoolYearOn(date)];
}

const WORDS: Record<string, string> = { sixieme: "6e", cinquieme: "5e", quatrieme: "4e", troisieme: "3e" };

/** « CM2 », « 5ème », « 6e », « sixième », « 3eme »… → la clé de PROGRAMMES, ou null. */
export function programmeKey(grade: string): string | null {
  const g = grade
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
  if (g === "cm2") return "CM2";
  if (WORDS[g]) return WORDS[g];
  const m = /^([3-6])(e|eme|em)?$/.exec(g);
  return m ? `${m[1]}e` : null;
}

/** Le programme de la classe pour l'année scolaire en cours à cette date. */
export function programmeFor(grade: string, date: Date = new Date()): SubjectProgramme[] | null {
  const key = programmeKey(grade);
  return key ? (programmesOn(date)[key] ?? null) : null;
}

export function findChapter(grade: string, chapterId: string, date: Date = new Date()): { subject: SubjectProgramme; chapter: Chapter } | null {
  for (const subject of programmeFor(grade, date) ?? []) {
    const chapter = subject.chapters.find((c) => c.id === chapterId);
    if (chapter) return { subject, chapter };
  }
  return null;
}

/** The chapter list as Claude sees it in the prompt. */
export function programmeForPrompt(grade: string, date: Date = new Date()): string | null {
  const subjects = programmeFor(grade, date);
  if (!subjects) return null;
  return subjects
    .map((s) => `## ${s.subject}\n${s.chapters.map((c) => `- [${c.id}] ${c.title} : ${c.notions.join(" ; ")}${c.competences?.length ? `\n  Savoir-faire attendus : ${c.competences.join(" ; ")}` : ""}`).join("\n")}`)
    .join("\n\n");
}

/** Chapter ids are unique across classes, and kept across years: a revision filed under an older programme still finds its chapter. */
export function chapterById(chapterId: string): { grade: string; subject: SubjectProgramme; chapter: Chapter } | null {
  for (const year of [...YEARS].reverse()) {
    for (const [grade, subjects] of Object.entries(PROGRAMMES_BY_YEAR[year])) {
      for (const subject of subjects) {
        const chapter = subject.chapters.find((c) => c.id === chapterId);
        if (chapter) return { grade, subject, chapter };
      }
    }
  }
  return null;
}
