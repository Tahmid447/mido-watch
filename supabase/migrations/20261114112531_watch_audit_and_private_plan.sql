-- Generic structure only. No owner's watch history, reactions or personal plan is seeded here.
alter table public.watch_entries add column confirmation_needed boolean not null default false, add column confirmed_at timestamptz;
alter table public.seasons add column confirmation_needed boolean not null default false, add column confirmed_at timestamptz;
alter table public.review_snapshots add column category text not null default 'unknown' check(category in ('audience','critic','reviewer','unknown'));
create table public.plan_items (
 id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title_id uuid not null,season_number integer check(season_number between 0 and 1000),
 week integer check(week between 1 and 4),position integer not null check(position>=0),is_backup boolean not null default false,
 status text not null default 'planned' check(status in ('planned','started','completed','postponed','removed')),
 label text not null default '' check(length(label)<=300),updated_at timestamptz not null default now(),
 foreign key(user_id,title_id) references public.titles(user_id,id) on delete cascade,
 foreign key(user_id,title_id,season_number) references public.seasons(user_id,title_id,number),
 check((is_backup and week is null) or (not is_backup and week is not null)),
 constraint plan_position_unique unique(user_id,position) deferrable initially deferred
);
create unique index plan_scope_unique on public.plan_items(user_id,title_id,coalesce(season_number,-1)) where status<>'removed';
alter table public.plan_items enable row level security;
create policy owner_access on public.plan_items for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.plan_items to authenticated;
revoke all on public.plan_items from anon;
create trigger set_updated_at before update on public.plan_items for each row execute function public.touch_updated_at();

-- Unsure retains the existing verdict; explicit status changes confirm only the requested scope.
create function public.audit_status(p_title_id uuid,p_status text,p_season integer default null,p_expected timestamptz default null) returns void language plpgsql security invoker set search_path='' as $$
declare stamp timestamptz; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_status not in ('interested','not-watched','watching','watched','skip','unsure') or p_status is null then raise exception 'Invalid watch choice'; end if;
 if not exists(select 1 from public.titles where id=p_title_id and user_id=auth.uid() and (p_season is null or media_type='series')) then raise exception 'Owned title required'; end if;
 if p_season is null then
  select updated_at into stamp from public.watch_entries where title_id=p_title_id and user_id=auth.uid() for update;
  if stamp is null then raise exception 'Watch journal missing'; end if;
  if p_expected is not null and stamp<>p_expected then raise exception 'This journal changed. Reload before confirming.'; end if;
  update public.watch_entries set status=case when p_status='unsure' then status else p_status end,confirmation_needed=p_status='unsure',confirmed_at=case when p_status='unsure' then confirmed_at else now() end,in_library=case when p_status='unsure' then in_library else true end where title_id=p_title_id and user_id=auth.uid();
 else
  if p_season<0 or p_season>1000 then raise exception 'Invalid season'; end if;
  select updated_at into stamp from public.seasons where title_id=p_title_id and user_id=auth.uid() and number=p_season for update;
  if stamp is null and p_expected is not null then raise exception 'This season changed. Reload before confirming.'; end if;
  if stamp is not null and p_expected is not null and stamp<>p_expected then raise exception 'This season changed. Reload before confirming.'; end if;
  insert into public.seasons(title_id,number,status,confirmation_needed,confirmed_at) values(p_title_id,p_season,case when p_status='unsure' then 'not-watched' else p_status end,p_status='unsure',case when p_status='unsure' then null else now() end)
  on conflict(user_id,title_id,number) do update set status=case when p_status='unsure' then public.seasons.status else excluded.status end,confirmation_needed=excluded.confirmation_needed,confirmed_at=case when p_status='unsure' then public.seasons.confirmed_at else excluded.confirmed_at end;
 end if;
end $$;

