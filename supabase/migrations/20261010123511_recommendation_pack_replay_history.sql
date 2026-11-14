-- Keep a pack replay-safe even after a later weekly pack has arrived.
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
