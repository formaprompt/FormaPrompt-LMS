ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS image_alt text;

COMMENT ON COLUMN public.blog_posts.seo_title IS
  'Titre facultatif utilisé dans les métadonnées SEO et sociales de l article.';

COMMENT ON COLUMN public.blog_posts.meta_description IS
  'Description facultative utilisée dans les métadonnées SEO et sociales de l article.';

COMMENT ON COLUMN public.blog_posts.image_alt IS
  'Texte alternatif facultatif de l image principale de l article.';
