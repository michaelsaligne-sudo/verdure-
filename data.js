/* Contenu de soins de Verdure (textes originaux) */
const CATALOG=[
 {id:"monstera",nom:"Monstera",latin:"Monstera deliciosa",eau:7,lumiere:"Vive, sans soleil direct",humidite:"Moyenne à forte",temp:"18–27 °C",toxique:true,engrais:"Toutes les 4 semaines d'avril à septembre",conseil:"Laissez sécher les 3 premiers cm de terre entre deux arrosages. Un tuteur en mousse l'aide à faire de grandes feuilles découpées."},
 {id:"pothos",nom:"Pothos",latin:"Epipremnum aureum",eau:7,lumiere:"Faible à vive",humidite:"Moyenne",temp:"16–28 °C",toxique:true,engrais:"Toutes les 6 semaines au printemps et en été",conseil:"Très tolérant. Des feuilles qui pendent signalent la soif ; il repart vite après arrosage."},
 {id:"sansevieria",nom:"Sansevière",latin:"Dracaena trifasciata",eau:18,lumiere:"Faible à vive",humidite:"Faible",temp:"15–29 °C",toxique:true,engrais:"2 fois par an",conseil:"Le premier danger est l'excès d'eau. En hiver, un arrosage par mois suffit."},
 {id:"zamioculcas",nom:"Zamioculcas",latin:"Zamioculcas zamiifolia",eau:18,lumiere:"Faible à vive",humidite:"Faible",temp:"15–26 °C",toxique:true,engrais:"2 à 3 fois par an",conseil:"Ses rhizomes stockent l'eau. Attendez que la terre soit sèche sur toute la hauteur."},
 {id:"ficuslyrata",nom:"Figuier lyre",latin:"Ficus lyrata",eau:8,lumiere:"Très vive, un peu de soleil doux",humidite:"Moyenne",temp:"16–26 °C",toxique:true,engrais:"Mensuel au printemps et en été",conseil:"Il déteste être déplacé et les courants d'air. Tournez le pot d'un quart de tour par mois."},
 {id:"ficuselastica",nom:"Caoutchouc",latin:"Ficus elastica",eau:9,lumiere:"Vive",humidite:"Moyenne",temp:"16–27 °C",toxique:true,engrais:"Mensuel en saison",conseil:"Essuyez les feuilles avec un chiffon humide pour qu'elles captent mieux la lumière."},
 {id:"spathiphyllum",nom:"Fleur de lune",latin:"Spathiphyllum wallisii",eau:5,lumiere:"Moyenne, sans soleil direct",humidite:"Forte",temp:"18–27 °C",toxique:true,engrais:"Toutes les 6 semaines",conseil:"Elle s'affaisse quand elle a soif. Préférez une eau à température ambiante."},
 {id:"calathea",nom:"Calathea",latin:"Goeppertia orbifolia",eau:5,lumiere:"Moyenne, filtrée",humidite:"Forte",temp:"18–26 °C",toxique:false,engrais:"Mensuel à demi-dose",conseil:"Sensible au calcaire : eau de pluie ou filtrée. Les bords bruns viennent souvent d'un air trop sec."},
 {id:"chlorophytum",nom:"Plante araignée",latin:"Chlorophytum comosum",eau:6,lumiere:"Vive",humidite:"Moyenne",temp:"13–27 °C",toxique:false,engrais:"Mensuel en saison",conseil:"Les petits rejets s'enracinent facilement dans un verre d'eau."},
 {id:"aloe",nom:"Aloe vera",latin:"Aloe barbadensis",eau:18,lumiere:"Plein soleil",humidite:"Faible",temp:"13–29 °C",toxique:true,engrais:"2 fois par an",conseil:"Terreau pour cactus et pot percé. Arrosez abondamment puis laissez sécher complètement."},
 {id:"echeveria",nom:"Echeveria",latin:"Echeveria elegans",eau:14,lumiere:"Plein soleil",humidite:"Faible",temp:"10–28 °C",toxique:false,engrais:"Une fois au printemps",conseil:"Une rosette qui s'étire cherche la lumière. N'arrosez jamais le cœur de la rosette."},
 {id:"cactus",nom:"Cactus (général)",latin:"Cactaceae",eau:21,lumiere:"Plein soleil",humidite:"Faible",temp:"10–30 °C",toxique:false,engrais:"2 fois en été",conseil:"Presque pas d'eau en hiver : un repos au frais favorise la floraison."},
 {id:"orchidee",nom:"Orchidée papillon",latin:"Phalaenopsis",eau:8,lumiere:"Vive, filtrée",humidite:"Moyenne à forte",temp:"18–28 °C",toxique:false,engrais:"Engrais orchidée toutes les 2 semaines à faible dose",conseil:"Arrosez quand les racines deviennent argentées : trempage 10 minutes puis égouttage complet."},
 {id:"pilea",nom:"Pilea",latin:"Pilea peperomioides",eau:7,lumiere:"Vive, sans soleil brûlant",humidite:"Moyenne",temp:"15–26 °C",toxique:false,engrais:"Mensuel en saison",conseil:"Tournez-la souvent pour garder un port bien droit."},
 {id:"philodendron",nom:"Philodendron",latin:"Philodendron hederaceum",eau:7,lumiere:"Moyenne à vive",humidite:"Moyenne",temp:"16–28 °C",toxique:true,engrais:"Toutes les 4 à 6 semaines",conseil:"Se bouture très bien en coupant sous un nœud."},
 {id:"dracaena",nom:"Dragonnier",latin:"Dracaena marginata",eau:10,lumiere:"Vive",humidite:"Moyenne",temp:"16–26 °C",toxique:true,engrais:"Mensuel en saison",conseil:"Sensible au fluor de l'eau du robinet : pointes brunes possibles."},
 {id:"yucca",nom:"Yucca",latin:"Yucca elephantipes",eau:12,lumiere:"Très vive à soleil",humidite:"Faible",temp:"10–28 °C",toxique:true,engrais:"Mensuel en été",conseil:"Peut passer l'été dehors, à acclimater progressivement au soleil."},
 {id:"kentia",nom:"Kentia",latin:"Howea forsteriana",eau:8,lumiere:"Moyenne",humidite:"Moyenne",temp:"16–26 °C",toxique:false,engrais:"Toutes les 6 semaines",conseil:"Coupez seulement les palmes entièrement sèches, jamais les pointes vertes."},
 {id:"areca",nom:"Palmier areca",latin:"Dypsis lutescens",eau:5,lumiere:"Vive, filtrée",humidite:"Forte",temp:"18–27 °C",toxique:false,engrais:"Mensuel en saison",conseil:"Il aime une terre juste humide, jamais détrempée."},
 {id:"fougere",nom:"Fougère de Boston",latin:"Nephrolepis exaltata",eau:3,lumiere:"Moyenne",humidite:"Très forte",temp:"16–24 °C",toxique:false,engrais:"Mensuel à demi-dose",conseil:"Parfaite dans une salle de bain lumineuse. Elle ne doit jamais sécher complètement."},
 {id:"lierre",nom:"Lierre",latin:"Hedera helix",eau:6,lumiere:"Moyenne à vive",humidite:"Moyenne",temp:"10–22 °C",toxique:true,engrais:"Mensuel en saison",conseil:"Il préfère la fraîcheur : un appartement surchauffé attire les araignées rouges."},
 {id:"anthurium",nom:"Anthurium",latin:"Anthurium andraeanum",eau:6,lumiere:"Vive, filtrée",humidite:"Forte",temp:"18–28 °C",toxique:true,engrais:"Engrais floraison toutes les 3 semaines",conseil:"Retirez les fleurs fanées à la base de la tige pour relancer la floraison."},
 {id:"basilic",nom:"Basilic",latin:"Ocimum basilicum",eau:2,lumiere:"Plein soleil",humidite:"Moyenne",temp:"18–30 °C",toxique:false,engrais:"Toutes les 2 semaines, engrais bio",conseil:"Pincez les sommités et retirez les fleurs pour garder des feuilles tendres."},
 {id:"tomate",nom:"Tomate",latin:"Solanum lycopersicum",eau:2,lumiere:"Plein soleil",humidite:"Moyenne",temp:"18–30 °C",toxique:true,engrais:"Hebdomadaire dès la floraison",conseil:"Arrosez au pied, le matin, sans mouiller le feuillage pour éviter le mildiou."},
 {id:"lavande",nom:"Lavande",latin:"Lavandula angustifolia",eau:10,lumiere:"Plein soleil",humidite:"Faible",temp:"-15–35 °C",toxique:false,engrais:"Inutile",conseil:"Taillez après la floraison sans couper dans le vieux bois."},
 {id:"rosier",nom:"Rosier",latin:"Rosa",eau:4,lumiere:"Soleil",humidite:"Moyenne",temp:"-15–30 °C",toxique:false,engrais:"Au printemps puis après la 1re floraison",conseil:"Taille principale en fin d'hiver, au-dessus d'un œil tourné vers l'extérieur."},
 {id:"autre",nom:"Autre plante",latin:"",eau:7,lumiere:"À préciser",humidite:"—",temp:"—",toxique:false,engrais:"—",conseil:"Utilisez l'onglet Identifier pour obtenir une fiche adaptée."}
];
const SYMPTOMS=["Feuilles jaunes","Bords bruns ou secs","Taches brunes ou noires","Feuilles molles ou tombantes","Feuilles qui tombent","Poudre blanche","Petites toiles ou points","Insectes visibles","Tiges qui pourrissent","Pousse étirée et pâle","Terre qui sent mauvais","Pas de croissance"];
const OFFLINE={
 "Feuilles jaunes":"Le plus souvent un excès d'eau : vérifiez que le pot est percé et laissez sécher la terre. Si seules les vieilles feuilles du bas jaunissent, c'est normal ou un manque d'engrais.",
 "Bords bruns ou secs":"Air trop sec ou eau calcaire. Éloignez du radiateur, groupez les plantes et utilisez une eau reposée ou filtrée.",
 "Taches brunes ou noires":"Champignon ou brûlure. Retirez les feuilles touchées, arrosez au pied et aérez. Des taches claires et sèches côté fenêtre indiquent un coup de soleil.",
 "Feuilles molles ou tombantes":"Soif ou, à l'inverse, racines asphyxiées. Touchez la terre : sèche, arrosez ; détrempée, dépotez et vérifiez les racines.",
 "Feuilles qui tombent":"Changement brutal (lumière, place, courant d'air froid). Laissez la plante se stabiliser sans la déplacer.",
 "Poudre blanche":"Oïdium. Retirez les parties atteintes, pulvérisez un mélange d'eau et de bicarbonate (1 c. à café par litre) et améliorez l'aération.",
 "Petites toiles ou points":"Araignées rouges. Douchez le feuillage, augmentez l'humidité et répétez chaque semaine pendant un mois.",
 "Insectes visibles":"Cochenilles, pucerons ou thrips. Isolez la plante, nettoyez avec un coton imbibé d'alcool ou de savon noir dilué.",
 "Tiges qui pourrissent":"Pourriture due à l'excès d'eau. Coupez les parties molles, rempotez dans un substrat sec et drainant, espacez les arrosages.",
 "Pousse étirée et pâle":"Manque de lumière. Rapprochez la plante d'une fenêtre ou ajoutez une lampe de culture.",
 "Terre qui sent mauvais":"Racines qui pourrissent. Dépotez, retirez les racines brunes et molles, rempotez dans un terreau neuf.",
 "Pas de croissance":"Repos hivernal normal, ou pot trop petit et terre épuisée. Rempotez au printemps et reprenez l'engrais."
};
const LIGHT=[
  {nom:"Faible",lux:"moins de 1 000 lux",match:/faible/i,txt:"Lecture difficile en plein jour sans lampe. Peu de plantes s'y plaisent durablement."},
  {nom:"Moyenne",lux:"1 000 à 5 000 lux",match:/moyenne|faible à|filtrée/i,txt:"Lumière douce, sans soleil direct. Idéal pour les plantes de sous-bois."},
  {nom:"Vive",lux:"5 000 à 20 000 lux",match:/vive/i,txt:"Très lumineux, soleil direct seulement en début ou fin de journée."},
  {nom:"Plein soleil",lux:"plus de 20 000 lux",match:/soleil/i,txt:"Soleil direct plusieurs heures par jour. Parfait pour cactus, succulentes et aromatiques."}
];
