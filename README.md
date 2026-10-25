# Verdure

Carnet de soins gratuit pour vos plantes, installable sur iPhone et Android comme une appli (PWA).

Hébergée gratuitement sur Vercel (import du dépôt, aucun réglage).

## Fonctions
- **Jardin** : vos plantes, avec photo, pièce et tâches du jour (arrosage, brumisation, engrais, rempotage).
- **Notifications** : un rappel chaque matin vers 8 h quand une plante a besoin de vous.
- **Identifier** : photo d une feuille ou d une fleur, reconnue par [Pl@ntNet](https://plantnet.org) directement depuis le téléphone (clé gratuite à saisir dans Réglages, avec « Expose my API key » coché et l'adresse du site dans « Authorized domains »).
- **Saison et météo** : alertes gel, chaleur, pluie et chauffage selon votre ville (Open-Meteo, gratuit, sans clé), arrosages adaptés à la saison, gestes du mois.
- **Diagnostic** : par photo avec Google Gemini (clé gratuite dans Réglages), qui tient compte de l'espèce, de vos arrosages, de la saison et de la météo, et donne les gestes à faire tout de suite ; sinon Pl@ntNet. Par symptômes : 44 signes, 41 problèmes (soins, ravageurs, maladies, phénomènes normaux) classés selon la plante, vos soins, la saison et la météo.
- **Fiches** : 61 plantes rangées par catégorie, avec terre, rempotage, hiver, taille et soucis fréquents, un calendrier des soins mois par mois et un estimateur de lumière.
- **Sauvegarde** : export et restauration de vos données (elles restent sur votre téléphone).

## Installer sur iPhone
1. Ouvrir l'adresse Vercel de l'appli dans **Safari**.
2. Bouton Partager, puis **Sur l'écran d'accueil**.
3. Ouvrir Verdure depuis son icône, aller dans **Réglages** et activer les notifications (iOS 16.4 ou plus récent).

## Technique
- Contenu : `data.js` (fiches), `fiches.js` (détails des fiches), `problems.js` (symptômes et problèmes), `saison.js` (calendrier, coefficients d'arrosage).
- Appli statique (HTML, CSS, JavaScript sans dépendance) servie par Vercel, hors ligne grâce au service worker `sw.js`.
- Rappels : fonction Supabase `supabase/functions/verdure-push` et tâche planifiée quotidienne (`supabase/migrations/0001_verdure_push.sql`). Les clés VAPID et le secret de la tâche sont dans Supabase Vault (`verdure_vapid_keys`, `verdure_cron_secret`), jamais dans ce dépôt.
- Le téléphone n'envoie au serveur que la liste des prochains soins (date et texte), pour pouvoir envoyer les rappels.

Contenus de soins originaux. Aucun code, texte ni image d'une autre appli n'a été repris.
