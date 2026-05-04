-- Índices para acelerar queries de liderancas, fiscais e eleitores
-- (filtros por cadastrado_por, suplente_id, municipio_id são muito frequentes)

CREATE INDEX IF NOT EXISTS idx_liderancas_cadastrado_por  ON liderancas(cadastrado_por);
CREATE INDEX IF NOT EXISTS idx_liderancas_suplente_id     ON liderancas(suplente_id);
CREATE INDEX IF NOT EXISTS idx_liderancas_municipio_id    ON liderancas(municipio_id);
CREATE INDEX IF NOT EXISTS idx_liderancas_status          ON liderancas(status);

CREATE INDEX IF NOT EXISTS idx_fiscais_cadastrado_por     ON fiscais(cadastrado_por);
CREATE INDEX IF NOT EXISTS idx_fiscais_suplente_id        ON fiscais(suplente_id);
CREATE INDEX IF NOT EXISTS idx_fiscais_municipio_id       ON fiscais(municipio_id);

CREATE INDEX IF NOT EXISTS idx_eleitores_cadastrado_por   ON possiveis_eleitores(cadastrado_por);
CREATE INDEX IF NOT EXISTS idx_eleitores_suplente_id      ON possiveis_eleitores(suplente_id);
CREATE INDEX IF NOT EXISTS idx_eleitores_municipio_id     ON possiveis_eleitores(municipio_id);

-- Corrige tipo_lideranca null nas lideranças registradas via link público
-- (evita ambiguidade de exibição no painel)
UPDATE liderancas
SET tipo_lideranca = 'Liderança'
WHERE origem_captacao = 'link_publico'
  AND tipo_lideranca IS NULL;
