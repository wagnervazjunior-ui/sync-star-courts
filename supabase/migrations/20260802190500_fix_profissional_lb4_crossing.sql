-- Corrige o cruzamento do último drop-in da chave de perdedores na chave
-- "Profissional - Estação Open" (já gerada com a lógica antiga, antes do
-- fix em generator.ts). Nenhum dos dois confrontos tem resultado lançado.
-- Confronto 1 (João ET e Esquerdinha x ?) deve receber o perdedor da
-- semifinal WB-3-1 (Edson Jr e Giovane), não o da WB-3-2.
UPDATE public.bracket_matches
SET team_b_id = 'a00812a1-c4ca-423c-afda-dbd268b83cd9', -- Edson Jr e Giovane
    source_b = '{"key": "WB-3-1", "type": "loser_of"}'::jsonb
WHERE id = '5f18415f-1d94-410f-ab41-74cd33e0fc9e';

-- Confronto 2 (Índio e Felipe x ?) deve receber o perdedor da semifinal
-- WB-3-2 (Dudu e Arthur), não o da WB-3-1.
UPDATE public.bracket_matches
SET team_b_id = '372e9ccb-50f3-400e-868c-fab99bc278c3', -- Dudu e Arthur
    source_b = '{"key": "WB-3-2", "type": "loser_of"}'::jsonb
WHERE id = '1850f281-88b1-4a8e-be63-072eb5af135d';