-- All plan/journal changes commit together; per-owner profile locks serialize reorder operations.
create function public.edit_plan(p_action text,p_item_id uuid default null,p_title_id uuid default null,p_season_number integer default null,p_week integer default null,p_expected timestamptz default null,p_journal_expected timestamptz default null,p_label text default '') returns void language plpgsql security invoker set search_path='' as $$
declare item public.plan_items; neighbor public.plan_items; next_pos int; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into public.profiles(user_id) values(auth.uid()) on conflict do nothing;
 perform 1 from public.profiles where user_id=auth.uid() for update;
 if p_action in ('add','replace') then
  if not exists(select 1 from public.titles where id=p_title_id and user_id=auth.uid()) then raise exception 'Choose a title from your collection'; end if;
  if p_season_number is not null and not exists(select 1 from public.seasons where title_id=p_title_id and user_id=auth.uid() and number=p_season_number) then raise exception 'Choose a tracked season'; end if;
 end if;
 if p_action='add' then
  if (select count(*) from public.plan_items where user_id=auth.uid() and status<>'removed')>=200 then raise exception 'Your plan is full'; end if;
  select coalesce(max(position),-1)+1 into next_pos from public.plan_items where user_id=auth.uid();
  insert into public.plan_items(title_id,season_number,week,position,is_backup,label) values(p_title_id,p_season_number,p_week,next_pos,p_week is null,coalesce(p_label,''));return;
 end if;
 select * into item from public.plan_items where id=p_item_id and user_id=auth.uid() and status<>'removed' for update;
 if item.id is null then raise exception 'Plan item not found in your account'; end if;
 if p_expected is not null and item.updated_at<>p_expected then raise exception 'Your plan changed. Reload before editing.'; end if;
 if p_action in ('up','down') then
  if p_action='up' then select * into neighbor from public.plan_items where user_id=auth.uid() and status<>'removed' and position<item.position order by position desc limit 1 for update;
  else select * into neighbor from public.plan_items where user_id=auth.uid() and status<>'removed' and position>item.position order by position limit 1 for update; end if;
  if neighbor.id is null then return; end if;
  update public.plan_items set position=case when id=item.id then neighbor.position else item.position end,week=case when id=item.id then neighbor.week else item.week end,is_backup=case when id=item.id then neighbor.is_backup else item.is_backup end where user_id=auth.uid() and id in (item.id,neighbor.id);
 elsif p_action in ('start','complete') then
  perform public.audit_status(item.title_id,case when p_action='start' then 'watching' else 'watched' end,item.season_number,p_journal_expected);
  update public.plan_items set status=case when p_action='start' then 'started' else 'completed' end where id=item.id and user_id=auth.uid();
 elsif p_action='postpone' then update public.plan_items set status='postponed' where id=item.id and user_id=auth.uid();
 elsif p_action='remove' then update public.plan_items set status='removed' where id=item.id and user_id=auth.uid();
 elsif p_action='schedule' then update public.plan_items set week=p_week,is_backup=p_week is null,status='planned' where id=item.id and user_id=auth.uid();
 elsif p_action='replace' then update public.plan_items set title_id=p_title_id,season_number=p_season_number,label='',status='planned' where id=item.id and user_id=auth.uid();
 else raise exception 'Unknown plan action'; end if;
