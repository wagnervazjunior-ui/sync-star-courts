
CREATE TYPE public.bracket_match_format AS ENUM ('single_set', 'best_of_3_tiebreak');
CREATE TYPE public.bracket_status AS ENUM ('draft', 'live', 'finished');
CREATE TYPE public.bracket_phase AS ENUM ('double_elim', 'final_four');
CREATE TYPE public.bracket_match_phase AS ENUM ('WB', 'LB', 'SEMI', 'FINAL', 'THIRD');

CREATE TABLE public.brackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id uuid NOT NULL,
  category_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  match_format public.bracket_match_format NOT NULL DEFAULT 'single_set',
  target_score integer NOT NULL DEFAULT 18,
  tiebreak_points integer NOT NULL DEFAULT 15,
  status public.bracket_status NOT NULL DEFAULT 'draft',
  current_phase public.bracket_phase NOT NULL DEFAULT 'double_elim',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX brackets_championship_idx ON public.brackets(championship_id);
CREATE INDEX brackets_category_idx ON public.brackets(category_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brackets TO authenticated;
GRANT ALL ON public.brackets TO service_role;
ALTER TABLE public.brackets ENABLE ROW LEVEL SECURITY;
CREATE POLICY brackets_no_direct ON public.brackets FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.bracket_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bracket_id uuid NOT NULL REFERENCES public.brackets(id) ON DELETE CASCADE,
  seed integer NOT NULL,
  team_name text NOT NULL DEFAULT '',
  athlete1_name text NOT NULL DEFAULT '',
  athlete2_name text NOT NULL DEFAULT '',
  registration_id uuid,
  eliminated boolean NOT NULL DEFAULT false,
  final_rank integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bracket_id, seed)
);
CREATE INDEX bracket_teams_bracket_idx ON public.bracket_teams(bracket_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bracket_teams TO authenticated;
GRANT ALL ON public.bracket_teams TO service_role;
ALTER TABLE public.bracket_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY bracket_teams_no_direct ON public.bracket_teams FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.bracket_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bracket_id uuid NOT NULL REFERENCES public.brackets(id) ON DELETE CASCADE,
  phase public.bracket_match_phase NOT NULL,
  round integer NOT NULL,
  position integer NOT NULL,
  team_a_id uuid REFERENCES public.bracket_teams(id) ON DELETE SET NULL,
  team_b_id uuid REFERENCES public.bracket_teams(id) ON DELETE SET NULL,
  source_a jsonb,
  source_b jsonb,
  bye boolean NOT NULL DEFAULT false,
  sets jsonb NOT NULL DEFAULT '[]'::jsonb,
  winner_team_id uuid REFERENCES public.bracket_teams(id) ON DELETE SET NULL,
  played_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bracket_matches_bracket_idx ON public.bracket_matches(bracket_id);
CREATE INDEX bracket_matches_order_idx ON public.bracket_matches(bracket_id, phase, round, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bracket_matches TO authenticated;
GRANT ALL ON public.bracket_matches TO service_role;
ALTER TABLE public.bracket_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY bracket_matches_no_direct ON public.bracket_matches FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TRIGGER brackets_set_updated_at BEFORE UPDATE ON public.brackets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER bracket_matches_set_updated_at BEFORE UPDATE ON public.bracket_matches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
