-- Permite sobrescrever o formato de disputa por partida (ex.: set único na
-- fase inicial, melhor de 3 com tiebreak a partir da semifinal), sem precisar
-- de lógica especial por fase — o admin escolhe manualmente por jogo.
-- NULL = usa o padrão da chave (brackets.match_format/target_score/tiebreak_points).
ALTER TABLE public.bracket_matches
  ADD COLUMN IF NOT EXISTS match_format public.bracket_match_format,
  ADD COLUMN IF NOT EXISTS target_score integer,
  ADD COLUMN IF NOT EXISTS tiebreak_points integer;
