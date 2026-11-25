// Album de cartes « Animaux du monde ». Chaque notion « Maîtrisé » (depuis
// l'arrivée de l'album, plus 3 cartes de bienvenue) donne une carte tirée au
// hasard : commune (70 %), rare (25 %) ou légendaire (5 %). Une carte déjà
// dans l'album devient des pièces. Les dessins sont dans l'appli
// (assets/cards/<id>.png, Microsoft Fluent Emoji 3D, licence MIT), mêmes id.
// Pur : la route tire et enregistre.

export type Rarity = "commune" | "rare" | "legendaire";

export interface Card {
  id: string;
  name: string;
  rarity: Rarity;
  /** Un fait étonnant, en une ou deux phrases courtes. */
  fact: string;
}

const c = (id: string, name: string, fact: string): Card => ({ id, name, rarity: "commune", fact });
const r = (id: string, name: string, fact: string): Card => ({ id, name, rarity: "rare", fact });
const l = (id: string, name: string, fact: string): Card => ({ id, name, rarity: "legendaire", fact });

export const CARDS: Card[] = [
  // Communes
  c("lion", "Lion", "Le rugissement du lion s'entend jusqu'à 8 kilomètres. Ce sont surtout les lionnes qui chassent."),
  c("tigre", "Tigre", "Il n'y a pas deux tigres avec les mêmes rayures, comme nos empreintes de doigts. Et il adore nager !"),
  c("elephant", "Éléphant", "Sa trompe contient environ 40 000 muscles. Il s'en sert comme d'une main, d'un nez et d'une paille."),
  c("girafe", "Girafe", "Sa langue bleu foncé mesure environ 50 centimètres. Elle s'en sert pour attraper les feuilles entre les épines."),
  c("zebre", "Zèbre", "Ses rayures aident à éloigner les mouches piqueuses, qui ont du mal à se poser dessus."),
  c("kangourou", "Kangourou", "Le bébé kangourou naît tout petit, à peine plus gros qu'un haricot, puis grandit dans la poche de sa maman."),
  c("pingouin", "Manchot", "Le manchot ne vole pas, mais il nage très vite. Certains plongent à plus de 500 mètres de profondeur."),
  c("hibou", "Hibou", "Il peut tourner la tête presque complètement, jusqu'aux trois quarts d'un tour, sans bouger le corps."),
  c("dauphin", "Dauphin", "Les dauphins s'appellent avec des sifflements : chacun a le sien, un peu comme un prénom."),
  c("tortue", "Tortue", "Certaines tortues de mer parcourent des milliers de kilomètres pour revenir pondre sur la plage où elles sont nées."),
  c("crocodile", "Crocodile", "Le crocodile ne peut pas tirer la langue : elle est attachée au fond de sa bouche."),
  c("perroquet", "Perroquet", "Certains perroquets apprennent des dizaines de mots et peuvent vivre plus de 50 ans."),
  c("herisson", "Hérisson", "Un hérisson a environ 5 000 piquants. Quand il a peur, il se roule en boule."),
  c("renard", "Renard", "Le renard entend une souris gratter sous la neige, puis il saute la tête la première pour l'attraper."),
  c("loup", "Loup", "Les loups vivent en famille, la meute. Leurs hurlements servent à se retrouver et à dire « ici, c'est chez nous »."),
  c("hippopotame", "Hippopotame", "L'hippopotame passe la journée dans l'eau pour se protéger du soleil, et sort la nuit pour manger de l'herbe."),
  c("chameau", "Chameau", "Ses bosses ne contiennent pas d'eau mais de la graisse, une réserve d'énergie pour traverser le désert."),
  c("lama", "Lama", "Le lama vit dans les montagnes d'Amérique du Sud. Quand il est fâché, il peut cracher !"),
  c("chauve_souris", "Chauve-souris", "C'est le seul mammifère qui vole vraiment. La nuit, elle trouve son chemin grâce à l'écho de ses cris."),
  c("papillon", "Papillon", "Le papillon goûte avec ses pattes ! Il sait ainsi si une feuille est bonne pour ses chenilles."),
  c("abeille", "Abeille", "Pour dire aux autres où sont les fleurs, l'abeille fait une petite danse dans la ruche."),
  c("coccinelle", "Coccinelle", "Une coccinelle peut manger des dizaines de pucerons par jour : les jardiniers l'adorent."),
  c("escargot", "Escargot", "L'escargot a des milliers de minuscules dents sur sa langue, qui râpent les feuilles."),
  c("grenouille", "Grenouille", "La grenouille boit par la peau : elle n'a pas besoin d'avaler de l'eau."),
  c("lezard", "Lézard", "Si on l'attrape par la queue, certains lézards la laissent tomber pour s'enfuir. Elle repousse ensuite."),
  c("serpent", "Serpent", "Le serpent sent les odeurs avec sa langue fourchue, qu'il sort sans arrêt."),
  c("cygne", "Cygne", "Le cygne a plus de 20 000 plumes. Les petits, les cygneaux, montent parfois sur le dos de leurs parents."),
  c("castor", "Castor", "Le castor construit des barrages avec des branches et de la boue. Ses dents orange ne s'arrêtent jamais de pousser."),
  c("bison", "Bison", "Le bison, très lourd, peut pourtant courir aussi vite qu'un cheval."),
  c("crabe", "Crabe", "Le crabe marche de côté. Pour grandir, il quitte sa carapace et en fabrique une nouvelle."),
  c("raton_laveur", "Raton laveur", "Le raton laveur a des doigts très sensibles : il touche et tripote ce qu'il mange, souvent près de l'eau."),
  c("ecureuil", "Tamia", "Le tamia, un petit écureuil rayé, transporte des graines dans ses joues, qui gonflent comme des poches."),
  c("hamster", "Hamster", "Le hamster aussi a des poches dans les joues. Il peut y transporter des graines pour remplir sa réserve."),
  c("homard", "Homard", "Le homard est bleu-vert ou brun dans la mer. Il ne devient rouge qu'à la cuisson."),
  // Rares
  r("panda", "Panda", "Le panda passe environ 12 heures par jour à manger du bambou, des kilos et des kilos !"),
  r("requin", "Requin", "Le requin perd ses dents toute sa vie et elles repoussent : il peut en user des milliers."),
  r("aigle", "Aigle", "L'aigle voit très loin : il repère un lapin à plus d'un kilomètre."),
  r("koala", "Koala", "Le koala dort jusqu'à 20 heures par jour. Les feuilles d'eucalyptus qu'il mange lui donnent peu d'énergie."),
  r("ours_polaire", "Ours polaire", "Sous ses poils blancs, sa peau est noire : elle garde mieux la chaleur du soleil."),
  r("pieuvre", "Pieuvre", "La pieuvre a trois cœurs et du sang bleu. Elle peut changer de couleur en un instant."),
  r("flamant", "Flamant rose", "Le flamant naît gris. Il devient rose grâce aux petites crevettes et aux algues qu'il mange."),
  r("paresseux", "Paresseux", "Le paresseux bouge si lentement que des algues poussent dans ses poils."),
  r("loutre", "Loutre", "Les loutres de mer se tiennent par la patte quand elles dorment, pour ne pas partir à la dérive."),
  r("rhinoceros", "Rhinocéros", "Sa corne est faite de kératine, la même matière que nos ongles et nos cheveux."),
  r("gorille", "Gorille", "Le gorille est très fort mais calme. Il mange surtout des plantes et fait un nid pour dormir chaque soir."),
  r("phoque", "Phoque", "Le phoque peut rester sous l'eau de longues minutes en ralentissant les battements de son cœur."),
  r("meduse", "Méduse", "La méduse n'a pas de cerveau, pas de cœur et pas d'os. Elle est faite presque entièrement d'eau."),
  r("poisson_globe", "Poisson-globe", "Quand il a peur, le poisson-globe avale de l'eau et gonfle comme un ballon."),
  // Légendaires
  l("baleine", "Baleine bleue", "C'est le plus gros animal qui ait jamais vécu sur Terre, plus gros que les dinosaures. Son cœur pèse à peu près autant que deux ou trois adultes."),
  l("paon", "Paon", "Le paon déploie une roue de plumes avec des « yeux » brillants pour impressionner la femelle, la paonne."),
  l("orang_outan", "Orang-outan", "L'orang-outan se sert d'outils : un bâton pour attraper des insectes, une grande feuille comme parapluie."),
  l("dodo", "Dodo", "Le dodo vivait sur l'île Maurice. Il ne volait pas et a disparu il y a plus de 300 ans."),
  l("t_rex", "Tyrannosaure", "Le T. rex vivait il y a environ 67 millions d'années. Ses dents pouvaient mesurer près de 30 centimètres avec la racine."),
  l("diplodocus", "Diplodocus", "Ce dinosaure végétarien était aussi long que deux autobus mis bout à bout, grâce à son cou et à sa queue immenses."),
  l("mammouth", "Mammouth laineux", "Il vivait pendant la dernière période glaciaire, couvert de longs poils. Les hommes préhistoriques l'ont dessiné dans des grottes."),
];

