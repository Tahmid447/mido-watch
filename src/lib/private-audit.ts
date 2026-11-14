/** Offline preparation only. No network, credentials, public endpoint or hosted mutation. */
import { z } from "zod";
const journal = z.object({
  status: z
    .enum(["watched", "watching", "interested", "not-watched", "skip"])
    .optional(),
  initial_status: z.enum(["watching", "interested", "not-watched"]).optional(),
  confirmed: z.boolean().optional(),
  confirmation_needed: z.boolean().optional(),
  rating: z.number().min(1).max(10).optional(),
  rank: z.number().int().positive().optional(),
  reaction: z.string().max(10000).optional(),
});
export const privateAuditSchema = z.object({
  schema_version: z.literal(1),
  project_ref: z.string().regex(/^[a-z]{20}$/),
  owner_id: z.uuid(),
  source_date: z.iso.date(),
  updates: z
    .array(
      journal.extend({
        title: z.string().min(1).max(300),
        media_type: z.enum(["movie", "series"]).nullable().optional(),
        aliases: z.array(z.string().min(1).max(300)).max(20).default([]),
        country: z.string().max(100).optional(),
        confirmation_needed: z.boolean().optional(),
        identity_review: z.boolean().optional(),
        requested_skip: z.boolean().optional(),
        deprioritize: z.boolean().optional(),
        priority: z.number().int().min(0).max(100).optional(),
        seasons: z
          .array(journal.extend({ number: z.number().int().min(0).max(1000) }))
          .max(100)
          .default([]),
      }),
    )
    .max(500),
  taste: z
    .array(
      z.object({
        signal: z.string().min(1).max(100),
        weight: z.number().int().min(-5).max(5),
        notes: z.string().max(10000).default(""),
      }),
    )
    .max(200),
  plan: z
    .array(
      z.object({
        title: z.string().min(1).max(300),
        season_number: z.number().int().min(0).max(1000).optional(),
        label: z.string().max(300).default(""),
        week: z.number().int().min(1).max(4).nullable(),
      }),
    )
    .max(200),
  metadata_choices: z
    .array(
      z.object({
        title: z.string(),
        media_type: z.enum(["movie", "series"]),
        tmdb_id: z.number().int().positive(),
      }),
    )
    .default([]),
  keep_manual_review: z.array(z.string()).default([]),
});
export function buildPrivateAuditSql(input: unknown, expectedProject: string) {
  const p = privateAuditSchema.parse(input);
  if (p.project_ref !== expectedProject)
    throw new Error("Project does not match the explicitly selected target.");
  const raw = JSON.stringify(p);
  let delimiter = "$private_audit$";
  while (raw.includes(delimiter)) delimiter = delimiter.slice(0, -1) + "x$";
  const literal = "'" + raw.replaceAll("'", "''") + "'";
  return `-- PRIVATE generated data. Never commit. Apply only to the verified project ${p.project_ref}.\nbegin;
do $owner_check$ begin if not exists(select 1 from auth.users where id='${p.owner_id}') then raise exception 'Expected owner account not found'; end if; end $owner_check$;
set local role authenticated;
select set_config('request.jwt.claim.sub','${p.owner_id}',true);
do ${delimiter}
declare payload jsonb:=${literal}::jsonb; x jsonb; j jsonb; t public.titles; tid uuid; candidates uuid[]; s jsonb; note text; next_pos int:=0; plan_state text; begin
 if auth.uid()<>(payload->>'owner_id')::uuid then raise exception 'Owner mismatch'; end if;
 for x in select value from jsonb_array_elements(payload->'updates') loop
  tid:=null;
  select array_agg(id) into candidates from public.titles where user_id=auth.uid() and (nullif(x->>'media_type','') is null or media_type=x->>'media_type') and (lower(title)=lower(x->>'title') or exists(select 1 from jsonb_array_elements_text(x->'aliases') a where lower(title)=lower(a)));
  if coalesce(cardinality(candidates),0)>1 then raise notice 'Ambiguous identity kept for review'; continue; end if;
  if coalesce(cardinality(candidates),0)=1 then tid:=candidates[1];
  elsif nullif(x->>'media_type','') is not null and not coalesce((x->>'identity_review')::boolean,false) then
   insert into public.titles(title,media_type,country) values(x->>'title',x->>'media_type',coalesce(x->>'country','')) returning id into tid;
   insert into public.watch_entries(title_id,status) values(tid,coalesce(x->>'initial_status','interested'));
  else raise notice 'Unresolved identity kept for review'; continue; end if;
  select * into t from public.titles where id=tid and user_id=auth.uid() for update;
  note:=coalesce(x->>'reaction','');
  update public.watch_entries set
   status=case when x->>'status'='watched' and coalesce((x->>'confirmed')::boolean,false) then 'watched' when status='watched' then status when coalesce((x->>'requested_skip')::boolean,false) then 'skip' when x->>'initial_status'='watching' and status in ('interested','not-watched') then 'watching' else status end,
   rating=case when x ? 'rating' then (x->>'rating')::numeric else rating end,
   notes=case when note='' or strpos(notes,note)>0 then notes else concat_ws(E'\\n\\n',nullif(notes,''),note) end,
   priority=coalesce((x->>'priority')::int,priority),in_library=true,
   confirmation_needed=case when coalesce((x->>'confirmed')::boolean,false) then false else coalesce((x->>'confirmation_needed')::boolean,confirmation_needed) end,
   confirmed_at=case when coalesce((x->>'confirmed')::boolean,false) then now() else confirmed_at end
  where title_id=tid and user_id=auth.uid();
  for j in select value from jsonb_array_elements(x->'seasons') loop
   if t.media_type<>'series' then raise exception 'Season identity conflict'; end if;
   insert into public.seasons(title_id,number,status) values(tid,(j->>'number')::int,coalesce(j->>'initial_status','not-watched')) on conflict do nothing;
   note:=coalesce(j->>'reaction','');
   update public.seasons set
    status=case when j->>'status'='watched' and coalesce((j->>'confirmed')::boolean,false) then 'watched' when status='watched' then status when j->>'initial_status'='watching' and status in ('interested','not-watched') then 'watching' else status end,
    rating=case when j ? 'rating' then (j->>'rating')::numeric else rating end,rank=coalesce((j->>'rank')::int,rank),
    notes=case when note='' or strpos(notes,note)>0 then notes else concat_ws(E'\\n\\n',nullif(notes,''),note) end,
    confirmation_needed=case when coalesce((j->>'confirmed')::boolean,false) then false else coalesce((j->>'confirmation_needed')::boolean,confirmation_needed) end,
    confirmed_at=case when coalesce((j->>'confirmed')::boolean,false) then now() else confirmed_at end
   where title_id=tid and user_id=auth.uid() and number=(j->>'number')::int;
  end loop;
 end loop;
 for x in select value from jsonb_array_elements(payload->'taste') loop
  insert into public.taste_signals(signal,weight,notes) values(x->>'signal',(x->>'weight')::int,x->>'notes') on conflict(user_id,signal) do update set weight=excluded.weight,notes=case when excluded.notes='' or strpos(public.taste_signals.notes,excluded.notes)>0 then public.taste_signals.notes else concat_ws(E'\\n\\n',nullif(public.taste_signals.notes,''),excluded.notes) end;
 end loop;
 if not exists(select 1 from public.plan_items where user_id=auth.uid()) then
  for x in select value from jsonb_array_elements(payload->'plan') loop
   select array_agg(id) into candidates from public.titles where user_id=auth.uid() and lower(title)=lower(x->>'title');
   if coalesce(cardinality(candidates),0)<>1 then raise exception 'A private plan title needs review before applying'; end if;tid:=candidates[1];
   if x->>'season_number' is not null then
    insert into public.seasons(title_id,number,status,confirmation_needed) values(tid,(x->>'season_number')::int,'not-watched',true) on conflict do nothing;
    select status into plan_state from public.seasons where title_id=tid and number=(x->>'season_number')::int and user_id=auth.uid();
   else select status into plan_state from public.watch_entries where title_id=tid and user_id=auth.uid();end if;
   insert into public.plan_items(title_id,season_number,week,position,is_backup,status,label) values(tid,(x->>'season_number')::int,(x->>'week')::int,next_pos,x->>'week' is null,case when plan_state='watched' then 'completed' when plan_state='watching' then 'started' else 'planned' end,x->>'label');next_pos:=next_pos+1;
  end loop;
 end if;
end ${delimiter};
commit;\n`;
}
