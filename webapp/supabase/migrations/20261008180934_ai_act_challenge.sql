BEGIN;

-- Aucune écriture dans course_access ni dans le domaine commercial.
-- Le quota est attaché au parcours: activer une version ne le réinitialise pas.
-- Conservation de conception: 12 mois après dernière activité acceptée.
-- Aucune purge/cron: analyse RGPD et procédure coordonnée avant production.

CREATE TABLE private.challenge_versions (
  id text PRIMARY KEY,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now ()
);

CREATE UNIQUE INDEX challenge_one_active_version ON private.challenge_versions ((active))
WHERE active;

CREATE TABLE private.challenge_questions (
  version_id text NOT NULL REFERENCES private.challenge_versions (id),
  code text NOT NULL CHECK (code ~ '^Q(0[1-9]|1[0-2])$'),
  position integer NOT NULL CHECK (position BETWEEN 1 AND 12),
  theme text NOT NULL,
  scenario text NOT NULL,
  options jsonb NOT NULL,
  correct_option text NOT NULL CHECK (correct_option IN ('A', 'B', 'C')),
  explanation text NOT NULL,
  example text NOT NULL,
  legal_reference text NOT NULL,
  remediation text NOT NULL,
  takeaway text NOT NULL,
  PRIMARY KEY (version_id, code),
  UNIQUE (version_id, position)
);

CREATE TABLE private.challenge_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE RESTRICT,
  version_id text NOT NULL REFERENCES private.challenge_versions (id),
  last_activity_at timestamptz NOT NULL DEFAULT now ()
);

CREATE TABLE private.challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  path_id uuid NOT NULL REFERENCES private.challenge_paths (id),
  number integer NOT NULL CHECK (number IN (1, 2)),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  score integer CHECK (score BETWEEN 0 AND 12),
  finished_at timestamptz,
  UNIQUE (path_id, number),
  CHECK ((score IS NULL) = (finished_at IS NULL))
);

CREATE UNIQUE INDEX challenge_one_open_attempt ON private.challenge_attempts (path_id)
WHERE finished_at IS NULL;

CREATE TABLE private.challenge_answers (
  attempt_id uuid NOT NULL REFERENCES private.challenge_attempts (id),
  question_code text NOT NULL,
  option_code text NOT NULL CHECK (option_code IN ('A', 'B', 'C')),
  saved_at timestamptz NOT NULL DEFAULT now (),
  saved_revision integer NOT NULL CHECK (saved_revision > 0),
  PRIMARY KEY (attempt_id, question_code)
);

CREATE TABLE private.challenge_start_requests (
  user_id uuid NOT NULL REFERENCES public.profiles (id),
  request_id uuid NOT NULL,
  attempt_id uuid NOT NULL REFERENCES private.challenge_attempts (id),
  PRIMARY KEY (user_id, request_id)
);

CREATE TABLE private.challenge_save_requests (
  attempt_id uuid NOT NULL REFERENCES private.challenge_attempts (id),
  request_id uuid NOT NULL,
  question_code text NOT NULL,
  option_code text NOT NULL,
  expected_revision integer NOT NULL,
  PRIMARY KEY (attempt_id, request_id)
);

CREATE TABLE private.challenge_trainer_grants (
  user_id uuid NOT NULL REFERENCES public.profiles (id),
  course_id text NOT NULL CHECK (course_id = 'formation-ia-act'),
  active boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now (),
  updated_by uuid NOT NULL REFERENCES public.profiles (id),
  PRIMARY KEY (user_id, course_id)
);

-- RLS sans policy autorisante: tout accès direct est refusé par défaut.
-- Les apprenants et administrateurs passent uniquement par la RPC authentifiée.
DO
$$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY ['versions', 'questions', 'paths', 'attempts', 'answers', 'start_requests', 'save_requests', 'trainer_grants'] LOOP
    EXECUTE format ('ALTER TABLE private.challenge_%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format ('ALTER TABLE private.challenge_%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format ('REVOKE ALL ON private.challenge_%I FROM PUBLIC,anon,authenticated,service_role', t);
  END LOOP;
END
$$;

COMMENT ON TABLE private.challenge_paths IS 'Conception: réponses et résultats 12 mois après dernière activité acceptée. Purge non implémentée; analyse RGPD et procédure coordonnée requises avant production.';

CREATE FUNCTION private.challenge_guard () RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS
$$
BEGIN
  IF TG_TABLE_NAME = 'challenge_questions' THEN
    IF TG_OP <> 'DELETE' AND (
      jsonb_typeof (NEW.options) IS DISTINCT FROM 'array' OR jsonb_array_length (NEW.options) <> 3 OR NOT NEW.options @> '[{"code":"A"},{"code":"B"},{"code":"C"}]' :: jsonb OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements (NEW.options) x
        WHERE jsonb_typeof (x -> 'text') IS DISTINCT FROM 'string' OR nullif (btrim (x ->> 'text'), '') IS NULL
      )
    ) THEN
      RAISE EXCEPTION 'INVALID_OPTIONS';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM private.challenge_paths
      WHERE (version_id = OLD.version_id OR version_id = NEW.version_id)
    ) THEN
      RAISE EXCEPTION 'IMMUTABLE_VERSION';
    END IF;
  ELSIF TG_TABLE_NAME = 'challenge_versions' THEN
    IF EXISTS (
    SELECT 1
    FROM private.challenge_paths
    WHERE version_id = OLD.id) AND (TG_OP = 'DELETE' OR NEW.id <> OLD.id OR NEW.created_at <> OLD.created_at) THEN
      RAISE EXCEPTION 'IMMUTABLE_VERSION';
    END IF;
  ELSIF TG_TABLE_NAME = 'challenge_paths' THEN
    IF NEW.user_id <> OLD.user_id OR NEW.version_id <> OLD.version_id OR NEW.id <> OLD.id THEN
      RAISE EXCEPTION 'IMMUTABLE_PATH';
    END IF;
  ELSIF TG_TABLE_NAME = 'challenge_attempts' THEN
    IF OLD.finished_at IS NOT NULL OR NEW.path_id <> OLD.path_id OR NEW.number <> OLD.number OR NEW.id <> OLD.id THEN
      RAISE EXCEPTION 'IMMUTABLE_ATTEMPT';
    END IF;
  ELSIF TG_TABLE_NAME = 'challenge_answers' THEN
    IF TG_OP = 'UPDATE' AND (NEW.attempt_id <> OLD.attempt_id OR NEW.question_code <> OLD.question_code) THEN
      RAISE EXCEPTION 'IMMUTABLE_ANSWER_KEY';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM private.challenge_attempts
      WHERE (id = OLD.attempt_id OR id = NEW.attempt_id) AND finished_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'IMMUTABLE_ATTEMPT';
    END IF;
    IF TG_OP <> 'DELETE' AND NOT EXISTS (
      SELECT 1
      FROM private.challenge_attempts a
      JOIN private.challenge_paths p ON p.id = a.path_id
      JOIN private.challenge_questions q ON q.version_id = p.version_id
      WHERE a.id = NEW.attempt_id AND q.code = NEW.question_code AND q.options @> jsonb_build_array (jsonb_build_object ('code', NEW.option_code))
    ) THEN
      RAISE EXCEPTION 'INVALID_INPUT';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER challenge_question_immutable BEFORE