/** Chances de tirer chaque rareté. */
export const ODDS: Record<Rarity, number> = { commune: 0.7, rare: 0.25, legendaire: 0.05 };
/** Pièces pour une carte qu'on a déjà. */
export const DUPLICATE_COINS: Record<Rarity, number> = { commune: 5, rare: 10, legendaire: 25 };
/** Cartes de bienvenue, en plus d'une par notion maîtrisée. */
export const WELCOME_CARDS = 3;
/** Les notions maîtrisées avant ce jour ne comptent pas (l'album est arrivé ce jour-là). */
export const ALBUM_START = new Date("2026-11-25T00:00:00Z");
/** Au plus autant de cartes tirées d'un coup (le reste au prochain passage). */
export const MAX_DRAWS = 20;

export const cardOf = (id: string) => CARDS.find((x) => x.id === id) ?? null;

/** Une carte au hasard : d'abord la rareté, puis une carte de cette rareté. */
export function drawCard(random: () => number): Card {
  const roll = random();
  const rarity: Rarity = roll < ODDS.legendaire ? "legendaire" : roll < ODDS.legendaire + ODDS.rare ? "rare" : "commune";
  const pool = CARDS.filter((x) => x.rarity === rarity);
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

/** Cartes gagnées : 3 de bienvenue + une par notion maîtrisée depuis l'arrivée de l'album. */
export function cardsEarned(masteredSinceStart: number): number {
  return WELCOME_CARDS + masteredSinceStart;
}
