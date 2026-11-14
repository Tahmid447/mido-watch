-- Additive V2.1 metadata. Existing ownership policies and private journals remain intact.
alter table public.titles add column metadata jsonb not null default '{"state":"missing"}' check(jsonb_typeof(metadata)='object' and metadata->>'state' in ('missing','matched','needs-review','no-result','error'));
alter table public.watch_entries add column in_library boolean not null default true;
alter table public.review_snapshots add column origin text not null default 'manual' check(origin in ('manual','tmdb','chatgpt')), add column evidence_key text;
alter table public.availability add column origin text not null default 'manual' check(origin in ('manual','tmdb','chatgpt')), add column evidence_key text, add column logo_path text, add column fetched_at timestamptz;
alter table public.recommendations add column generated_at timestamptz, add column pack_hash text, add column runtime_or_episode_count text not null default '', add column history jsonb not null default '[]' check(jsonb_typeof(history)='array');
create unique index review_evidence on public.review_snapshots(user_id,title_id,evidence_key) where evidence_key is not null;
create unique index availability_evidence on public.availability(user_id,title_id,evidence_key) where evidence_key is not null;

-- Only metadata and TMDb-owned evidence may change here. No personal journal writes.
create function public.apply_title_metadata(p_title_id uuid, payload jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare t public.titles; s jsonb; begin
 select * into t from public.titles where id=p_title_id and user_id=auth.uid() for update;
 if t.id is null then raise exception 'Owned title required'; end if;
 update public.titles set metadata=payload->'metadata',
 tmdb_id=coalesce((payload->>'tmdb_id')::int,tmdb_id), original_title=coalesce(payload->>'original_title',original_title),
 synopsis=coalesce(nullif(payload->>'synopsis',''),synopsis), imdb_id=coalesce(payload->>'imdb_id',imdb_id),
 release_year=coalesce(release_year,(payload->>'release_year')::int) where id=t.id and user_id=auth.uid();
 if payload ? 'tmdb_id' then
  for s in select value from jsonb_array_elements(coalesce(payload->'metadata'->'season_info','[]')) loop
   if t.media_type='series' and (s->>'number')::int>0 then
    insert into public.seasons(title_id,number,status) values(t.id,(s->>'number')::int,'not-watched') on conflict do nothing;
   end if;
  end loop;
  delete from public.review_snapshots where title_id=t.id and user_id=auth.uid() and origin='tmdb';
  for s in select value from jsonb_array_elements(coalesce(payload->'reviews','[]')) loop
   insert into public.review_snapshots(title_id,source,score,score_type,vote_count,captured_on,source_url,verified,origin,evidence_key,notes)
   values(t.id,s->>'source',s->>'score',s->>'score_type',(s->>'vote_count')::bigint,(s->>'captured_on')::date,s->>'source_url',true,'tmdb',s->>'evidence_key',coalesce(s->>'notes',''));
  end loop;
  delete from public.availability where title_id=t.id and user_id=auth.uid() and origin='tmdb' and region=payload->>'region';
  for s in select value from jsonb_array_elements(coalesce(payload->'availability','[]')) loop
   insert into public.availability(title_id,region,provider,kind,origin,evidence_key,logo_path,fetched_at,source_url,notes)
   values(t.id,s->>'region',s->>'provider',s->>'kind','tmdb',s->>'evidence_key',s->>'logo_path',(s->>'fetched_at')::timestamptz,s->>'source_url',coalesce(s->>'notes',''));
  end loop;
 end if;
end $$;

-- The confirmed pack is atomic, replay-safe, and can never update personal fields.
create function public.import_recommendation_pack(payload jsonb, p_pack_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
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
  if old.pack_hash=p_pack_hash then kept:=kept+1; continue; end if;
  insert into public.recommendations(title_id,recommended_on,priority,reason,fit,caveat,source,generated_at,pack_hash,runtime_or_episode_count,history)
  values(tid,(payload->>'generated_at')::timestamptz::date,(x->>'priority')::int,x->>'reason',coalesce(x->>'fit',''),coalesce(x->>'caveat',''),'ChatGPT Friday pack',(payload->>'generated_at')::timestamptz,p_pack_hash,coalesce(x->>'runtime_or_episode_count',''),case when old.title_id is null then '[]'::jsonb else old.history || jsonb_build_array(jsonb_build_object('generated_at',coalesce(old.generated_at::text,old.recommended_on::text),'reason',old.reason,'fit',old.fit,'caveat',old.caveat,'priority',old.priority,'source',old.source)) end)
  on conflict(user_id,title_id) do update set recommended_on=excluded.recommended_on,priority=excluded.priority,reason=excluded.reason,fit=excluded.fit,caveat=excluded.caveat,source=excluded.source,generated_at=excluded.generated_at,pack_hash=excluded.pack_hash,runtime_or_episode_count=excluded.runtime_or_episode_count,history=excluded.history;
  refreshed:=refreshed+1;
  for e in select value from jsonb_array_elements(coalesce(x->'reviews','[]')) loop
   insert into public.review_snapshots(title_id,source,score,score_type,critic_score,audience_score,vote_count,captured_on,source_url,notes,verified,origin,evidence_key)
   values(tid,e->>'source',e->>'score',coalesce(e->>'score_type','source-specific'),e->>'critic_score',e->>'audience_score',(e->>'vote_count')::bigint,(e->>'captured_on')::date,e->>'source_url',coalesce(e->>'notes',''),coalesce((e->>'verified')::boolean,false),'chatgpt',p_pack_hash||':'||n||':review:'||md5(e::text)) on conflict do nothing;
  end loop;
  for e in select value from jsonb_array_elements(coalesce(x->'availability','[]')) loop
   insert into public.availability(title_id,region,provider,kind,release_on,ott_on,theatrical_on,verified_on,source_url,notes,origin,evidence_key)
   values(tid,e->>'region',e->>'provider',e->>'kind',(e->>'release_on')::date,(e->>'ott_on')::date,(e->>'theatrical_on')::date,(e->>'verified_on')::date,e->>'source_url',coalesce(e->>'notes',''),'chatgpt',p_pack_hash||':'||n||':availability:'||md5(e::text)) on conflict do nothing;
  end loop;
 end loop;
 return jsonb_build_object('added',added,'refreshed',refreshed,'kept',kept);
end $$;
create function public.act_on_recommendation(p_title_id uuid, p_action text) returns void language plpgsql security invoker set search_path='' as $$ begin
 if not exists(select 1 from public.recommendations where title_id=p_title_id and user_id=auth.uid()) then raise exception 'Owned recommendation required'; end if;
 if p_action='dismiss' then update public.recommendations set state='dismissed' where title_id=p_title_id and user_id=auth.uid();
 elsif p_action in ('interested','watching','skip') then
  update public.recommendations set state='accepted' where title_id=p_title_id and user_id=auth.uid();
  update public.watch_entries set status=p_action,in_library=true where title_id=p_title_id and user_id=auth.uid();
 else raise exception 'Invalid recommendation action'; end if;
end $$;
revoke execute on function public.apply_title_metadata(uuid,jsonb),public.import_recommendation_pack(jsonb,text),public.act_on_recommendation(uuid,text) from public,anon;
grant execute on function public.apply_title_metadata(uuid,jsonb),public.import_recommendation_pack(jsonb,text),public.act_on_recommendation(uuid,text) to authenticated;

-- Keep pagination order deterministic through joins, and rank recommendations by their own priority.
create or replace function public.library_page(filters jsonb default '{}') returns jsonb language sql stable security invoker set search_path='' as $$
 with matched as (
 select t.*,case when filters->>'recommended'='true' then coalesce((select r.priority from public.recommendations r where r.user_id=t.user_id and r.title_id=t.id),w.priority) else w.priority end as priority,w.rating,w.status,w.updated_at as watched_update from public.titles t join public.watch_entries w on (w.user_id,w.title_id)=(t.user_id,t.id)
 where (w.in_library or filters->>'recommended'='true')
 and (coalesce(filters->>'q','')='' or strpos(lower(t.title||' '||t.country||' '||w.notes),lower(filters->>'q'))>0)
 and (coalesce(filters->>'status','')='' or w.status=filters->>'status')
 and (coalesce(filters->>'type','')='' or t.media_type=filters->>'type')
 and (coalesce(filters->>'country','')='' or strpos(lower(t.country),lower(filters->>'country'))>0)
 and (coalesce(filters->>'tag','')='' or exists(select 1 from unnest(t.tags) tag where strpos(lower(tag),lower(filters->>'tag'))>0))
 and (coalesce(filters->>'platform','')='' or exists(select 1 from public.availability a where a.title_id=t.id and a.user_id=t.user_id and strpos(lower(a.provider),lower(filters->>'platform'))>0))
 and (coalesce(filters->>'rating','')='' or w.rating>= (filters->>'rating')::numeric)
 and (coalesce(filters->>'priority','')='' or w.priority>= (filters->>'priority')::int)
 and (coalesce(filters->>'year','')='' or t.release_year=(filters->>'year')::int)
 and (coalesce(filters->>'recommended','')<>'true' or exists(select 1 from public.recommendations r where r.title_id=t.id and r.user_id=t.user_id and (case when coalesce(filters->>'rec_state','')<>'' then r.state=filters->>'rec_state' else r.state<>'dismissed' end)))
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

-- Backups preserve new metadata and inbox membership; existing titles still remain untouched.
create or replace function public.import_library(payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare x jsonb; s jsonb; tid uuid; added integer:=0; skipped integer:=0; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if payload->>'version'<>'2' or jsonb_typeof(payload->'titles')<>'array' then raise exception 'Invalid backup'; end if;
 if jsonb_array_length(payload->'titles')>10000 then raise exception 'Too many titles'; end if;
 for x in select value from jsonb_array_elements(payload->'titles') loop
  tid:=null;
  insert into public.titles(title,original_title,media_type,release_year,country,synopsis,poster_url,imdb_id,tmdb_id,provider_ids,tags,metadata)
  values(x->>'title',x->>'original_title',x->>'media_type',(x->>'release_year')::int,coalesce(x->>'country',''),coalesce(x->>'synopsis',''),x->>'poster_url',x->>'imdb_id',(x->>'tmdb_id')::int,coalesce(x->'provider_ids','{}'),array(select jsonb_array_elements_text(coalesce(x->'tags','[]'))),coalesce(x->'metadata','{"state":"missing"}'))
  on conflict do nothing returning id into tid;
  if tid is null then skipped:=skipped+1; continue; end if;
  s:=x->'watch';
  insert into public.watch_entries(title_id,status,rating,notes,priority,started_on,completed_on,favorite,in_library) values(tid,s->>'status',(s->>'rating')::numeric,coalesce(s->>'notes',''),(s->>'priority')::int,(s->>'started_on')::date,(s->>'completed_on')::date,coalesce((s->>'favorite')::boolean,false),coalesce((s->>'in_library')::boolean,true));
  for s in select value from jsonb_array_elements(coalesce(x->'seasons','[]')) loop
   if x->>'media_type'<>'series' then raise exception 'Movies cannot have seasons'; end if;
   insert into public.seasons(title_id,number,status,rating,notes,rank,completed_on) values(tid,(s->>'number')::int,s->>'status',(s->>'rating')::numeric,coalesce(s->>'notes',''),(s->>'rank')::int,(s->>'completed_on')::date);
  end loop;
  for s in select value from jsonb_array_elements(coalesce(x->'reviews','[]')) loop
   insert into public.review_snapshots(title_id,source,score,score_type,critic_score,audience_score,vote_count,captured_on,source_url,notes,verified,origin,evidence_key) values(tid,s->>'source',s->>'score',coalesce(s->>'score_type','source-specific'),s->>'critic_score',s->>'audience_score',(s->>'vote_count')::bigint,(s->>'captured_on')::date,s->>'source_url',coalesce(s->>'notes',''),coalesce((s->>'verified')::boolean,false),coalesce(s->>'origin','manual'),s->>'evidence_key');
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
 return jsonb_build_object('added',added,'skipped',skipped);
end $$;
