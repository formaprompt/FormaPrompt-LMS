do $$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'paid-course-content' and public = false
  ) then
    raise exception 'Le bucket privé paid-course-content est absent.';
  end if;
end
$$;

update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct mime_type order by mime_type)
  from unnest(coalesce(allowed_mime_types, '{}'::text[]) || array['text/markdown']) as mime_type
)
where id = 'paid-course-content'
  and public = false;
