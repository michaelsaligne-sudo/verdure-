# Verdure

Carnet de soins gratuit pour vos plantes, installable sur iPhone et Android comme une appli (PWA).

**Ouvrir l'appli : https://michaelsaligne-sudo.github.io/verdure-/**

## Fonctions
- **Jardin** : vos plantes, avec photo, pièce et tâches du jour (arrosage, brumisation, engrais, rempotage).
- **Notifications** : un rappel chaque matin vers 8 h quand une plante a besoin de vous.
- **Identifier** : photo d'une feuille ou d'une fleur, reconnue par [Pl@ntNet](https://plantnet.org) (clé gratuite à saisir dans Réglages).
- **Diagnostic** : causes probables et gestes à faire selon les symptômes.
- **Fiches** : 26 plantes courantes et un estimateur de lumière.
- **Sauvegarde** : export et restauration de vos données (elles restent sur votre téléphone).

## Installer sur iPhone
1. Ouvrir le lien ci-dessus dans **Safari**.
2. Bouton Partager, puis **Sur l'écran d'accueil**.
3. Ouvrir Verdure depuis son icône, aller dans **Réglages** et activer les notifications (iOS 16.4 ou plus récent).

## Technique
- Appli statique (HTML, CSS, JavaScript sans dépendance) servie par GitHub Pages, hors ligne grâce au service worker `sw.js`.
- Rappels : fonction Supabase `supabase/functions/verdure-push` et tâche planifiée quotidienne (`supabase/migrations/0001_verdure_push.sql`). Les clés VAPID et le secret de la tâche sont dans Supabase Vault (`verdure_vapid_keys`, `verdure_cron_secret`), jamais dans ce dépôt.
- Le téléphone n'envoie au serveur que la liste des prochains soins (date et texte), pour pouvoir envoyer les rappels.

Contenus de soins originaux. Aucun code, texte ni image d'une autre appli n'a été repris.
