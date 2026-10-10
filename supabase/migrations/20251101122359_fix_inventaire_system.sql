/*
  # Amélioration du système d'inventaire

  1. Modifications
    - Ajout de politiques RLS pour inventaire_lignes
    - Ajout d'une table historique_inventaires pour traçabilité
    - Amélioration de la gestion des lots et écarts

  2. Sécurité
    - RLS activé sur inventaire_lignes
    - Politiques pour vérifier access via inventaire.pharmacy_id
    
  3. Historique
    - Table pour tracer les ajustements de stocks
*/

-- Ajouter les colonnes manquantes à inventaire_lignes si elles n'existent pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventaire_lignes' AND column_name = 'date_expiration'
  ) THEN
    ALTER TABLE inventaire_lignes ADD COLUMN date_expiration DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventaire_lignes' AND column_name = 'remarques_ligne'
  ) THEN
    ALTER TABLE inventaire_lignes ADD COLUMN remarques_ligne TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventaire_lignes' AND column_name = 'etat_produit'
  ) THEN
    ALTER TABLE inventaire_lignes ADD COLUMN etat_produit TEXT DEFAULT 'conforme' 
      CHECK (etat_produit IN ('conforme', 'endomage', 'perime'));
  END IF;
END $$;

-- Table d'historique des ajustements d'inventaire
CREATE TABLE IF NOT EXISTS historique_inventaires (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  inventaire_id UUID NOT NULL REFERENCES inventaires(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produits(id),
  lot TEXT,
  quantite_avant INTEGER NOT NULL,
  quantite_apres INTEGER NOT NULL,
  ecart INTEGER NOT NULL,
  type_ajustement TEXT NOT NULL CHECK (type_ajustement IN ('surplus', 'manque', 'endomage', 'perime')),
  remarques TEXT,
  date_ajustement TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Activer RLS sur les tables
ALTER TABLE inventaire_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE historique_inventaires ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour inventaire_lignes
CREATE POLICY "Users can view inventory lines from their pharmacy"
  ON inventaire_lignes FOR SELECT
  TO authenticated
  USING (
    inventaire_id IN (
      SELECT id FROM inventaires WHERE pharmacy_id IN (
        SELECT pharmacy_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert inventory lines"
  ON inventaire_lignes FOR INSERT
  TO authenticated
  WITH CHECK (
    inventaire_id IN (
      SELECT id FROM inventaires WHERE pharmacy_id IN (
        SELECT pharmacy_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update inventory lines"
  ON inventaire_lignes FOR UPDATE
  TO authenticated
  USING (
    inventaire_id IN (
      SELECT id FROM inventaires WHERE pharmacy_id IN (
        SELECT pharmacy_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete inventory lines"
  ON inventaire_lignes FOR DELETE
  TO authenticated
  USING (
    inventaire_id IN (
      SELECT id FROM inventaires WHERE pharmacy_id IN (
        SELECT pharmacy_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

-- Politiques RLS pour historique_inventaires
CREATE POLICY "Users can view inventory history from their pharmacy"
  ON historique_inventaires FOR SELECT
  TO authenticated
  USING (
    inventaire_id IN (
      SELECT id FROM inventaires WHERE pharmacy_id IN (
        SELECT pharmacy_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert inventory history"
  ON historique_inventaires FOR INSERT
  TO authenticated
  WITH CHECK (
    inventaire_id IN (
      SELECT id FROM inventaires WHERE pharmacy_id IN (
        SELECT pharmacy_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_inventaire_lignes_inventaire ON inventaire_lignes(inventaire_id);
CREATE INDEX IF NOT EXISTS idx_inventaire_lignes_produit ON inventaire_lignes(produit_id);
CREATE INDEX IF NOT EXISTS idx_historique_inventaires_inventaire ON historique_inventaires(inventaire_id);
CREATE INDEX IF NOT EXISTS idx_historique_inventaires_produit ON historique_inventaires(produit_id);
