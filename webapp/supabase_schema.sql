-- Table des Profils Utilisateurs (liée à auth.users)
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text NOT NULL,
  role text DEFAULT 'user' CHECK (role IN ('user', 'admin', 'employee')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Sécurité RLS pour les profils
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les utilisateurs peuvent voir leur propre profil" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Les administrateurs peuvent tout voir" 
ON public.profiles FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'employee')
  )
);

-- Trigger pour créer un profil automatiquement lors de l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'user');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Table des demandes de contact / devis
CREATE TABLE public.contact_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processed')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Sécurité RLS pour les contacts
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- Tout le monde (même anonyme) peut insérer une demande de contact
CREATE POLICY "Tout le monde peut insérer une demande de contact" 
ON public.contact_requests FOR INSERT 
WITH CHECK (true);

-- Seuls les administrateurs et employés peuvent voir et modifier les demandes
CREATE POLICY "Les administrateurs peuvent tout voir et modifier" 
ON public.contact_requests FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'employee')
  )
);

-- Table des questionnaires de satisfaction (Qualiopi) et avis
CREATE TABLE public.satisfaction_surveys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name text NOT NULL,
  student_email text NOT NULL,
  course_name text NOT NULL,
  training_date date NOT NULL,
  rating_overall integer CHECK (rating_overall >= 1 AND rating_overall <= 5),
  rating_pedagogy integer CHECK (rating_pedagogy >= 1 AND rating_pedagogy <= 5),
  rating_objectives integer CHECK (rating_objectives >= 1 AND rating_objectives <= 5),
  rating_logistics integer CHECK (rating_logistics >= 1 AND rating_logistics <= 5),
  public_testimonial text,
  private_feedback text,
  consent_marketing boolean DEFAULT false,
  is_published boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Sécurité RLS pour les questionnaires
ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut soumettre un questionnaire (même sans compte)
CREATE POLICY "Tout le monde peut soumettre un questionnaire" 
ON public.satisfaction_surveys FOR INSERT 
WITH CHECK (true);

-- Tout le monde peut lire les témoignages publiés (pour la page d'accueil)
CREATE POLICY "Lecture des avis publiés par tous" 
ON public.satisfaction_surveys FOR SELECT 
USING (is_published = true AND consent_marketing = true);

-- Seuls les administrateurs peuvent tout voir et modifier
CREATE POLICY "Les administrateurs gèrent les avis" 
ON public.satisfaction_surveys FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'employee')
  )
);

-- Table des articles de blog
CREATE TABLE public.blog_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text,
  content text NOT NULL,
  image_url text,
  author text NOT NULL,
  category text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Sécurité RLS pour les articles de blog
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les articles de blog.
CREATE POLICY "Lecture publique des articles du blog"
ON public.blog_posts FOR SELECT
TO anon, authenticated
USING (true);

-- Seuls les administrateurs et employés autorisés peuvent créer un article.
CREATE POLICY "Le personnel crée les articles du blog"
ON public.blog_posts FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'employee')
  )
);

CREATE POLICY "Le personnel modifie les articles du blog"
ON public.blog_posts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'employee')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'employee')
  )
);

CREATE POLICY "Le personnel supprime les articles du blog"
ON public.blog_posts FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'employee')
  )
);

REVOKE ALL ON public.blog_posts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;

-- Table des tests de positionnement préalables aux formations
CREATE TABLE public.course_positioning_assessments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL
    CONSTRAINT course_positioning_assessments_user_id_fkey
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  learner_name text NOT NULL CHECK (char_length(learner_name) BETWEEN 2 AND 150),
  course_id text NOT NULL CHECK (char_length(course_id) BETWEEN 2 AND 100),
  course_title text NOT NULL CHECK (char_length(course_title) BETWEEN 2 AND 250),
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'array'),
  score integer NOT NULL CHECK (score >= 0),
  maximum_score integer NOT NULL CHECK (maximum_score > 0 AND score <= maximum_score),
  level text NOT NULL CHECK (char_length(level) BETWEEN 2 AND 100),
  submitted_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX course_positioning_assessments_user_course_idx
  ON public.course_positioning_assessments (user_id, course_id, submitted_at DESC);

ALTER TABLE public.course_positioning_assessments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.course_positioning_assessments TO authenticated;

-- L'apprenant peut enregistrer et relire uniquement ses propres positionnements.
CREATE POLICY "Les apprenants créent leur propre positionnement"
ON public.course_positioning_assessments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les apprenants lisent leur propre positionnement"
ON public.course_positioning_assessments FOR SELECT
USING (auth.uid() = user_id);

-- Les personnes autorisées peuvent produire les preuves de suivi pédagogique.
CREATE POLICY "Les administrateurs consultent les positionnements"
ON public.course_positioning_assessments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'employee')
  )
);

COMMENT ON TABLE public.course_positioning_assessments IS
  'Positionnements nominatifs réalisés avant le début des formations. Définir et documenter une durée de conservation RGPD.';
