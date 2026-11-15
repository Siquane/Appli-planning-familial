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
// Sources : textes du Bulletin officiel indiqués pour chaque matière. Les
// sites officiels (éduscol, BO) n'étaient pas lisibles depuis l'outil de
// rédaction : les intitulés ont été recoupés à partir de sites académiques et
// de ressources d'accompagnement, et sont à revérifier sur le texte officiel
// à chaque changement de programme (`verifie` = intitulés confirmés par
// plusieurs sources concordantes).
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
      verifie: false,
      chapters: [
        { id: "cm2-fr-lecture", title: "Lire et comprendre", notions: ["Comprendre un texte littéraire et un texte documentaire", "Inférences, personnages, narrateur", "Lecture à voix haute fluide"] },
        { id: "cm2-fr-culture", title: "Culture littéraire", notions: ["Récits, contes, fables, poésie, théâtre", "Œuvres intégrales et grands genres"] },
        { id: "cm2-fr-ecrire", title: "Écrire", notions: ["Rédiger un texte cohérent", "Réviser et améliorer son texte", "Copie et production d'écrits"] },
        { id: "cm2-fr-oral", title: "Langage oral", notions: ["Écouter et comprendre", "Parler en continu, débattre", "Réciter"] },
        { id: "cm2-fr-classes-mots", title: "Grammaire : les classes de mots", notions: ["Nom, déterminant, adjectif, pronom", "Verbe, adverbe, préposition, conjonction de coordination"] },
        { id: "cm2-fr-phrase", title: "Grammaire : la phrase et ses fonctions", notions: ["Sujet, verbe, compléments du verbe (COD, COI)", "Attribut du sujet", "Compléments circonstanciels", "Phrase simple et phrase complexe, types et formes de phrases"] },
        { id: "cm2-fr-conjugaison", title: "Conjugaison", notions: ["Présent, imparfait, passé simple, futur de l'indicatif", "Passé composé, plus-que-parfait", "Impératif présent, conditionnel présent", "Radical et terminaison, verbes des 3 groupes"] },
        { id: "cm2-fr-orthographe", title: "Orthographe", notions: ["Accords dans le groupe nominal", "Accord sujet-verbe", "Accord du participe passé avec être et avoir", "Homophones grammaticaux"] },
        { id: "cm2-fr-lexique", title: "Vocabulaire", notions: ["Familles de mots, préfixes et suffixes", "Synonymes, antonymes, sens propre et sens figuré", "Utiliser le dictionnaire"] },
      ],
    },
    {
      subject: "Mathématiques",
      source: "Programme de mathématiques du cycle 3, BO n° 16 du 17 avril 2025 (en vigueur au CM2 à la rentrée 2026)",
      verifie: false,
      chapters: [
        { id: "cm2-ma-entiers", title: "Les nombres entiers", notions: ["Lire, écrire, décomposer jusqu'au milliard", "Comparer, ranger, encadrer"] },
        { id: "cm2-ma-fractions", title: "Les fractions", notions: ["Fractions simples et fractions décimales", "Fraction d'une quantité", "Comparer des fractions, les placer sur une droite graduée"] },
        { id: "cm2-ma-decimaux", title: "Les nombres décimaux", notions: ["Écriture à virgule jusqu'aux millièmes", "Comparer, ranger, encadrer, arrondir"] },
        { id: "cm2-ma-calcul", title: "Calcul et opérations", notions: ["Calcul mental et automatismes", "Addition, soustraction, multiplication posées", "Division euclidienne et division décimale", "Multiples et diviseurs"] },
        { id: "cm2-ma-problemes", title: "Résoudre des problèmes", notions: ["Problèmes à une ou plusieurs étapes", "Proportionnalité", "Pourcentages simples"] },
        { id: "cm2-ma-mesures", title: "Grandeurs et mesures", notions: ["Longueurs, masses, contenances, durées", "Périmètre et aire", "Volume (approche)", "Angles : comparer, droit, aigu, obtus"] },
        { id: "cm2-ma-geometrie", title: "Espace et géométrie", notions: ["Figures planes : triangles, quadrilatères, cercle", "Parallèles et perpendiculaires", "Symétrie axiale", "Solides et patrons", "Se repérer et se déplacer, programmes de construction"] },
        { id: "cm2-ma-donnees", title: "Données et probabilités", notions: ["Lire et construire tableaux et graphiques", "Probabilités : « a chances sur b »"] },
      ],
    },
    {
      subject: "Histoire",
      source: "Programme d'histoire du cycle 3 (2015, modifié BO n° 31 du 30 juillet 2020), toujours en vigueur au CM2 en 2026-2027",
      verifie: true,
      chapters: [
        { id: "cm2-hi-republique", title: "Le temps de la République", notions: ["1892 : la République fête ses cent ans", "L'école primaire au temps de Jules Ferry", "Des républiques, une démocratie : des libertés, des droits et des devoirs"] },
        { id: "cm2-hi-industriel", title: "L'âge industriel en France", notions: ["Énergies (charbon puis pétrole) et machines", "Le travail à la mine, à l'usine, à l'atelier, au grand magasin", "La ville industrielle", "Le monde rural"] },
        { id: "cm2-hi-guerres-ue", title: "La France, des guerres mondiales à l'Union européenne", notions: ["Deux guerres mondiales au XXe siècle", "La construction européenne"] },
      ],
    },
    {
      subject: "Géographie",
      source: "Programme de géographie du cycle 3 (2015, modifié BO n° 31 du 30 juillet 2020), toujours en vigueur au CM2 en 2026-2027",
      verifie: true,
      chapters: [
        { id: "cm2-ge-deplacer", title: "Se déplacer", notions: ["Se déplacer au quotidien en France", "Se déplacer au quotidien dans un autre lieu du monde", "Se déplacer de ville en ville, en France, en Europe et dans le monde"] },
        { id: "cm2-ge-internet", title: "Communiquer d'un bout à l'autre du monde grâce à l'Internet", notions: ["Un monde de réseaux", "Un habitant connecté au monde", "Des habitants inégalement connectés dans le monde"] },
        { id: "cm2-ge-habiter", title: "Mieux habiter", notions: ["Favoriser la place de la « nature » en ville", "Recycler", "Habiter un écoquartier"] },
      ],
    },
    {
      subject: "Sciences et technologie",
      source: "Programme de sciences et technologie du cycle 3 (version en vigueur depuis la rentrée 2023), toujours en vigueur au CM2 en 2026-2027",
      verifie: true,
      cycleWide: true,
      chapters: [
        { id: "cm2-st-matiere", title: "Matière, mouvement, énergie, information", notions: ["États de la matière, mélanges", "Mouvements et vitesse", "Sources et formes d'énergie", "Signaux et information"] },
        { id: "cm2-st-vivant", title: "Le vivant, sa diversité et ses fonctions", notions: ["Classer les êtres vivants", "Alimentation et digestion, besoins de l'organisme", "Développement des êtres vivants, reproduction", "Origine de la matière des êtres vivants"] },
        { id: "cm2-st-objets", title: "Matériaux et objets techniques", notions: ["Évolution des objets techniques", "Fonctionnement d'un objet, matériaux", "Concevoir et fabriquer un objet", "Communication et gestion de l'information"] },
        { id: "cm2-st-terre", title: "La planète Terre, les êtres vivants dans leur environnement", notions: ["La Terre dans le système solaire", "Phénomènes géologiques, météo et climat", "Peuplement d'un milieu, chaînes alimentaires", "Impact de l'être humain sur l'environnement"] },
      ],
    },
    {
      subject: "Enseignement moral et civique",
      source: "Programme d'EMC, BO n° 24 du 13 juin 2024",
      verifie: false,
      chapters: [
        { id: "cm2-emc-valeurs", title: "Les valeurs et symboles de la République", notions: ["Liberté, égalité, fraternité, laïcité", "Symboles de la République"] },
        { id: "cm2-emc-droits", title: "Droits, devoirs et règles", notions: ["Droits de l'enfant", "Règles et lois, la justice"] },
        { id: "cm2-emc-citoyen", title: "Être citoyen", notions: ["Démocratie et vote", "Engagement et solidarité", "Respect d'autrui, lutte contre les discriminations et le harcèlement"] },
      ],
    },
    {
      subject: "Anglais",
      source: "Programme de langues vivantes du cycle 3 (BO n° 31 du 30 juillet 2020)",
      verifie: true,
      cycleWide: true,
      chapters: [
        { id: "cm2-an-moi", title: "La personne et la vie quotidienne", notions: ["Se présenter, la famille, le corps", "La maison, l'école, les vêtements, la nourriture", "Les nombres, l'heure, la date"] },
        { id: "cm2-an-reperes", title: "Des repères géographiques, historiques et culturels", notions: ["Pays et villes anglophones", "Fêtes et traditions", "Personnages et monuments"] },
        { id: "cm2-an-imaginaire", title: "L'imaginaire", notions: ["Contes, comptines, chansons", "Albums et histoires"] },
      ],
    },
  ],
  "5e": [
    {
      subject: "Français",
      source: "Programme de français du cycle 4, BO n° 10 du 5 mars 2026 (en vigueur en 5e à la rentrée 2026)",
      verifie: false,
      chapters: [
        { id: "5e-fr-heros", title: "Devenir héroïne ou héros : destins romanesques", notions: ["Le récit et la fiction", "Le personnage et ses épreuves", "Narration et point de vue"] },
        { id: "5e-fr-poesie", title: "Voyager en poésie", notions: ["Vers, strophes, rimes", "Images poétiques (comparaison, métaphore)", "Le voyage et l'ailleurs"] },
        { id: "5e-fr-theatre", title: "Expérimenter et jouer au théâtre", notions: ["Texte théâtral : répliques, didascalies", "Comique et mise en scène", "Jouer une scène"] },
        { id: "5e-fr-imaginer", title: "Imaginer, sentir, raisonner", notions: ["Récits et fictions qui font réfléchir", "Exprimer ses émotions et argumenter"] },
        { id: "5e-fr-grammaire", title: "Grammaire", notions: ["Classes de mots", "Fonctions dans la phrase (sujet, COD, COI, attribut, compléments circonstanciels)", "Phrase simple et complexe, propositions"] },
        { id: "5e-fr-conjugaison", title: "Conjugaison", notions: ["Temps de l'indicatif simples et composés", "Valeurs des temps du récit", "Impératif, subjonctif présent, conditionnel"] },
        { id: "5e-fr-orthographe", title: "Orthographe et lexique", notions: ["Accords dans le groupe nominal et avec le sujet", "Accord du participe passé", "Formation des mots, champ lexical, registres"] },
      ],
    },
    {
      subject: "Mathématiques",
      source: "Programme de mathématiques du cycle 4, BO n° 10 du 5 mars 2026 (en vigueur en 5e à la rentrée 2026)",
      verifie: false,
      chapters: [
        { id: "5e-ma-relatifs", title: "Nombres relatifs", notions: ["Repérage sur une droite graduée et dans le plan", "Comparer, additionner et soustraire des relatifs"] },
        { id: "5e-ma-fractions", title: "Fractions", notions: ["Fractions égales, simplification", "Comparer, additionner et soustraire des fractions"] },
        { id: "5e-ma-calcul", title: "Calcul et priorités", notions: ["Priorités opératoires", "Distributivité", "Multiples, diviseurs, nombres premiers"] },
        { id: "5e-ma-litteral", title: "Calcul littéral et équations", notions: ["Expressions littérales", "Tester une égalité", "Résoudre des équations simples"] },
        { id: "5e-ma-proportionnalite", title: "Proportionnalité et fonctions", notions: ["Reconnaître une situation de proportionnalité", "Pourcentages, échelles", "Premières représentations de dépendances entre grandeurs"] },
        { id: "5e-ma-geometrie", title: "Géométrie plane", notions: ["Symétrie centrale", "Parallélogrammes", "Triangles : angles, inégalité triangulaire, constructions"] },
        { id: "5e-ma-mesures", title: "Longueurs, aires et volumes", notions: ["Périmètres et aires (triangle, parallélogramme, disque)", "Prismes et cylindres, volumes"] },
        { id: "5e-ma-donnees", title: "Données et probabilités", notions: ["Tableaux, diagrammes, moyenne", "Premières expériences aléatoires"] },
        { id: "5e-ma-info", title: "Pensée informatique", notions: ["Algorithmes", "Programmation par blocs"] },
      ],
    },
    {
      subject: "Histoire",
      source: "Programme d'histoire du cycle 4 (2015, modifié BO n° 31 du 30 juillet 2020)",
      verifie: true,
      chapters: [
        { id: "5e-hi-chretientes-islam", title: "Chrétientés et islam (VIe-XIIIe siècles), des mondes en contact", notions: ["Byzance et l'Europe carolingienne", "De la naissance de l'islam à la prise de Bagdad par les Mongols : pouvoirs, sociétés, cultures"] },
        { id: "5e-hi-feodal", title: "Société, Église et pouvoir politique dans l'Occident féodal (XIe-XVe siècles)", notions: ["L'ordre seigneurial : la formation et la domination des campagnes", "L'émergence d'une nouvelle société urbaine", "L'affirmation de l'État monarchique dans le Royaume des Capétiens et des Valois"] },
        { id: "5e-hi-europe-monde", title: "Transformations de l'Europe et ouverture sur le monde aux XVIe et XVIIe siècles", notions: ["Le monde au temps de Charles Quint et Soliman le Magnifique", "Humanisme, réformes et conflits religieux", "Du Prince de la Renaissance au roi absolu (François Ier, Henri IV, Louis XIV)"] },
      ],
    },
    {
      subject: "Géographie",
      source: "Programme de géographie du cycle 4 (2015, modifié BO n° 31 du 30 juillet 2020)",
      verifie: true,
      chapters: [
        { id: "5e-ge-demographie", title: "La question démographique et l'inégal développement", notions: ["La croissance démographique et ses effets", "Répartition de la richesse et de la pauvreté dans le monde"] },
        { id: "5e-ge-ressources", title: "Des ressources limitées, à gérer et à renouveler", notions: ["L'énergie, l'eau : des ressources à ménager et à mieux utiliser", "L'alimentation : comment nourrir une humanité en croissance ?"] },
        { id: "5e-ge-risques", title: "Prévenir les risques, s'adapter au changement global", notions: ["Le changement global et ses principaux effets géographiques régionaux", "Prévenir les risques industriels et technologiques"] },
      ],
    },
    {
      subject: "Enseignement moral et civique",
      source: "Programme d'EMC, BO n° 24 du 13 juin 2024",
      verifie: false,
      chapters: [
        { id: "5e-emc-egalite", title: "L'égalité et la lutte contre les discriminations", notions: ["Égalité entre les femmes et les hommes", "Discriminations et racisme, ce que dit la loi"] },
        { id: "5e-emc-solidarite", title: "Fraternité et solidarité", notions: ["Solidarité nationale et protection sociale", "Engagement et associations"] },
      ],
    },
    {
      subject: "SVT",
      source: "Programme de SVT du cycle 4 (2015, modifié BO n° 31 du 30 juillet 2020)",
      verifie: true,
      cycleWide: true,
      chapters: [
        { id: "c4-svt-terre", title: "La planète Terre, l'environnement et l'action humaine", notions: ["La Terre dans le système solaire, météo et climat", "Phénomènes géologiques (séismes, volcans)", "Risques naturels, ressources et écosystèmes"] },
        { id: "c4-svt-vivant", title: "Le vivant et son évolution", notions: ["Nutrition et besoins des cellules et des organismes", "Reproduction et diversité génétique", "Biodiversité et évolution"] },
        { id: "c4-svt-corps", title: "Le corps humain et la santé", notions: ["Digestion, respiration, circulation", "Système nerveux, effort physique", "Microbes et défenses de l'organisme", "Puberté et reproduction humaine"] },
      ],
    },
    {
      subject: "Physique-chimie",
      source: "Programme de physique-chimie du cycle 4 (2015, modifié BO n° 31 du 30 juillet 2020)",
      verifie: true,
      cycleWide: true,
      chapters: [
        { id: "c4-pc-matiere", title: "Organisation et transformations de la matière", notions: ["États de la matière, changements d'état", "Mélanges et corps purs, solubilité", "Transformations physiques et chimiques", "Masse volumique"] },
        { id: "c4-pc-mouvement", title: "Mouvements et interactions", notions: ["Décrire un mouvement, vitesse", "Interactions et forces"] },
        { id: "c4-pc-energie", title: "L'énergie et ses conversions", notions: ["Formes et sources d'énergie", "Circuits électriques"] },
        { id: "c4-pc-signaux", title: "Des signaux pour observer et communiquer", notions: ["Lumière : propagation, vitesse", "Son : propagation, fréquence"] },
      ],
    },
    {
      subject: "Technologie",
      source: "Programme de technologie du cycle 4 (2015, modifié BO n° 31 du 30 juillet 2020)",
      verifie: true,
      cycleWide: true,
      chapters: [
        { id: "c4-te-design", title: "Design, innovation et créativité", notions: ["Analyser un besoin, cahier des charges", "Imaginer et réaliser une solution"] },
        { id: "c4-te-objets", title: "Les objets techniques, les services et les changements induits dans la société", notions: ["Évolution des objets", "Impacts sur la société et l'environnement"] },
        { id: "c4-te-modelisation", title: "La modélisation et la simulation des objets et systèmes techniques", notions: ["Fonctions et structure d'un objet", "Chaîne d'énergie et chaîne d'information"] },
        { id: "c4-te-info", title: "L'informatique et la programmation", notions: ["Réseaux et données", "Écrire un programme, capteurs et actionneurs"] },
      ],
    },
    {
      subject: "Anglais",
      source: "Programme de langues vivantes du cycle 4 (BO n° 31 du 30 juillet 2020)",
      verifie: true,
      cycleWide: true,
      chapters: [
        { id: "c4-an-langages", title: "Langages", notions: ["Grammaire : temps (présent, prétérit, futur), modaux, comparatifs", "Vocabulaire des thèmes étudiés"] },
        { id: "c4-an-ecole-societe", title: "École et société", notions: ["Vie quotidienne et scolaire dans les pays anglophones"] },
        { id: "c4-an-voyages", title: "Voyages et migrations", notions: ["Découvrir des pays, voyager"] },
        { id: "c4-an-rencontres", title: "Rencontres avec d'autres cultures", notions: ["Patrimoine, traditions, personnages célèbres"] },
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
