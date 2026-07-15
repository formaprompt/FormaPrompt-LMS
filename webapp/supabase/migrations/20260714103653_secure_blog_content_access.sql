-- Sécurise l'administration du blog tout en conservant la lecture publique.
-- Les rôles admin et employee sont stockés dans public.profiles.

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Allow public insert posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Allow public update posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Allow public delete posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Tout le monde peut lire les articles de blog" ON public.blog_posts;
DROP POLICY IF EXISTS "Les administrateurs peuvent gérer les articles de blog" ON public.blog_posts;
DROP POLICY IF EXISTS "Lecture publique des articles du blog" ON public.blog_posts;
DROP POLICY IF EXISTS "Le personnel crée les articles du blog" ON public.blog_posts;
DROP POLICY IF EXISTS "Le personnel modifie les articles du blog" ON public.blog_posts;
DROP POLICY IF EXISTS "Le personnel supprime les articles du blog" ON public.blog_posts;

CREATE POLICY "Lecture publique des articles du blog"
ON public.blog_posts FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Le personnel crée les articles du blog"
ON public.blog_posts FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'employee')
  )
);

CREATE POLICY "Le personnel modifie les articles du blog"
ON public.blog_posts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'employee')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'employee')
  )
);

CREATE POLICY "Le personnel supprime les articles du blog"
ON public.blog_posts FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'employee')
  )
);

-- Les privilèges SQL complètent la RLS : un visiteur anonyme ne reçoit
-- même plus les droits INSERT, UPDATE ou DELETE sur la table.
REVOKE ALL ON public.blog_posts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;

-- Le bucket est public : les URL d'images restent lisibles sans politique
-- SELECT sur storage.objects. Supprimer cette politique empêche le listing.
DROP POLICY IF EXISTS "Allow public read images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public insert images" ON storage.objects;
DROP POLICY IF EXISTS "Le personnel ajoute les images du blog" ON storage.objects;

CREATE POLICY "Le personnel ajoute les images du blog"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'blog-images'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'employee')
  )
);

COMMENT ON TABLE public.blog_posts IS
  'Articles publics FormaPrompt. Les écritures sont réservées aux rôles admin et employee.';
