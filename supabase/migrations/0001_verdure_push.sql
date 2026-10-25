-- Verdure : abonnements aux notifications de soins et envoi quotidien.
-- Les secrets (clés VAPID, secret de la tâche planifiée) vivent dans Supabase Vault :
--   verdure_vapid_keys  : {"publicKey": JWK, "privateKey": JWK}
--   verdure_cron_secret : chaîne aléatoire partagée entre la tâche planifiée et la fonction

create table if not exists public.verdure_subscriptions (
  endpoint   text primary key check (endpoint like 'https://%'),
  p256dh     text not null,
  auth       text not null,
  tasks      jsonb not null default '[]'::jsonb check (octet_length(tasks::text) < 20000),
  updated_at timestamptz not null default now()
);

-- Aucun accès direct depuis le navigateur : tout passe par la fonction verdure-push.
alter table public.verdure_subscriptions enable row level security;
revoke all on public.verdure_subscriptions from anon, authenticated;

-- Lecture d'un secret du coffre, réservée à la clé serveur des fonctions.
create or replace function public.verdure_secret(secret_name text)
returns text language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = secret_name and name like 'verdure\_%' limit 1;
$$;
revoke all on function public.verdure_secret(text) from public, anon, authenticated;
grant execute on function public.verdure_secret(text) to service_role;

-- Tous les jours à 7 h UTC (8 h ou 9 h à Paris), la fonction envoie les rappels du jour.
select cron.schedule('verdure-daily-push', '0 7 * * *', $$
  select net.http_post(
    url := 'https://tpautawxuufeontnhjjc.supabase.co/functions/v1/verdure-push/send',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'verdure_cron_secret')),
    body := '{}'::jsonb
  );
$$);
