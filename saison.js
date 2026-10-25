/* Calendrier des soins (hémisphère nord, climat tempéré) : gestes du mois par catégorie. Textes originaux. */
const SEASONS={printemps:[3,4,5],ete:[6,7,8],automne:[9,10,11],hiver:[12,1,2]};
const SEASON_NAMES={printemps:"Printemps",ete:"Été",automne:"Automne",hiver:"Hiver"};
/* Coefficient appliqué à l'intervalle d'arrosage conseillé, selon la saison et le type de plante (dehors ou dedans). */
const WATER_FACTOR={
 interieur:{printemps:1,ete:.85,automne:1.2,hiver:1.5},
 succulente:{printemps:1,ete:.9,automne:1.5,hiver:2.5},
 aromatique:{printemps:1,ete:.7,automne:1.3,hiver:1.8},
 potager:{printemps:1,ete:.7,automne:1.2,hiver:1.5},
 exterieur:{printemps:1,ete:.7,automne:1.3,hiver:2},
 autre:{printemps:1,ete:.9,automne:1.2,hiver:1.5}
};
const CALENDAR=[
 {cat:"interieur",mois:[3,4,5],txt:"Rempotez les plantes dont les racines sortent du pot ou qui n'ont pas été rempotées depuis 2 ans. Pour les grands sujets, un surfaçage suffit."},
 {cat:"interieur",mois:[3],txt:"Reprenez l'engrais à demi-dose dès que de nouvelles feuilles apparaissent, et rapprochez progressivement les arrosages."},
 {cat:"interieur",mois:[4,5,6,7,8,9],txt:"Engrais au rythme de chaque fiche, toujours sur une terre déjà humide."},
 {cat:"interieur",mois:[3,4,5,6],txt:"Bon moment pour tailler, pincer et bouturer : les boutures s'enracinent vite."},
 {cat:"interieur",mois:[5,6],txt:"Après mi-mai, si les nuits restent au-dessus de 12 °C, vos plantes tropicales peuvent passer l'été dehors, à l'ombre, après une semaine d'acclimatation."},
 {cat:"interieur",mois:[6,7,8],txt:"Surveillez les fenêtres au sud et à l'ouest : reculez les plantes qui craignent le soleil direct. Douchez le feuillage contre la poussière et les acariens."},
 {cat:"interieur",mois:[9],txt:"Rentrez les plantes sorties pour l'été avant que les nuits passent sous 12 °C, après avoir inspecté le dessous des feuilles (pas de passagers clandestins)."},
 {cat:"interieur",mois:[9,10],txt:"Réduisez l'engrais puis arrêtez-le en octobre. Espacez progressivement les arrosages."},
 {cat:"interieur",mois:[10,11,12,1,2],txt:"Rapprochez les plantes des fenêtres : la lumière est faible. Dépoussiérez les feuilles pour qu'elles en captent le maximum."},
 {cat:"interieur",mois:[11,12,1,2],txt:"Pas d'engrais, pas de rempotage. Arrosez seulement quand la terre est sèche sur 3 cm, à l'eau tiède. Éloignez les plantes des radiateurs et humidifiez l'air."},
 {cat:"succulente",mois:[3,4],txt:"Reprise : arrosez de nouveau, d'abord légèrement. Rempotez si besoin dans un terreau pour cactus."},
 {cat:"succulente",mois:[4,5,6,7,8,9],txt:"Arrosage copieux quand la terre est sèche sur toute la hauteur, engrais pour cactus une fois par mois."},
 {cat:"succulente",mois:[5,6],txt:"Elles adorent passer l'été dehors au soleil, après 10 jours d'acclimatation progressive (sinon coups de soleil)."},
 {cat:"succulente",mois:[10,11,12,1,2],txt:"Repos : presque plus d'eau (une fois par mois au plus, rien pour les cactus), au frais et au lumineux. C'est ce qui les fait fleurir au printemps."},
 {cat:"aromatique",mois:[3,4],txt:"Semez au chaud basilic et coriandre. Taillez thym, sauge, romarin et lavande pour qu'ils restent denses. Divisez menthe, ciboulette et estragon."},
 {cat:"aromatique",mois:[5],txt:"Après les Saints de glace (mi-mai), sortez le basilic et la citronnelle. Plantez les aromatiques dans de grands pots."},
 {cat:"aromatique",mois:[5,6,7,8,9],txt:"Récoltez souvent et pincez les fleurs du basilic, de la coriandre et du persil pour garder des feuilles tendres."},
 {cat:"aromatique",mois:[6,7,8],txt:"Arrosez le soir les aromatiques gourmandes en eau (basilic, persil, menthe, ciboulette) ; laissez sécher thym, romarin, origan et sauge entre deux arrosages."},
 {cat:"aromatique",mois:[7,8],txt:"Faites des réserves : séchez thym, origan et sauge, congelez persil, basilic et ciboulette hachés."},
 {cat:"aromatique",mois:[9,10],txt:"Rentrez basilic et citronnelle avant les nuits à 10 °C. Semez persil et coriandre pour l'automne."},
 {cat:"aromatique",mois:[11,12,1,2],txt:"Thym, romarin, sauge et laurier restent dehors mais au sec : pas de soucoupe pleine, pots surélevés, voile si fort gel."},
 {cat:"potager",mois:[2,3],txt:"Semez au chaud tomates et piments, près d'une fenêtre très lumineuse."},
 {cat:"potager",mois:[3,4,5,6,7,8],txt:"Semez des salades toutes les 3 semaines pour en avoir en continu."},
 {cat:"potager",mois:[5],txt:"Plantez tomates et piments dehors après mi-mai, avec un tuteur. Paillez dès la plantation."},
 {cat:"potager",mois:[6,7,8],txt:"Arrosez au pied, le matin, sans mouiller les feuilles (mildiou). Retirez les gourmands des tomates, engrais tomate chaque semaine."},
 {cat:"potager",mois:[6,7,8,9],txt:"Inspectez tomates et basilics après chaque orage ou période humide : le mildiou démarre vite."},
 {cat:"potager",mois:[10],txt:"Récoltez les dernières tomates vertes avant les premières gelées : elles mûrissent à l'intérieur."},
 {cat:"potager",mois:[11,12,1],txt:"Nettoyez et désinfectez les pots, renouvelez le terreau pour la saison suivante."},
 {cat:"exterieur",mois:[2,3],txt:"Taille principale des rosiers en fin d'hiver, au-dessus d'un bourgeon tourné vers l'extérieur."},
 {cat:"exterieur",mois:[4,5,6,7,8,9],txt:"Retirez les fleurs fanées, surveillez pucerons et oïdium, engrais après la première floraison."},
 {cat:"exterieur",mois:[11,12,1,2],txt:"Protégez les pots du gel : surélevez-les, entourez-les, paillez la surface."}
];
