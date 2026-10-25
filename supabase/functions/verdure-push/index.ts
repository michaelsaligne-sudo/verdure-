/* Fonction Supabase « verdure-push » : rappels de soins des plantes par notification.
   Routes :
     POST /subscribe    { subscription, tasks }  enregistre ou met à jour l'abonnement d'un téléphone
     POST /unsubscribe  { endpoint }             oublie un abonnement
     POST /test         { endpoint }             envoie tout de suite une notification d'essai
     POST /send                                  tâche planifiée quotidienne (en-tête x-cron-secret)
   Secrets lus dans Supabase Vault via public.verdure_secret : verdure_vapid_keys, verdure_cron_secret.
   Réglage : « Verify JWT » désactivé (l'appli n'a pas de compte utilisateur). */
import * as webpush from 'jsr:@negrel/webpush@0.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CONTACT = 'https://github.com/michaelsaligne-sudo/verdure-';
const GONE_STATUSES = new Set([404, 410]);
const MAX_TASKS = 200;

interface Task { due: string; text: string }
interface Row { endpoint: string; p256dh: string; auth: string; tasks: Task[] }

function serverKey(): string {
  try {
    const first = Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}'))[0];
    if (typeof first === 'string' && first) return first;
  } catch { /* format inattendu : on se rabat sur la clé historique */ }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!legacy) throw new Error('Aucune clé serveur disponible pour la fonction verdure-push');
  return legacy;
}

const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', serverKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function secret(name: string): Promise<string> {
  const { data, error } = await db.rpc('verdure_secret', { secret_name: name });
  if (error || typeof data !== 'string') throw new Error(`Secret ${name} introuvable`);
  return data;
}

const appServer = await webpush.ApplicationServer.new({
  contactInformation: CONTACT,
  vapidKeys: await webpush.importVapidKeys(JSON.parse(await secret('verdure_vapid_keys'))),
});
const cronSecret = await secret('verdure_cron_secret');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

function sameSecret(given: string): boolean {
  if (given.length !== cronSecret.length) return false;
  let diff = 0;
  for (let i = 0; i < cronSecret.length; i++) diff |= cronSecret.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

/* Date du jour à Paris, au format AAAA-MM-JJ */
const todayParis = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());

function cleanTasks(raw: unknown): Task[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_TASKS) return null;
  const tasks: Task[] = [];
  for (const t of raw) {
    if (!t || typeof t.due !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.due)) return null;
    if (typeof t.text !== 'string' || !t.text.trim()) return null;
    tasks.push({ due: t.due, text: t.text.trim().slice(0, 80) });
  }
  return tasks;
}

async function push(row: Pick<Row, 'endpoint' | 'p256dh' | 'auth'>, title: string, body: string): Promise<'sent' | 'gone' | string> {
  try {
    await appServer.subscribe({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } })
      .pushTextMessage(JSON.stringify({ title, body }),
        { urgency: webpush.Urgency.Normal, ttl: 12 * 3600 });
    return 'sent';
  } catch (err) {
    if (err instanceof webpush.PushMessageError) {
      if (GONE_STATUSES.has(err.response.status)) return 'gone';
      return `${err.response.status} ${await err.response.text().catch(() => '')}`.trim();
    }
    return String(err);
  }
}

function summary(due: Task[]): { title: string; body: string } {
  const n = due.length;
  const title = n === 1 ? 'Verdure : 1 soin aujourd\'hui' : `Verdure : ${n} soins aujourd'hui`;
  const shown = due.slice(0, 4).map(t => t.text);
  const body = shown.join(' · ') + (n > shown.length ? ` · et ${n - shown.length} autre(s)` : '');
  return { title, body };
}

async function handleSend(): Promise<Response> {
  const { data, error } = await db.from('verdure_subscriptions').select('endpoint, p256dh, auth, tasks');
  if (error) return json({ error: error.message }, 500);
  const today = todayParis();
  const results = await Promise.all((data as Row[]).map(async row => {
    const due = (row.tasks ?? []).filter(t => t.due <= today);
    if (!due.length) return { row, outcome: 'skip' };
    const { title, body } = summary(due);
    return { row, outcome: await push(row, title, body) };
  }));
  const gone = results.filter(r => r.outcome === 'gone').map(r => r.row.endpoint);
  if (gone.length) await db.from('verdure_subscriptions').delete().in('endpoint', gone);
  const failed = results.filter(r => !['sent', 'gone', 'skip'].includes(r.outcome));
  if (failed.length) console.error('verdure-push : envois en échec', failed.map(r => r.outcome));
  return json({ sent: results.filter(r => r.outcome === 'sent').length, gone: gone.length, failed: failed.length });
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Méthode non acceptée' }, 405);
  const route = new URL(req.url).pathname.split('/').pop();

  if (route === 'send') {
    if (!sameSecret(req.headers.get('x-cron-secret') ?? '')) return json({ error: 'Accès refusé' }, 401);
    return handleSend();
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Requête illisible' }, 400); }

  if (route === 'subscribe') {
    const sub = body.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
    const tasks = cleanTasks(body.tasks);
    if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://') || sub.endpoint.length > 1000
      || typeof sub.keys?.p256dh !== 'string' || typeof sub.keys?.auth !== 'string' || !tasks) {
      return json({ error: 'Abonnement invalide' }, 400);
    }
    const { error } = await db.from('verdure_subscriptions').upsert({
      endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, tasks, updated_at: new Date().toISOString(),
    });
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  if (route === 'unsubscribe' || route === 'test') {
    if (typeof body.endpoint !== 'string') return json({ error: 'Abonnement manquant' }, 400);
    if (route === 'unsubscribe') {
      const { error } = await db.from('verdure_subscriptions').delete().eq('endpoint', body.endpoint);
      return error ? json({ error: error.message }, 500) : json({ ok: true });
    }
    const { data, error } = await db.from('verdure_subscriptions')
      .select('endpoint, p256dh, auth').eq('endpoint', body.endpoint).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: 'Abonnement inconnu' }, 404);
    const outcome = await push(data, 'Verdure', 'Les notifications fonctionnent. Vos plantes vous remercient.');
    return outcome === 'sent' ? json({ ok: true }) : json({ error: outcome }, 502);
  }

  return json({ error: 'Route inconnue' }, 404);
});
