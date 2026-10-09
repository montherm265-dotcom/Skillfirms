// Generates a sitemap.xml covering real catalog content -- career
// roles, published courses, published missions -- not just the static
// top-level routes. Deliberately leaves out /verify/:code pages: there's
// no way to list "all public credential codes" without effectively
// publishing an enumerable directory of every credential ever issued,
// which nobody opted into. Uses the anon key so RLS does the filtering,
// same pattern as Talfirms' sitemap function.
//
// Deploy: `supabase functions deploy skillfirms-sitemap`

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SITE_URL = 'https://skillfirms.com';
const MAX_PER_TYPE = 5000;

function urlEntry(loc: string, priority: string) {
  return `  <url><loc>${SITE_URL}${loc}</loc><priority>${priority}</priority></url>`;
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const [roles, courses, missions] = await Promise.all([
    supabase.from('skillfirms_career_roles').select('slug').limit(MAX_PER_TYPE),
    supabase.from('skillfirms_courses').select('slug').eq('status', 'published').limit(MAX_PER_TYPE),
    supabase.from('skillfirms_missions').select('slug').eq('status', 'published').limit(MAX_PER_TYPE),
  ]);

  const entries = [
    urlEntry('/', '1.0'),
    urlEntry('/roles', '0.8'),
    urlEntry('/missions', '0.8'),
    ...(roles.data ?? []).map((r) => urlEntry(`/roles/${r.slug}`, '0.7')),
    ...(courses.data ?? []).map((c) => urlEntry(`/courses/${c.slug}`, '0.7')),
    ...(missions.data ?? []).map((m) => urlEntry(`/missions/${m.slug}`, '0.6')),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
});