end $$;
revoke execute on function public.audit_status(uuid,text,integer,timestamptz),public.edit_plan(text,uuid,uuid,integer,integer,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.audit_status(uuid,text,integer,timestamptz),public.edit_plan(text,uuid,uuid,integer,integer,timestamptz,timestamptz,text) to authenticated;

-- Version-2 backups stay additive and retain audit choices and the plan.
create or replace function public.import_library(payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare x jsonb; s jsonb; tid uuid; added integer:=0; skipped integer:=0; had_plan boolean; plan_value jsonb; matches uuid[]; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select exists(select 1 from public.plan_items where user_id=auth.uid()) into had_plan;
 if payload->>'version'<>'2' or jsonb_typeof(payload->'titles')<>'array' then raise exception 'Invalid backup'; end if;
 if jsonb_array_length(payload->'titles')>10000 then raise exception 'Too many titles'; end if;
 for x in select value from jsonb_array_elements(payload->'titles') loop
  tid:=null;
  insert into public.titles(title,original_title,media_type,release_year,country,synopsis,poster_url,imdb_id,tmdb_id,provider_ids,tags,metadata)
  values(x->>'title',x->>'original_title',x->>'media_type',(x->>'release_year')::int,coalesce(x->>'country',''),coalesce(x->>'synopsis',''),x->>'poster_url',x->>'imdb_id',(x->>'tmdb_id')::int,coalesce(x->'provider_ids','{}'),array(select jsonb_array_elements_text(coalesce(x->'tags','[]'))),coalesce(x->'metadata','{"state":"missing"}'))
  on conflict do nothing returning id into tid;
  if tid is null then skipped:=skipped+1; continue; end if;
  s:=x->'watch';
  insert into public.watch_entries(title_id,status,rating,notes,priority,started_on,completed_on,favorite,in_library,confirmation_needed,confirmed_at) values(tid,s->>'status',(s->>'rating')::numeric,coalesce(s->>'notes',''),(s->>'priority')::int,(s->>'started_on')::date,(s->>'completed_on')::date,coalesce((s->>'favorite')::boolean,false),coalesce((s->>'in_library')::boolean,true),coalesce((s->>'confirmation_needed')::boolean,false),(s->>'confirmed_at')::timestamptz);
  for s in select value from jsonb_array_elements(coalesce(x->'seasons','[]')) loop
   if x->>'media_type'<>'series' then raise exception 'Movies cannot have seasons'; end if;
   insert into public.seasons(title_id,number,status,rating,notes,rank,completed_on,confirmation_needed,confirmed_at) values(tid,(s->>'number')::int,s->>'status',(s->>'rating')::numeric,coalesce(s->>'notes',''),(s->>'rank')::int,(s->>'completed_on')::date,coalesce((s->>'confirmation_needed')::boolean,false),(s->>'confirmed_at')::timestamptz);
  end loop;
  for s in select value from jsonb_array_elements(coalesce(x->'reviews','[]')) loop
   insert into public.review_snapshots(title_id,source,score,score_type,critic_score,audience_score,vote_count,captured_on,source_url,notes,verified,origin,evidence_key,category) values(tid,s->>'source',s->>'score',coalesce(s->>'score_type','source-specific'),s->>'critic_score',s->>'audience_score',(s->>'vote_count')::bigint,(s->>'captured_on')::date,s->>'source_url',coalesce(s->>'notes',''),coalesce((s->>'verified')::boolean,false),coalesce(s->>'origin','manual'),s->>'evidence_key',coalesce(s->>'category','unknown'));
  end loop;
  for s in select value from jsonb_array_elements(coalesce(x->'availability','[]')) loop
   insert into public.availability(title_id,region,provider,kind,release_on,ott_on,theatrical_on,verified_on,source_url,notes,origin,evidence_key,logo_path,fetched_at) values(tid,s->>'region',s->>'provider',s->>'kind',(s->>'release_on')::date,(s->>'ott_on')::date,(s->>'theatrical_on')::date,(s->>'verified_on')::date,s->>'source_url',coalesce(s->>'notes',''),coalesce(s->>'origin','manual'),s->>'evidence_key',s->>'logo_path',(s->>'fetched_at')::timestamptz);
  end loop;
  s:=x->'recommendation';
  if s is not null and s<>'null'::jsonb then
   insert into public.recommendations(title_id,recommended_on,priority,reason,fit,caveat,availability_note,source,state,generated_at,pack_hash,runtime_or_episode_count,history) values(tid,(s->>'recommended_on')::date,(s->>'priority')::int,s->>'reason',s->>'fit',s->>'caveat',s->>'availability_note',s->>'source',s->>'state',(s->>'generated_at')::timestamptz,s->>'pack_hash',coalesce(s->>'runtime_or_episode_count',''),coalesce(s->'history','[]'));
  end if;
  added:=added+1;
 end loop;
 for s in select value from jsonb_array_elements(coalesce(payload->'taste','[]')) loop
  insert into public.taste_signals(signal,weight,notes) values(s->>'signal',(s->>'weight')::int,coalesce(s->>'notes','')) on conflict do nothing;
 end loop;
 if payload ? 'profile' then insert into public.profiles(display_name,region) values(payload->'profile'->>'display_name',payload->'profile'->>'region') on conflict do nothing; end if;
 if jsonb_array_length(coalesce(payload->'plan','[]'))>200 then raise exception 'Too many plan items'; end if;
 if not had_plan then
  for plan_value in select value from jsonb_array_elements(coalesce(payload->'plan','[]')) loop
   x:=plan_value->'title_key';
   select array_agg(t.id) into matches from public.titles t where t.user_id=auth.uid() and t.media_type=x->>'media_type' and (((x->>'tmdb_id')::int is not null and t.tmdb_id=(x->>'tmdb_id')::int) or (nullif(x->>'imdb_id','') is not null and t.imdb_id=x->>'imdb_id'));
   if coalesce(cardinality(matches),0)=0 then select array_agg(t.id) into matches from public.titles t where t.user_id=auth.uid() and lower(t.title)=lower(x->>'title') and t.media_type=x->>'media_type' and t.release_year is not distinct from (x->>'release_year')::int and lower(t.country)=lower(coalesce(x->>'country','')); end if;
   if coalesce(cardinality(matches),0)<>1 then raise exception 'Plan title needs an unambiguous match'; end if;
   insert into public.plan_items(title_id,season_number,week,position,is_backup,status,label) values(matches[1],(plan_value->>'season_number')::int,(plan_value->>'week')::int,(plan_value->>'position')::int,coalesce((plan_value->>'is_backup')::boolean,false),coalesce(plan_value->>'status','planned'),coalesce(plan_value->>'label',''));
  end loop;
 end if;
 return jsonb_build_object('added',added,'skipped',skipped);
end $$;

create or replace function public.export_library() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('version',2,'exportedAt',now(),'titles',coalesce((select jsonb_agg(public.title_document(t)) from public.titles t),'[]'),
 'taste',coalesce((select jsonb_agg(to_jsonb(s)-'user_id'-'updated_at') from public.taste_signals s),'[]'),
 'profile',coalesce((select to_jsonb(p)-'user_id'-'updated_at' from public.profiles p where p.user_id=auth.uid()),'{"display_name":"Mido","region":"JP"}'),
 'plan',coalesce((select jsonb_agg(to_jsonb(p)-'id'-'title_id'-'user_id'-'updated_at'||jsonb_build_object('title_key',jsonb_build_object('title',t.title,'media_type',t.media_type,'release_year',t.release_year,'country',t.country,'tmdb_id',t.tmdb_id,'imdb_id',t.imdb_id)) order by p.position) from public.plan_items p join public.titles t on t.id=p.title_id and t.user_id=p.user_id),'[]'));
$$;

-- Keep imported reviewer categories while retaining pack replay protection.
create or replace function public.import_recommendation_pack(payload jsonb, p_pack_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare x jsonb; e jsonb; t public.titles; tid uuid; added int:=0; refreshed int:=0; kept int:=0; n int:=0; old public.recommendations; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if payload->>'schema_version'<>'1' or jsonb_typeof(payload->'recommendations')<>'array' or jsonb_array_length(payload->'recommendations')>100 then raise exception 'Invalid recommendation pack'; end if;
 for x in select value from jsonb_array_elements(payload->'recommendations') loop
  n:=n+1; tid:=null;
  if nullif(x->>'target_title_id','') is not null then
   select * into t from public.titles where id=(x->>'target_title_id')::uuid and user_id=auth.uid() for update;
   if t.id is null or t.media_type<>x->>'media_type' then raise exception 'Invalid matched title'; end if;
   if (t.tmdb_id is not null and nullif(x->>'tmdb_id','') is not null and t.tmdb_id<>(x->>'tmdb_id')::int) or (t.imdb_id is not null and nullif(x->>'imdb_id','') is not null and t.imdb_id<>x->>'imdb_id') then raise exception 'External IDs conflict with matched title'; end if;
   tid:=t.id;
  else
   insert into public.titles(title,original_title,media_type,release_year,country,imdb_id,tmdb_id)
   values(x->>'title',x->>'original_title',x->>'media_type',(x->>'release_year')::int,coalesce(x->>'country',''),x->>'imdb_id',(x->>'tmdb_id')::int) returning id into tid;
   insert into public.watch_entries(title_id,status,priority,in_library) values(tid,'interested',(x->>'priority')::int,false);
   added:=added+1;
  end if;
  select * into old from public.recommendations where title_id=tid and user_id=auth.uid();
  if old.pack_hash=p_pack_hash or exists(select 1 from jsonb_array_elements(coalesce(old.history,'[]')) h where h->>'pack_hash'=p_pack_hash) then kept:=kept+1; continue; end if;
  if nullif(x->>'target_title_id','') is not null then
   update public.titles set tmdb_id=coalesce(tmdb_id,(x->>'tmdb_id')::int),imdb_id=coalesce(imdb_id,x->>'imdb_id'),original_title=coalesce(original_title,x->>'original_title')
   where id=tid and user_id=auth.uid() and ((tmdb_id is null and nullif(x->>'tmdb_id','') is not null) or (imdb_id is null and nullif(x->>'imdb_id','') is not null) or (original_title is null and nullif(x->>'original_title','') is not null));
  end if;
  insert into public.recommendations(title_id,recommended_on,priority,reason,fit,caveat,source,generated_at,pack_hash,runtime_or_episode_count,history)
  values(tid,left(payload->>'generated_at',10)::date,(x->>'priority')::int,x->>'reason',coalesce(x->>'fit',''),coalesce(x->>'caveat',''),'ChatGPT Friday pack',(payload->>'generated_at')::timestamptz,p_pack_hash,coalesce(x->>'runtime_or_episode_count',''),case when old.title_id is null then '[]'::jsonb else old.history || jsonb_build_array(jsonb_build_object('generated_at',coalesce(old.generated_at::text,old.recommended_on::text),'pack_hash',old.pack_hash,'reason',old.reason,'fit',old.fit,'caveat',old.caveat,'priority',old.priority,'source',old.source)) end)
  on conflict(user_id,title_id) do update set recommended_on=excluded.recommended_on,priority=excluded.priority,reason=excluded.reason,fit=excluded.fit,caveat=excluded.caveat,source=excluded.source,generated_at=excluded.generated_at,pack_hash=excluded.pack_hash,runtime_or_episode_count=excluded.runtime_or_episode_count,history=excluded.history;
  refreshed:=refreshed+1;
  for e in select value from jsonb_array_elements(coalesce(x->'reviews','[]')) loop
   insert into public.review_snapshots(title_id,source,score,score_type,critic_score,audience_score,vote_count,captured_on,source_url,notes,verified,origin,evidence_key,category)
   values(tid,e->>'source',e->>'score',coalesce(e->>'score_type','source-specific'),e->>'critic_score',e->>'audience_score',(e->>'vote_count')::bigint,(e->>'captured_on')::date,e->>'source_url',coalesce(e->>'notes',''),coalesce((e->>'verified')::boolean,false),'chatgpt',p_pack_hash||':'||n||':review:'||md5(e::text),coalesce(e->>'category','unknown')) on conflict do nothing;
  end loop;
  for e in select value from jsonb_array_elements(coalesce(x->'availability','[]')) loop
   insert into public.availability(title_id,region,provider,kind,release_on,ott_on,theatrical_on,verified_on,source_url,notes,origin,evidence_key)
   values(tid,e->>'region',e->>'provider',e->>'kind',(e->>'release_on')::date,(e->>'ott_on')::date,(e->>'theatrical_on')::date,(e->>'verified_on')::date,e->>'source_url',coalesce(e->>'notes',''),'chatgpt',p_pack_hash||':'||n||':availability:'||md5(e::text)) on conflict do nothing;
  end loop;
 end loop;
 return jsonb_build_object('added',added,'refreshed',refreshed,'kept',kept);
end $$;
