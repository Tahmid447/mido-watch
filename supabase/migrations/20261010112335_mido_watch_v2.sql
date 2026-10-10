-- Private per-user catalog. Composite foreign keys prevent cross-owner relationships.
create table public.titles (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 300), original_title text,
 media_type text not null check(media_type in ('movie','series')), release_year integer check(release_year between 1800 and 2200),
 country text not null default '', synopsis text not null default '', poster_url text, imdb_id text check(imdb_id ~ '^tt[0-9]+$'), tmdb_id integer check(tmdb_id>0),
 provider_ids jsonb not null default '{}', tags text[] not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,id)
);
create unique index titles_identity on public.titles(user_id,lower(regexp_replace(trim(title),'\s+',' ','g')),media_type,coalesce(release_year,0),lower(trim(country)));
create unique index titles_imdb on public.titles(user_id,imdb_id) where imdb_id is not null;
create unique index titles_tmdb on public.titles(user_id,media_type,tmdb_id) where tmdb_id is not null;
create index titles_tags on public.titles using gin(tags);
create table public.watch_entries (
 user_id uuid not null default auth.uid(), title_id uuid not null, primary key(user_id,title_id),
 status text not null default 'interested' check(status in ('interested','not-watched','watching','watched','skip')),
 rating numeric check(rating between 1 and 10), notes text not null default '', priority integer not null default 50 check(priority between 0 and 100),
 started_on date, completed_on date, favorite boolean not null default false, updated_at timestamptz not null default now(),
 foreign key(user_id,title_id) references public.titles(user_id,id) on delete cascade
);
create index watch_status on public.watch_entries(user_id,status,priority desc);
create table public.seasons (
 user_id uuid not null default auth.uid(), title_id uuid not null, number integer not null check(number between 0 and 1000), primary key(user_id,title_id,number),
 status text not null default 'not-watched' check(status in ('interested','not-watched','watching','watched','skip')),
 rating numeric check(rating between 1 and 10), notes text not null default '', rank integer check(rank>0), completed_on date, updated_at timestamptz not null default now(),
 foreign key(user_id,title_id) references public.titles(user_id,id) on delete cascade
);
create table public.review_snapshots (
 id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid(), title_id uuid not null,
 source text not null, score text, score_type text not null default 'source-specific', critic_score text, audience_score text, vote_count bigint check(vote_count>=0),
 captured_on date, source_url text, notes text not null default '', verified boolean not null default false, updated_at timestamptz not null default now(),
 check(not verified or (source_url is not null and captured_on is not null)),
 foreign key(user_id,title_id) references public.titles(user_id,id) on delete cascade
);
create index reviews_title on public.review_snapshots(user_id,title_id);
create table public.availability (
 id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid(),title_id uuid not null,
 region text not null check(region ~ '^[A-Z]{2}$'), provider text not null, kind text not null default 'unknown' check(kind in ('subscription','rent','buy','theatrical','unknown')),
 release_on date, ott_on date, theatrical_on date, verified_on date, source_url text, notes text not null default '', updated_at timestamptz not null default now(),
 foreign key(user_id,title_id) references public.titles(user_id,id) on delete cascade
);
create index availability_title on public.availability(user_id,title_id);
create index availability_region on public.availability(user_id,region,release_on);
create table public.recommendations (
 user_id uuid not null default auth.uid(), title_id uuid not null, primary key(user_id,title_id), recommended_on date not null default current_date,
 priority integer not null default 50 check(priority between 0 and 100), reason text not null, fit text not null default '', caveat text not null default '', availability_note text not null default '',
 source text not null default 'Manual', state text not null default 'new' check(state in ('new','accepted','dismissed')), updated_at timestamptz not null default now(),
 foreign key(user_id,title_id) references public.titles(user_id,id) on delete cascade
);
create table public.taste_signals (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, signal text not null check(length(trim(signal)) between 1 and 100), weight integer not null check(weight between -5 and 5), notes text not null default '', updated_at timestamptz not null default now(), primary key(user_id,signal)
);
create table public.profiles (
 user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,display_name text not null default 'Mido', region text not null default 'JP' check(region ~ '^[A-Z]{2}$'),updated_at timestamptz not null default now()
);
create function public.check_season_parent() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if not exists(select 1 from public.titles where id=new.title_id and user_id=new.user_id and media_type='series') then raise exception 'Seasons require an owned series'; end if; return new;
end $$;
create trigger season_parent before insert or update on public.seasons for each row execute function public.check_season_parent();
create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin
 foreach t in array array['titles','watch_entries','seasons','review_snapshots','availability','recommendations','taste_signals','profiles'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy owner_access on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('create trigger set_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
 end loop;
end $$;
-- Every RPC is SECURITY INVOKER: all reads/writes remain subject to RLS.
create function public.title_document(t public.titles) returns jsonb language sql stable security invoker set search_path='' as $$
 select to_jsonb(t)-'user_id'-'created_at' || jsonb_build_object(
 'watch',(select to_jsonb(w)-'user_id'-'title_id' from public.watch_entries w where w.title_id=t.id and w.user_id=t.user_id),
 'seasons',coalesce((select jsonb_agg(to_jsonb(s)-'user_id'-'title_id' order by s.number) from public.seasons s where s.title_id=t.id and s.user_id=t.user_id),'[]'),
 'reviews',coalesce((select jsonb_agg(to_jsonb(r)-'user_id'-'title_id'-'id'-'updated_at') from public.review_snapshots r where r.title_id=t.id and r.user_id=t.user_id),'[]'),
 'availability',coalesce((select jsonb_agg(to_jsonb(a)-'user_id'-'title_id'-'id'-'updated_at') from public.availability a where a.title_id=t.id and a.user_id=t.user_id),'[]'),
 'recommendation',(select to_jsonb(r)-'user_id'-'title_id'-'updated_at' from public.recommendations r where r.title_id=t.id and r.user_id=t.user_id));
$$;
create function public.import_library(payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare x jsonb; s jsonb; tid uuid; added integer:=0; skipped integer:=0; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if payload->>'version'<>'2' or jsonb_typeof(payload->'titles')<>'array' then raise exception 'Invalid backup'; end if;
 if jsonb_array_length(payload->'titles')>10000 then raise exception 'Too many titles'; end if;
 for x in select value from jsonb_array_elements(payload->'titles') loop
  tid:=null;
  insert into public.titles(title,original_title,media_type,release_year,country,synopsis,poster_url,imdb_id,tmdb_id,provider_ids,tags)
  values(x->>'title',x->>'original_title',x->>'media_type',(x->>'release_year')::int,coalesce(x->>'country',''),coalesce(x->>'synopsis',''),x->>'poster_url',x->>'imdb_id',(x->>'tmdb_id')::int,coalesce(x->'provider_ids','{}'),array(select jsonb_array_elements_text(coalesce(x->'tags','[]'))))
  on conflict do nothing returning id into tid;
  if tid is null then skipped:=skipped+1; continue; end if;
  s:=x->'watch';
  insert into public.watch_entries(title_id,status,rating,notes,priority,started_on,completed_on,favorite) values(tid,s->>'status',(s->>'rating')::numeric,coalesce(s->>'notes',''),(s->>'priority')::int,(s->>'started_on')::date,(s->>'completed_on')::date,coalesce((s->>'favorite')::boolean,false));
  for s in select value from jsonb_array_elements(coalesce(x->'seasons','[]')) loop
   if x->>'media_type'<>'series' then raise exception 'Movies cannot have seasons'; end if;
   insert into public.seasons(title_id,number,status,rating,notes,rank,completed_on) values(tid,(s->>'number')::int,s->>'status',(s->>'rating')::numeric,coalesce(s->>'notes',''),(s->>'rank')::int,(s->>'completed_on')::date);
  end loop;
  for s in select value from jsonb_array_elements(coalesce(x->'reviews','[]')) loop
   insert into public.review_snapshots(title_id,source,score,score_type,critic_score,audience_score,vote_count,captured_on,source_url,notes,verified) values(tid,s->>'source',s->>'score',coalesce(s->>'score_type','source-specific'),s->>'critic_score',s->>'audience_score',(s->>'vote_count')::bigint,(s->>'captured_on')::date,s->>'source_url',coalesce(s->>'notes',''),coalesce((s->>'verified')::boolean,false));
  end loop;
  for s in select value from jsonb_array_elements(coalesce(x->'availability','[]')) loop
   insert into public.availability(title_id,region,provider,kind,release_on,ott_on,theatrical_on,verified_on,source_url,notes) values(tid,s->>'region',s->>'provider',s->>'kind',(s->>'release_on')::date,(s->>'ott_on')::date,(s->>'theatrical_on')::date,(s->>'verified_on')::date,s->>'source_url',coalesce(s->>'notes',''));
  end loop;
  s:=x->'recommendation';
  if s is not null and s<>'null'::jsonb then
   insert into public.recommendations(title_id,recommended_on,priority,reason,fit,caveat,availability_note,source,state) values(tid,(s->>'recommended_on')::date,(s->>'priority')::int,s->>'reason',s->>'fit',s->>'caveat',s->>'availability_note',s->>'source',s->>'state');
  end if;
  added:=added+1;
 end loop;
 for s in select value from jsonb_array_elements(coalesce(payload->'taste','[]')) loop
  insert into public.taste_signals(signal,weight,notes) values(s->>'signal',(s->>'weight')::int,coalesce(s->>'notes','')) on conflict do nothing;
 end loop;
 if payload ? 'profile' then insert into public.profiles(display_name,region) values(payload->'profile'->>'display_name',payload->'profile'->>'region') on conflict do nothing; end if;
 return jsonb_build_object('added',added,'skipped',skipped);
end $$;
create function public.library_page(filters jsonb default '{}') returns jsonb language sql stable security invoker set search_path='' as $$
 with matched as (
 select t.*,w.priority,w.rating,w.status,w.updated_at as watched_update from public.titles t join public.watch_entries w on (w.user_id,w.title_id)=(t.user_id,t.id)
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
 select id from matched order by
 case when filters->>'sort'='title' then title end asc,
 case when filters->>'sort'='rating' then rating end desc nulls last,
 case when filters->>'sort'='recent' then watched_update end desc,
 case when coalesce(filters->>'sort','priority')='priority' then priority end desc,title,id
 limit least(greatest(coalesce((filters->>'limit')::int,24),1),100) offset greatest(coalesce((filters->>'offset')::int,0),0)
 ) select jsonb_build_object('total',(select count(*) from matched),'titles',coalesce((select jsonb_agg(public.title_document(t)) from page p join public.titles t on t.id=p.id),'[]'));
$$;
create function public.export_library() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('version',2,'exportedAt',now(),'titles',coalesce((select jsonb_agg(public.title_document(t)) from public.titles t),'[]'), 'taste',coalesce((select jsonb_agg(to_jsonb(s)-'user_id'-'updated_at') from public.taste_signals s),'[]'),'profile',coalesce((select to_jsonb(p)-'user_id'-'updated_at' from public.profiles p where p.user_id=auth.uid()),'{"display_name":"Mido","region":"JP"}'));
$$;
revoke execute on function public.touch_updated_at(),public.check_season_parent(),public.title_document(public.titles),public.import_library(jsonb),public.library_page(jsonb),public.export_library() from public,anon;
grant execute on function public.title_document(public.titles),public.import_library(jsonb),public.library_page(jsonb),public.export_library() to authenticated;
