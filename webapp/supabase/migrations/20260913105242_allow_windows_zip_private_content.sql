do $$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'paid-course-content'
      and public = false
      and file_size_limit = 10485760
  ) then
    raise exception 'Le bucket paid-course-content doit rester privé avec une limite de 10 Mio.';
  end if;
end
$$;

update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct mime_type order by mime_type)
  from unnest(
    coalesce(allowed_mime_types, '{}'::text[])
      || array['application/x-zip-compressed']
  ) as mime_type
)
where id = 'paid-course-content'
  and public = false
  and file_size_limit = 10485760;