UPDATE OR DELETE ON private.challenge_questions FOR EACH ROW EXECUTE FUNCTION private.challenge_guard ();

CREATE TRIGGER challenge_question_insert_guard BEFORE
INSERT ON private.challenge_questions FOR EACH ROW EXECUTE FUNCTION private.challenge_guard ();

CREATE TRIGGER challenge_version_immutable BEFORE
UPDATE OR DELETE ON private.challenge_versions FOR EACH ROW EXECUTE FUNCTION private.challenge_guard ();

CREATE TRIGGER challenge_path_immutable BEFORE
UPDATE ON private.challenge_paths FOR EACH ROW EXECUTE FUNCTION private.challenge_guard ();

CREATE TRIGGER challenge_attempt_immutable BEFORE
UPDATE OR DELETE ON private.challenge_attempts FOR EACH ROW EXECUTE FUNCTION private.challenge_guard ();

CREATE TRIGGER challenge_answer_guard BEFORE
INSERT OR
UPDATE OR DELETE ON private.challenge_answers FOR EACH ROW EXECUTE FUNCTION private.challenge_guard ();

CREATE FUNCTION private.challenge_state (p_user uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS
$$
WITH p AS (
SELECT *
FROM private.challenge_paths
WHERE user_id = p_user), a AS (
  SELECT a.*,
  (
  SELECT count (*)
  FROM private.challenge_answers r
  WHERE r.attempt_id = a.id) answered_count,
  coalesce (
    (
      SELECT jsonb_object_agg (question_code, option_code)
      FROM private.challenge_answers r
      WHERE r.attempt_id = a.id
    ),
    '{}'
  ) answers,
  CASE
    WHEN a.finished_at IS NOT NULL THEN
    (
      SELECT jsonb_agg (
        jsonb_build_object (
          'question_code',
          q.code,
          'selected_option',
          r.option_code,
          'correct_option',
          q.correct_option,
          'is_correct',
          r.option_code = q.correct_option,
          'explanation',
          q.explanation,
          'example',
          q.example,
          'legal_reference',
          q.legal_reference,
          'remediation',
          q.remediation,
          'takeaway',
          q.takeaway
        )
        ORDER BY q.position
      )
      FROM private.challenge_questions q
      JOIN private.challenge_answers r ON r.question_code = q.code AND r.attempt_id = a.id
      WHERE q.version_id = p.version_id
    )
  END results
  FROM private.challenge_attempts a
  JOIN p ON p.id = a.path_id
), v AS (
  SELECT coalesce (
    (
    SELECT version_id
    FROM p),
    (
    SELECT id
    FROM private.challenge_versions
    WHERE active)
  ) id
)
SELECT jsonb_build_object (
  'course_id',
  'formation-ia-act',
  'version',
  (
  SELECT id
  FROM v),
  'status',
  CASE
    WHEN EXISTS (
    SELECT 1
    FROM a
    WHERE score >= 9) THEN
    'passed'
    WHEN (
    SELECT count (*)
    FROM a
    WHERE finished_at IS NOT NULL) = 2 THEN
    'failed'
    WHEN EXISTS (
    SELECT 1
    FROM a) THEN
    'in_progress'
  ELSE 'not_started'
  END,
  'can_start',
  (
  SELECT count (*)
  FROM a) < 2 AND NOT EXISTS (
  SELECT 1
  FROM a
  WHERE finished_at IS NULL),
  'best_score',
  (
  SELECT max (score)
  FROM a),
  'last_score',
  (
    SELECT score
    FROM a
    WHERE finished_at IS NOT NULL
    ORDER BY number DESC
    LIMIT 1
  ),
  'attempts',
  coalesce (
    (
      SELECT jsonb_agg (
        jsonb_build_object (
          'id',
          id,
          'number',
          number,
          'status',
          CASE
            WHEN finished_at IS NULL THEN
            'in_progress'
            WHEN score >= 9 THEN
            'passed'
          ELSE 'failed'
          END,
          'revision',
          revision,
          'answers',
          answers,
          'answered_count',
          answered_count,
          'score',
          score,
          'percentage',
          round (score * 100.0 / 12, 2),
          'finished_at',
          finished_at,
          'results',
          results
        )
        ORDER BY number
      )
      FROM a
    ),
    '[]'
  ),
  'questions',
  coalesce (
    (
      SELECT jsonb_agg (
        jsonb_build_object (
          'code',
          code,
          'order',
          position,
          'theme',
          theme,
          'scenario',
          scenario,
          'options',
          options
        )
        ORDER BY position
      )
      FROM private.challenge_questions
      WHERE version_id = (
      SELECT id
      FROM v)
    ),
    '[]'
  )
)
$$;

CREATE FUNCTION private.challenge_identity (p_user uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS
$$
WITH names AS (
  SELECT DISTINCT btrim (learner_first_name) first_name,
  btrim (learner_last_name) last_name
  FROM public.training_enrollments
  WHERE user_id = p_user AND course_id = 'formation-ia-act' AND status IN ('validated', 'in_progress', 'completed') AND nullif (btrim (learner_first_name), '') IS NOT NULL AND nullif (btrim (learner_last_name), '') IS NOT NULL
)
SELECT jsonb_build_object (
  'user_id',
  p_user,
  'display_name',
  CASE
    WHEN count (*) = 1 THEN
    max (first_name || ' ' || last_name)
  ELSE 'Apprenant ' || p_user :: text
  END,
  'identity_status',
  CASE
    WHEN count (*) = 1 THEN
    'available'
    WHEN count (*) = 0 THEN
    'missing'
  ELSE 'conflict'
  END
)
FROM names
$$;

-- SECURITY DEFINER est limité à cette fonction privée authentifiée.
-- Il permet les transactions atomiques sans aucun privilège client sur les tables.
-- auth.uid(), accès formation et habilitations sont contrôlés à chaque appel,
-- y compris les replays; search_path vide empêche une résolution détournée.
-- Le wrapper public est SECURITY INVOKER; EXECUTE est réservé à authenticated.
CREATE FUNCTION private.challenge_rpc (p_action text, p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS
$$
DECLARE
  u uuid := auth.uid ();
  target uuid;
  path private.challenge_paths % ROWTYPE;
  att private.challenge_attempts % ROWTYPE;
  req private.challenge_save_requests % ROWTYPE;
  v text;
  admin boolean;
  trainer boolean;
  n integer;
  rev integer;
  s integer;
  result jsonb;
  rows jsonb;
  stats jsonb;
  themes jsonb;
  questions jsonb;
  activity_changed boolean := false;
BEGIN
  IF u IS NULL OR NOT EXISTS (
  SELECT 1
  FROM public.profiles
  WHERE id = u) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof (p_payload) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys (p_payload) k
    WHERE NOT k = ANY (
      CASE p_action
        WHEN 'state' THEN
        ARRAY ['course_id']
        WHEN 'permissions' THEN
        ARRAY ['course_id']
        WHEN 'start' THEN
        ARRAY ['course_id',
        'request_id']
        WHEN 'save' THEN
        ARRAY ['course_id',
        'attempt_id',
        'question_code',
        'option_code',
        'expected_revision',
        'request_id']
        WHEN 'finish' THEN
        ARRAY ['course_id',
        'attempt_id',
        'expected_revision',
        'confirmed']
        WHEN 'trainer_overview' THEN
        ARRAY ['course_id',
        'active_only']
        WHEN 'trainer_detail' THEN
        ARRAY ['course_id',
        'user_id']
        WHEN 'grants' THEN
        ARRAY ['course_id']
        WHEN 'grant' THEN
        ARRAY ['course_id',
        'user_id',
        'active']
      ELSE ARRAY [] :: text []
      END
    )
  ) THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;
  IF p_payload ? 'course_id' AND p_payload ->> 'course_id' IS DISTINCT FROM 'formation-ia-act' THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;
  admin := private.is_strict_admin ();
  trainer := admin OR (
    EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = u AND role = 'user') AND EXISTS (
      SELECT 1
      FROM private.challenge_trainer_grants
      WHERE user_id = u AND course_id = 'formation-ia-act' AND active
    )
  );
  IF p_action = 'permissions' THEN
    RETURN jsonb_build_object ('can_train', trainer, 'is_admin', admin, 'course_id', 'formation-ia-act');
  END IF;
  IF p_action IN ('grants', 'grant') THEN
    IF NOT admin THEN
      RAISE EXCEPTION 'ACCESS_DENIED';
    END IF;
    IF p_action = 'grant' THEN
      IF jsonb_typeof (p_payload -> 'active') IS DISTINCT FROM 'boolean' OR p_payload ->> 'course_id' IS DISTINCT FROM 'formation-ia-act' THEN
        RAISE EXCEPTION 'INVALID_INPUT';
      END IF;
      target := (p_payload ->> 'user_id') :: uuid;
      IF target IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = target AND role = 'user') THEN
        RAISE EXCEPTION 'INVALID_INPUT';
      END IF;
      INSERT INTO private.challenge_trainer_grants (user_id, course_id, active, updated_by) VALUES (
        target,
        'formation-ia-act',
        (p_payload ->> 'active') :: boolean,
        u
      ) ON CONFLICT (user_id, course_id) DO UPDATE SET active = excluded.active, updated_at = now (), updated_by = u;
    END IF;
    RETURN jsonb_build_object (
      'grants',
      coalesce (
        (
          SELECT jsonb_agg (
            jsonb_build_object (
              'user_id',
              user_id,
              'course_id',
              course_id,
              'active',
              active,
              'updated_at',
              updated_at
            )
            ORDER BY updated_at DESC
          )
          FROM private.challenge_trainer_grants
        ),
        '[]'
      )
    );
  END IF;
  IF p_action IN ('trainer_overview', 'trainer_detail') THEN
    IF NOT trainer THEN
      RAISE EXCEPTION 'ACCESS_DENIED';
    END IF;
    IF p_action = 'trainer_detail' THEN
      target := (p_payload ->> 'user_id') :: uuid;
      IF target IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.course_access
      WHERE user_id = target AND course_id = 'formation-ia-act') THEN
        RAISE EXCEPTION 'ACCESS_DENIED';
      END IF;
      RETURN private.challenge_state (target) || private.challenge_identity (target);
    END IF;
    WITH population AS (
      SELECT DISTINCT ON (user_id) user_id,
      status access_status,
      status = 'active' AND (expires_at IS NULL OR expires_at > now ()) active
      FROM public.course_access
      WHERE course_id = 'formation-ia-act'
      ORDER BY user_id
    ), selected AS (
      SELECT *,
      private.challenge_state (user_id) state
      FROM population
      WHERE NOT coalesce ((p_payload ->> 'active_only') :: boolean, false) OR active
    )
    SELECT coalesce (
      jsonb_agg (
        private.challenge_identity (user_id) || jsonb_build_object (
          'access_status',
          access_status,
          'active',
          active,
          'status',
          state -> 'status',
          'attempt_count',
          jsonb_array_length (state -> 'attempts'),
          'answered_count',
          coalesce (
            (
              SELECT (x ->> 'answered_count') :: int
              FROM jsonb_array_elements (state -> 'attempts') x
              ORDER BY (x ->> 'number') :: int DESC
              LIMIT 1
            ),
            0
          ),
          'best_score',
          state -> 'best_score',
          'last_score',
          state -> 'last_score',
          'last_finished_at',
          (
            SELECT max (x ->> 'finished_at')
            FROM jsonb_array_elements (state -> 'attempts') x
          )
        )
      ),
      '[]'
    ), jsonb_build_object (
      'population',
      count (*),
      'active',
      count (*) FILTER (
      WHERE active),
      'started',
      count (*) FILTER (
      WHERE state ->> 'status' <> 'not_started'),
      'finished',
      count (*) FILTER (
      WHERE state ->> 'best_score' IS NOT NULL),
      'not_started',
      count (*) FILTER (
      WHERE state ->> 'status' = 'not_started'),
      'in_progress',
      count (*) FILTER (
      WHERE state ->> 'status' = 'in_progress'),
      'passed',
      count (*) FILTER (
      WHERE state ->> 'status' = 'passed'),
      'failed',
      count (*) FILTER (
      WHERE state ->> 'status' = 'failed'),
      'average_best_score',
      round (avg ((state ->> 'best_score') :: numeric), 2),
      'success_rate_population',
      round (
        100.0 * count (*) FILTER (
        WHERE state ->> 'status' = 'passed') / nullif (count (*), 0),
        2
      ),
      'success_rate_finished',
      round (
        100.0 * count (*) FILTER (
        WHERE state ->> 'status' = 'passed') / nullif (
          count (*) FILTER (
          WHERE state ->> 'best_score' IS NOT NULL),
          0
        ),
        2
      )
    ) INTO rows, stats
    FROM selected;
    WITH best AS (
      SELECT DISTINCT ON (p.user_id) p.user_id,
      a.id,
      p.version_id
      FROM private.challenge_paths p
      JOIN public.course_access c ON c.user_id = p.user_id AND c.course_id = 'formation-ia-act'
      JOIN private.challenge_attempts a ON a.path_id = p.id AND a.finished_at IS NOT NULL
      WHERE NOT coalesce ((p_payload ->> 'active_only') :: boolean, false) OR (
        c.status = 'active' AND (c.expires_at IS NULL OR c.expires_at > now ())
      )
      ORDER BY p.user_id,
      a.score DESC,
      a.finished_at DESC,
      a.number DESC
    ), analysis AS (
      SELECT q.code,
      q.theme,
      count (*) total,
      count (*) FILTER (
      WHERE r.option_code <> q.correct_option) errors
      FROM best b
      JOIN private.challenge_answers r ON r.attempt_id = b.id
      JOIN private.challenge_questions q ON q.version_id = b.version_id AND q.code = r.question_code
      GROUP BY q.code,
      q.theme
    )
    SELECT coalesce (
      jsonb_agg (
        jsonb_build_object (
          'code',
          code,
          'theme',
          theme,
          'total',
          total,
          'errors',
          errors
        )
        ORDER BY code
      ),
      '[]'
    ) INTO questions
    FROM analysis;
    SELECT coalesce (jsonb_agg (x), '[]') INTO themes
    FROM (
      SELECT jsonb_build_object (
        'theme',
        x ->> 'theme',
        'errors',
        sum ((x ->> 'errors') :: int),
        'total',
        sum ((x ->> 'total') :: int),
        'sample_size',
        max ((x ->> 'total') :: int)
      ) x
      FROM jsonb_array_elements (questions) x
      GROUP BY x ->> 'theme'
    ) t;
    RETURN jsonb_build_object (
      'learners',
      rows,
      'stats',
      stats,
      'themes',
      themes,
      'questions',
      questions,
      'is_admin',
      admin
    );
  END IF;
  IF p_action NOT IN ('state', 'start', 'save', 'finish') THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;
  -- Lock entitlement as well: concurrent revocation serializes with this operation.
  PERFORM 1
  FROM public.course_access
  WHERE user_id = u AND course_id = 'formation-ia-act' AND status = 'active' AND (expires_at IS NULL OR expires_at > now ()) FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;
  IF p_action = 'state' THEN
    RETURN private.challenge_state (u);
  END IF;
  -- One row lock per user serializes starts even before a Challenge path exists.
  PERFORM 1
  FROM public.profiles
  WHERE id = u FOR
  UPDATE;
  SELECT * INTO path
  FROM private.challenge_paths
  WHERE user_id = u FOR
  UPDATE;
  IF p_action = 'start' THEN
    IF p_payload ->> 'request_id' IS NULL THEN
      RAISE EXCEPTION 'INVALID_INPUT';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM private.challenge_start_requests
      WHERE user_id = u AND request_id = (p_payload ->> 'request_id') :: uuid
    ) THEN
      RETURN private.challenge_state (u);
    END IF;
    IF path.id IS NULL THEN
      SELECT id INTO v
      FROM private.challenge_versions
      WHERE active;
      IF v IS NULL OR (
      SELECT count (*)
      FROM private.challenge_questions
      WHERE version_id = v) <> 12 THEN
        RAISE EXCEPTION 'VERSION_UNAVAILABLE';
      END IF;
      INSERT INTO private.challenge_paths (user_id, version_id) VALUES (u, v) RETURNING * INTO path;
    END IF;
    SELECT * INTO att
    FROM private.challenge_attempts
    WHERE path_id = path.id AND finished_at IS NULL;
    IF FOUND THEN
      INSERT INTO private.challenge_start_requests VALUES (u, (p_payload ->> 'request_id') :: uuid, att.id);
      RETURN private.challenge_state (u);
    END IF;
    SELECT count (*) INTO n
    FROM private.challenge_attempts
    WHERE path_id = path.id;
    IF n >= 2 THEN
      RAISE EXCEPTION 'ATTEMPT_LIMIT';
    END IF;
    INSERT INTO private.challenge_attempts (path_id, number) VALUES (path.id, n + 1) RETURNING * INTO att;
    INSERT INTO private.challenge_start_requests VALUES (u, (p_payload ->> 'request_id') :: uuid, att.id);
    UPDATE private.challenge_paths SET last_activity_at = greatest (last_activity_at, clock_timestamp ())
    WHERE id = path.id;
    RETURN private.challenge_state (u);
  END IF;
  SELECT * INTO att
  FROM private.challenge_attempts
  WHERE id = (p_payload ->> 'attempt_id') :: uuid AND path_id = path.id FOR
  UPDATE;
  IF att.id IS NULL THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;
  rev := (p_payload ->> 'expected_revision') :: int;
  IF rev IS NULL OR rev < 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;
  IF p_action = 'save' THEN
    IF p_payload ->> 'request_id' IS NULL OR p_payload ->> 'question_code' IS NULL OR p_payload ->> 'option_code' IS NULL THEN
      RAISE EXCEPTION 'INVALID_INPUT';
    END IF;
    SELECT * INTO req
    FROM private.challenge_save_requests
    WHERE attempt_id = att.id AND request_id = (p_payload ->> 'request_id') :: uuid;
    IF FOUND THEN
      IF req.question_code <> p_payload ->> 'question_code' OR req.option_code <> p_payload ->> 'option_code' OR req.expected_revision <> rev THEN
        RAISE EXCEPTION 'INVALID_INPUT';
      END IF;
      RETURN private.challenge_state (u) || jsonb_build_object (
        'acknowledgement',
        jsonb_build_object (
          'request_id',
          req.request_id,
          'attempt_id',
          att.id,
          'question_code',
          req.question_code,
          'option_code',
          req.option_code,
          'revision',
          req.expected_revision + 1,
          'current_revision',
          att.revision
        )
      );
    END IF;
    IF att.finished_at IS NOT NULL THEN
      RAISE EXCEPTION 'ATTEMPT_CLOSED';
    END IF;
    IF att.revision <> rev THEN
      RAISE EXCEPTION 'REVISION_CONFLICT';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM private.challenge_questions
      WHERE version_id = path.version_id AND code = p_payload ->> 'question_code' AND options @> jsonb_build_array (jsonb_build_object ('code', p_payload ->> 'option_code'))
    ) THEN
      RAISE EXCEPTION 'INVALID_INPUT';
    END IF;
    -- Une nouvelle requête confirmant le même choix conserve le contrat de
    -- révision/acquittement, mais ne prolonge pas la conservation du parcours.
    SELECT NOT EXISTS (
      SELECT 1 FROM private.challenge_answers
      WHERE attempt_id = att.id AND question_code = p_payload ->> 'question_code'
      AND option_code = p_payload ->> 'option_code'
    ) INTO activity_changed;
    INSERT INTO private.challenge_answers (attempt_id, question_code, option_code, saved_revision) VALUES (
      att.id,
      p_payload ->> 'question_code',
      p_payload ->> 'option_code',
      rev + 1
    ) ON CONFLICT (attempt_id, question_code) DO UPDATE SET option_code = excluded.option_code, saved_at = now (), saved_revision = excluded.saved_revision;
    INSERT INTO private.challenge_save_requests VALUES (
      att.id,
      (p_payload ->> 'request_id') :: uuid,
      p_payload ->> 'question_code',
      p_payload ->> 'option_code',
      rev
    );
    UPDATE private.challenge_attempts SET revision = revision + 1
    WHERE id = att.id;
  ELSE
    IF p_payload -> 'confirmed' IS DISTINCT FROM 'true' :: jsonb THEN
      RAISE EXCEPTION 'CONFIRMATION_REQUIRED';
    END IF;
    IF att.finished_at IS NOT NULL THEN
      IF rev <> att.revision - 1 THEN
        RAISE EXCEPTION 'REVISION_CONFLICT';
      END IF;
      RETURN private.challenge_state (u);
    END IF;
    IF att.revision <> rev THEN
      RAISE EXCEPTION 'REVISION_CONFLICT';
    END IF;
    SELECT count (*), count (*) FILTER (
    WHERE r.option_code = q.correct_option) INTO n, s
    FROM private.challenge_answers r
    JOIN private.challenge_questions q ON q.version_id = path.version_id AND q.code = r.question_code
    WHERE r.attempt_id = att.id;
    IF n <> 12 THEN
      RAISE EXCEPTION 'INCOMPLETE_ATTEMPT';
    END IF;
    UPDATE private.challenge_attempts SET score = s, finished_at = now (), revision = revision + 1
    WHERE id = att.id;
    activity_changed := true;
  END IF;
  -- Horodatage d’acceptation monotone, même après attente d’une transaction ancienne.
  UPDATE private.challenge_paths SET last_activity_at = greatest (last_activity_at, clock_timestamp ())
  WHERE id = path.id AND activity_changed;
  result := private.challenge_state (u);
  IF p_action = 'save' THEN
    result := result || jsonb_build_object (
      'acknowledgement',
      jsonb_build_object (
        'request_id',
        p_payload ->> 'request_id',
        'attempt_id',
        att.id,
        'question_code',
        p_payload ->> 'question_code',
        'option_code',
        p_payload ->> 'option_code',
        'revision',
        rev + 1,
        'current_revision',
        rev + 1
      )
    );
  END IF;
  RETURN result;
