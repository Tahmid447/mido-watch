-- Respect profile region and sort by the next actual release event, not a past date.
create function public.upcoming_releases(p_region text default 'JP', p_today date default (now() at time zone 'Asia/Tokyo')::date)
returns table(title_id uuid,title text,provider text,region text,event_date date,event_type text,source_url text)
language sql stable security invoker set search_path='' as $$
 select a.title_id,t.title,a.provider,a.region,e.event_date,e.event_type,a.source_url
 from public.availability a join public.titles t on (t.user_id,t.id)=(a.user_id,a.title_id)
 cross join lateral (select * from (values(a.release_on,'Release'),(a.ott_on,'OTT'),(a.theatrical_on,'Theatrical')) dates(event_date,event_type)
 where event_date>=p_today order by event_date limit 1) e
 where a.region=p_region and a.verified_on is not null and a.source_url is not null
 order by e.event_date,t.title,a.id limit 8;
$$;
revoke execute on function public.upcoming_releases(text,date) from public,anon;
grant execute on function public.upcoming_releases(text,date) to authenticated;
alter table public.availability add constraint verified_availability_source check(verified_on is null or source_url is not null);
