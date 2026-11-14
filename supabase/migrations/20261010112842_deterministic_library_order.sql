-- Keep pagination order deterministic through joins, and rank recommendations by their own priority.
create or replace function public.library_page(filters jsonb default '{}') returns jsonb language sql stable security invoker set search_path='' as $$
 with matched as (
 select t.*,case when filters->>'recommended'='true' then coalesce((select r.priority from public.recommendations r where r.user_id=t.user_id and r.title_id=t.id),w.priority) else w.priority end as priority,w.rating,w.status,w.updated_at as watched_update from public.titles t join public.watch_entries w on (w.user_id,w.title_id)=(t.user_id,t.id)
 where (coalesce(filters->>'q','')='' or strpos(lower(t.title||' '||t.country||' '||w.notes),lower(filters->>'q'))>0)
 and (coalesce(filters->>'status','')='' or w.status=filters->>'status')
 and (coalesce(filters->>'type','')='' or t.media_type=filters->>'type')
 and (coalesce(filters->>'country','')='' or strpos(lower(t.country),lower(filters->>'country'))>0)
 and (coalesce(filters->>'tag','')='' or exists(select 1 from unnest(t.tags) tag where strpos(lower(tag),lower(filters->>'tag'))>0))
 and (coalesce(filters->>'platform','')='' or exists(select 1 from public.availability a where a.title_id=t.id and a.user_id=t.user_id and strpos(lower(a.provider),lower(filters->>'platform'))>0))
 and (coalesce(filters->>'rating','')='' or w.rating>= (filters->>'rating')::numeric)
 and (coalesce(filters->>'priority','')='' or w.priority>= (filters->>'priority')::int)
 and (coalesce(filters->>'year','')='' or t.release_year=(filters->>'year')::int)
 and (coalesce(filters->>'recommended','')<>'true' or exists(select 1 from public.recommendations r where r.title_id=t.id and r.user_id=t.user_id and r.state<>'dismissed'))
 ), page as (
 select id,row_number() over(order by
 case when filters->>'sort'='title' then title end asc,
 case when filters->>'sort'='rating' then rating end desc nulls last,
 case when filters->>'sort'='recent' then watched_update end desc,
 case when coalesce(filters->>'sort','priority')='priority' then priority end desc,title,id) as ordinal from matched
 order by ordinal
 limit least(greatest(coalesce((filters->>'limit')::int,24),1),100) offset greatest(coalesce((filters->>'offset')::int,0),0)
 ) select jsonb_build_object('total',(select count(*) from matched),'titles',coalesce((select jsonb_agg(public.title_document(t) order by p.ordinal) from page p join public.titles t on t.id=p.id),'[]'));
$$;