EXCEPTION
WHEN invalid_text_representation OR numeric_value_out_of_range THEN
RAISE EXCEPTION 'INVALID_INPUT';
END
$$;

CREATE FUNCTION public.ai_act_challenge (p_action text, p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS
$$
SELECT private.challenge_rpc (p_action, p_payload)
$$;

REVOKE ALL ON FUNCTION private.challenge_guard (), private.challenge_state (uuid), private.challenge_identity (uuid), private.challenge_rpc (text, jsonb), public.ai_act_challenge (text, jsonb)
FROM PUBLIC, anon, authenticated, service_role;

GRANT USAGE ON SCHEMA private TO authenticated;

GRANT EXECUTE ON FUNCTION private.challenge_rpc (text, jsonb), public.ai_act_challenge (text, jsonb) TO authenticated;

INSERT INTO private.challenge_versions(id,active) VALUES ('v1.0',true);
INSERT INTO private.challenge_questions(version_id,code,position,theme,scenario,options,correct_option,explanation,example,legal_reference,remediation,takeaway) VALUES
('v1.0','Q01',1,'Systèmes à haut risque','L''IA analyse et classe des CV pour présélectionner des candidats. Classification ?','[{"code": "A", "text": "Toujours interdite"}, {"code": "B", "text": "En principe à haut risque"}, {"code": "C", "text": "Toujours à risque minimal"}]','B','Une intelligence artificielle qui analyse des candidatures, classe des CV ou contribue à sélectionner des candidats peut avoir des conséquences importantes sur l''accès à l''emploi.

Le règlement européen classe donc en principe ces systèmes parmi les IA à haut risque.

Cela ne signifie pas que leur utilisation est systématiquement interdite. En revanche, ces systèmes peuvent être soumis à des exigences particulières concernant notamment la qualité des données, la gestion des risques et la supervision humaine.

Certaines exceptions encadrées existent. La classification doit donc toujours tenir compte de la finalité réelle du système.','Un recruteur reçoit 150 candidatures. Une IA attribue à chaque candidat une note et écarte automatiquement les dossiers ayant obtenu moins de 60 %.

Cette utilisation peut influencer directement les possibilités d''obtenir un entretien.','**Référence juridique :** article 6 et annexe III, point 4 a).

[Consulter l''article 6](https://ai-act-service-desk.ec.europa.eu/fr/ai-act/article-6)','Avant de déployer une IA de recrutement, l''entreprise doit notamment vérifier sa classification, examiner les risques de discrimination et prévoir une supervision humaine appropriée.

Elle doit également vérifier les obligations d''information et de protection des données qui lui sont applicables.','une IA de recrutement ne doit pas être considérée comme un simple outil bureautique.'),
('v1.0','Q02',2,'Pratiques interdites','Une caméra infère la motivation et les émotions de salariés en réunion, sans motif médical ou de sécurité.','[{"code": "A", "text": "Refuser"}, {"code": "B", "text": "Autoriser avec information"}, {"code": "C", "text": "Autoriser à l''essai"}]','A','Une entreprise ne peut pas utiliser librement une intelligence artificielle pour déduire les émotions de ses salariés à partir de données biométriques, notamment en analysant leurs expressions faciales pendant les réunions.

Le règlement interdit en principe ces systèmes sur le lieu de travail.

Des exceptions existent pour certaines raisons médicales ou de sécurité. Elles ne couvrent pas une surveillance générale de la motivation, de l''humeur ou du comportement émotionnel des salariés.

Informer les salariés ou recueillir leur accord ne suffit pas à lever cette interdiction.','Une direction installe une caméra censée identifier les collaborateurs stressés ou démotivés pendant les réunions, afin d''évaluer leur engagement professionnel.

Cette utilisation entre dans le champ de l''interdiction présentée par le scénario.','**Référence juridique :** article 5, paragraphe 1, point f).

[Consulter l''article 5](https://ai-act-service-desk.ec.europa.eu/fr/ai-act/article-5)','Ne pas déployer ce dispositif. Pour mesurer le climat social, privilégier des méthodes respectueuses des droits des salariés, comme des enquêtes anonymes, des entretiens ou des échanges collectifs.','la possibilité technique de détecter des émotions ne donne pas le droit de surveiller les salariés.'),
('v1.0','Q03',3,'Transparence','Un chatbot parle aux clients sans indiquer qu''ils interagissent avec une IA, et cela n''est pas évident.','[{"code": "A", "text": "Ne rien changer"}, {"code": "B", "text": "Supprimer le chatbot"}, {"code": "C", "text": "Informer les clients"}]','C','Lorsqu''une personne échange avec un système d''intelligence artificielle, elle doit normalement pouvoir comprendre qu''elle ne communique pas avec un être humain, sauf lorsque cela est évident dans le contexte.

L''article 50 prévoit cette obligation de transparence, sous réserve des exceptions applicables.

Il n''est pas nécessaire de présenter un long texte juridique. Une mention simple et compréhensible peut permettre de satisfaire l''objectif d''information.','Un client ouvre une fenêtre de discussion sur le site d''un organisme de formation.

Le système indique :

« Bonjour, je suis l''assistant virtuel de notre organisme. Je peux répondre à vos questions sur nos formations. »

Le client connaît immédiatement la nature de son interlocuteur.','**Référence juridique :** article 50, paragraphes 1 et 5.

[Consulter l''article 50](https://ai-act-service-desk.ec.europa.eu/fr/ai-act/article-50)','Prévoir une information clairement visible au début de l''interaction. Il est également recommandé de permettre aux utilisateurs de contacter une personne lorsque l''assistant ne peut pas répondre correctement.','un chatbot peut être efficace sans chercher à se faire passer pour un être humain.'),
('v1.0','Q04',4,'Formation et usages','Un formateur fait préparer des exercices à une IA, les vérifie, sans évaluer ou sélectionner les apprenants.','[{"code": "A", "text": "Toujours à haut risque"}, {"code": "B", "text": "Pas automatiquement à haut risque"}, {"code": "C", "text": "Interdit"}]','B','Le fait d''utiliser une IA dans l''éducation ou la formation ne transforme pas automatiquement cette technologie en système à haut risque.

Un formateur qui utilise une IA pour préparer un exercice, construire un plan de cours ou imaginer des exemples réalise généralement une activité d''assistance à la production de contenus.

La situation devient différente lorsqu''un système est destiné à évaluer les acquis des apprenants, à déterminer leur admission ou à prendre certaines décisions concernant leur parcours.

Ce n''est donc pas simplement le secteur professionnel qui détermine le niveau de risque, mais la finalité du système.','Un formateur demande à une IA de créer dix exercices Excel. Il vérifie les réponses, corrige les erreurs et adapte les consignes au niveau des apprenants.

Le système ne décide ni de leur réussite ni de leur admission.','**Référence juridique :** article 6 et annexe III, point 3.

[Consulter l''annexe III](https://ai-act-service-desk.ec.europa.eu/fr/ai-act/annex-3)','Conserver une validation humaine des supports pédagogiques. Vérifier les informations, les corrigés et les données éventuellement transmises à l''IA.

Si l''outil doit ensuite noter ou orienter automatiquement les apprenants, procéder à une nouvelle analyse des risques.','utiliser l''IA pour préparer un cours et lui confier une décision sur un apprenant sont deux situations différentes.'),
('v1.0','Q05',5,'Formation et usages','Des salariés utilisent des IA sans sensibilisation.','[{"code": "A", "text": "Mesures adaptées de maîtrise de l''IA"}, {"code": "B", "text": "Même diplôme européen pour tous"}, {"code": "C", "text": "Aucune mesure"}]','A','L''article 4 prévoit que les fournisseurs et déployeurs de systèmes d''IA prennent des mesures adaptées pour développer la maîtrise de l''IA des personnes qui utilisent ces systèmes pour leur compte.

Ces mesures doivent tenir compte du niveau de connaissance, de l''expérience, du contexte d''utilisation et des publics concernés.

Cette obligation ne signifie pas qu''une entreprise doit garantir exactement le même niveau de compétence à chaque salarié.

Il n''existe pas non plus de certification européenne unique que tous les utilisateurs d''IA devraient obligatoirement obtenir.','Dans une entreprise, les commerciaux utilisent une IA pour préparer des courriels tandis que les ressources humaines l''emploient pour des tâches administratives.

Ces deux services ne rencontrent pas nécessairement les mêmes risques et n''ont donc pas besoin d''un accompagnement strictement identique.','**Référence juridique :** article 4, dans sa rédaction applicable en 2026.

[Consulter l''article 4](https://ai-act-service-desk.ec.europa.eu/fr/ai-act/article-4)','Mettre en place une sensibilisation adaptée aux métiers, portant notamment sur les possibilités et les limites des outils, les erreurs possibles, la confidentialité des données, les biais et les contrôles humains nécessaires.

Conserver une trace des formations et sensibilisations constitue également une bonne pratique de suivi interne.','la maîtrise de l''IA doit être adaptée aux usages professionnels.'),
('v1.0','Q06',6,'Transparence','Une vidéo réaliste générée par IA fait prononcer à une personne des propos inventés, sans exception particulière.','[{"code": "A", "text": "Divulguer le caractère artificiel/manipulé"}, {"code": "B", "text": "Ne rien indiquer"}, {"code": "C", "text": "Interdire toute vidéo IA"}]','A','Une vidéo générée par IA peut reproduire l''apparence ou la voix d''une personne et lui faire prononcer des propos qu''elle n''a jamais tenus.

Lorsqu''un contenu correspond à la définition réglementaire du deepfake, son caractère artificiel ou manipulé doit en principe être divulgué.

Cela ne signifie pas que toute vidéo créée avec une IA est illégale.

Des modalités particulières existent notamment pour certaines créations artistiques, satiriques ou de fiction.','Une entreprise publie une vidéo montrant un dirigeant annonçant une nouvelle offre commerciale. La vidéo est entièrement générée par IA et le dirigeant n''a jamais prononcé ces paroles.

Le public doit pouvoir comprendre le caractère artificiel du contenu.','**Référence juridique :** article 3, point 60, et article 50, paragraphes 4 et 5.

[Consulter l''article 50](https://ai-act-service-desk.ec.europa.eu/fr/ai-act/article-50)','Ajouter une mention adaptée, par exemple :

« Vidéo fictive générée ou manipulée à l''aide d''une intelligence artificielle. »

Vérifier également les autorisations nécessaires avant d''utiliser l''image ou la voix d''une personne identifiable.','produire un contenu réaliste avec l''IA implique une responsabilité particulière concernant l''information du public.'),
('v1.0','Q07',7,'Pratiques interdites','Une notation sociale générale conduit à refuser des services sans rapport de manière injustifiée/disproportionnée.','[{"code": "A", "text": "Fidélisation ordinaire"}, {"code": "B", "text": "Pratique interdite"}, {"code": "C", "text": "Permis avec consentement"}]','B','Le règlement européen interdit certaines pratiques de notation sociale reposant sur l''analyse ou la classification de personnes en fonction de leurs comportements ou caractéristiques.

L''interdiction concerne notamment les situations dans lesquelles cette notation entraîne un traitement défavorable dans un contexte sans rapport avec celui dans lequel les données ont été collectées, ou un traitement injustifié ou disproportionné.

Cela ne signifie pas que tous les systèmes de notation et de fidélisation sont interdits.

Ce sont leurs finalités et leurs conséquences qui doivent être examinées.','Une entreprise attribue une note générale à ses clients à partir de leurs achats, de leurs comportements en ligne et d''autres informations personnelles.

Elle utilise ensuite cette note pour leur refuser des services sans rapport avec les comportements évalués.','**Référence juridique :** article 5, paragraphe 1, point c).

[Consulter l''article 5](https://ai-act-service-desk.ec.europa.eu/fr/ai-act/article-5)','Renoncer aux dispositifs entrant dans cette interdiction.

Pour tout autre système de notation, définir une finalité légitime, examiner la proportionnalité des critères et vérifier les conséquences pour les personnes concernées.','une note calculée automatiquement peut devenir problématique lorsqu''elle entraîne un traitement injustifié des personnes.'),
('v1.0','Q08',8,'Systèmes à haut risque','Une IA décide de l''admission à une formation professionnelle.','[{"code": "A", "text": "En principe à haut risque"}, {"code": "B", "text": "Toujours minimal"}, {"code": "C", "text": "Toujours interdit"}]','A','Une IA destinée à déterminer l''accès ou l''admission dans un établissement d''enseignement ou de formation professionnelle peut influencer directement le parcours d''une personne.

Un refus d''admission peut avoir des conséquences importantes sur ses possibilités d''apprentissage, de qualification et d''insertion professionnelle.

Ces systèmes figurent donc parmi les usages à haut risque de l''annexe III.

Ils ne sont pas automatiquement interdits, mais leur qualification et les obligations qui en découlent doivent être examinées avec attention.','Un organisme reçoit 200 demandes pour une formation qualifiante.

Une IA analyse les dossiers, classe les candidats et contribue à déterminer ceux qui seront admis.

Cette situation est différente d''un simple outil de création de supports pédagogiques.','**Référence juridique :** article 6 et annexe III, point 3 a).

[Consulter l''annexe III](https://ai-act-service-desk.ec.europa.eu/fr/ai-act/annex-3)','Avant le déploiement, examiner la classification du système et les obligations applicables.

Prévoir des critères d''admission compréhensibles, une supervision humaine adaptée et des procédures permettant d''examiner les contestations.','une IA qui aide à apprendre n''a pas nécessairement le même niveau de risque qu''une IA qui décide qui pourra apprendre.'),
('v1.0','Q09',9,'Responsabilités et analyse','Une entreprise utilise sous son autorité un système acheté auprès d''un éditeur.','[{"code": "A", "text": "Fournisseur du modèle"}, {"code": "B", "text": "Aucun rôle"}, {"code": "C", "text": "Déployeur"}]','C','Le règlement distingue plusieurs catégories d''acteurs.

Le fournisseur développe ou fait développer un système d''IA et le met sur le marché ou en service sous son propre nom ou sa marque.

Le déployeur est l''organisation ou la personne qui utilise un système d''IA sous sa propre autorité, en dehors d''un usage personnel non professionnel.

Une entreprise qui achète un outil d''IA pour l''utiliser dans son activité est donc généralement considérée comme déployeur.','Un organisme de formation achète un abonnement à une plateforme d''IA et autorise ses formateurs à l''utiliser pour préparer leurs cours.

L''éditeur du système et l''organisme utilisateur occupent des rôles différents.','**Référence juridique :** article 3, points 3 et 4.

[Consulter l''article 3](https://ai-act-service-desk.ec.europa.eu/fr/ai-act/article-3)','Avant d''utiliser un outil, identifier le fournisseur, le déployeur, sa destination prévue et les responsabilités de chacun.

Cette analyse doit être réexaminée si l''entreprise modifie substantiellement le système ou sa destination.','acheter une solution d''IA ne transfère pas automatiquement toutes les responsabilités à son éditeur.'),
('v1.0','Q10',10,'Systèmes à haut risque','Une entreprise veut exploiter un système à haut risque ; seule la facture est conservée.','[{"code": "A", "text": "Facture suffisante"}, {"code": "B", "text": "Examiner les obligations respectives"}, {"code": "C", "text": "Aucune obligation utilisateur"}]','B','Une facture ou une preuve d''achat ne suffit pas à démontrer la conformité d''un système d''IA à haut risque.

Lorsque les dispositions correspondantes sont applicables, le fournisseur doit notamment répondre à des exigences concernant la gestion des risques, la documentation et la conformité du système.

Le déployeur possède également ses propres obligations.

Celles-ci peuvent notamment concerner le respect des instructions, la supervision humaine et le suivi du fonctionnement.','Une entreprise achète un système d''IA destiné à participer à la sélection de candidats.

Le fait que le fournisseur présente son produit comme conforme ne dispense pas l''entreprise de vérifier ses propres conditions d''utilisation.','**Références juridiques :** article 16 pour les fournisseurs et article 26 pour les déployeurs.

[Consulter l''article 16](https://ai-act-service-desk.ec.europa.eu/fr/ai-act/article-16) · [Consulter l''article 26](https://ai-act-service-desk.ec.europa.eu/fr/ai-act/article-26)','Établir une liste de contrôle comprenant les documents du fournisseur, la destination du système, les modalités de supervision humaine, le suivi du fonctionnement et les obligations d''information.

Vérifier également la date d''application des exigences concernées.','la conformité ne se limite pas à l''achat d''un outil présenté comme conforme.'),
('v1.0','Q11',11,'Calendrier','En octobre 2026, date des principales exigences de l''annexe III, hors dispositions particulières ?','[{"code": "A", "text": "02/02/2025"}, {"code": "B", "text": "02/08/2026"}, {"code": "C", "text": "02/12/2027"}]','C','L''AI Act ne prévoit pas une seule date d''application pour l''ensemble de ses dispositions.

Les différentes catégories d''obligations entrent en application progressivement.

Dans le calendrier retenu par le tableau maître V1.0 :

| Date | Principales dispositions |
|---|---|
| 2 février 2025 | Certaines pratiques interdites et maîtrise de l''IA |
| 2 août 2026 | Principales obligations de transparence |
| 2 décembre 2027 | Principales exigences spécifiques aux systèmes à haut risque de l''annexe III |
| 2 août 2028 | Certaines exigences concernant les systèmes à haut risque liés aux produits réglementés |

Il convient de tenir compte des dispositions transitoires et des éventuelles modifications ultérieures du règlement.','En octobre 2026, une entreprise envisage d''intégrer une IA destinée au recrutement.

Elle doit déjà respecter les dispositions applicables et préparer les exigences spécifiques dont l''entrée en application est prévue ultérieurement.','**Référence juridique :** article 113, dans sa version consolidée retenue pour cette correction.

[Consulter l''article 113](https://ai-act-service-desk.ec.europa.eu/fr/ai-act/article-113)','Construire un calendrier distinguant les obligations déjà applicables, celles à venir et les dispositions transitoires.

Avant publication du jeu, revérifier cette question, car elle dépend directement de l''évolution du calendrier réglementaire.','connaître une obligation ne suffit pas, il faut également savoir à partir de quand elle s''applique.'),
('v1.0','Q12',12,'Responsabilités et analyse','Le vendeur dit « IA sans risque », mais ne précise ni finalité ni données ni décisions influencées.','[{"code": "A", "text": "Le croire"}, {"code": "B", "text": "Déclarer automatiquement interdit"}, {"code": "C", "text": "Demander les informations pour classifier"}]','C','Un fournisseur peut présenter son produit comme fiable, sécurisé ou sans risque particulier.

Ces affirmations commerciales ne permettent pas, à elles seules, de déterminer sa classification au regard de l''AI Act.

Il faut notamment comprendre la finalité du système, les données utilisées, les personnes concernées et les conséquences possibles de ses résultats.

Un même outil technique peut poser des questions différentes selon son utilisation.

Sans informations suffisantes, il serait prématuré de conclure qu''il s''agit d''un système à faible risque ou d''une pratique interdite.','Un prestataire propose une plateforme d''IA pour les ressources humaines.

Avant de l''utiliser, l''entreprise doit déterminer si elle sert simplement à rédiger des documents ou si elle intervient dans l''évaluation et la sélection des candidats.','**Références juridiques :** articles 3, 5 et 6, ainsi que l''annexe III.

[Consulter l''article 3](https://ai-act-service-desk.ec.europa.eu/fr/ai-act/article-3) · [Consulter l''article 6](https://ai-act-service-desk.ec.europa.eu/fr/ai-act/article-6)','Demander au fournisseur une documentation décrivant la destination du système, ses limites, les catégories de données traitées, les décisions qu''il peut influencer et les mesures de contrôle prévues.

Tant que les informations restent insuffisantes, différer le déploiement dans les usages sensibles.','on ne peut pas évaluer correctement les risques d''une IA sans comprendre ce qu''elle fait et comment elle sera utilisée.');
COMMIT;
