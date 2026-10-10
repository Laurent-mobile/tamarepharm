/*
  # Amélioration du suivi des réceptions partielles

  1. Modifications
    - Ajouter une colonne pour tracker le numéro de réception progressive
    - Améliorer la logique de suivi des quantités restantes
    - Ajouter des contraintes pour valider les réceptions
    
  2. Nouvelles colonnes dans commande_fournisseur_lignes
    - quantite_restante_a_recevoir : calculée dynamiquement
    - dernier_reception_date : date de dernière réception

  3. Nouvelles colonnes dans receptions
    - numero_reception : séquence pour les réceptions partielles
    - quantite_totale_recue : total de toutes les réceptions
*/

-- Ajouter les colonnes manquantes pour tracer la progression
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'receptions' AND column_name = 'numero_reception'
  ) THEN
    ALTER TABLE receptions ADD COLUMN numero_reception INTEGER DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'receptions' AND column_name = 'quantite_totale_recue'
  ) THEN
    ALTER TABLE receptions ADD COLUMN quantite_totale_recue INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commande_fournisseur_lignes' AND column_name = 'dernier_reception_date'
  ) THEN
    ALTER TABLE commande_fournisseur_lignes ADD COLUMN dernier_reception_date TIMESTAMPTZ;
  END IF;
END $$;

-- Ajouter des contraintes pour valider les réceptions
DO $$
BEGIN
  -- Vérifier que quantite_recue ne dépasse pas quantite_commandee
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'check_quantite_recue_max'
  ) THEN
    ALTER TABLE commande_fournisseur_lignes 
    ADD CONSTRAINT check_quantite_recue_max 
    CHECK (quantite_recue <= quantite_commandee);
  END IF;
END $$;

-- Créer une vue pour faciliter la requête des quantités restantes
CREATE OR REPLACE VIEW vue_quantites_restantes AS
SELECT 
  cfl.id as ligne_id,
  cfl.commande_id,
  cfl.produit_id,
  cfl.quantite_commandee,
  cfl.quantite_recue,
  (cfl.quantite_commandee - COALESCE(cfl.quantite_recue, 0)) as quantite_restante,
  cf.statut as statut_commande,
  cf.date_commande,
  cf.fournisseur_id
FROM commande_fournisseur_lignes cfl
JOIN commandes_fournisseurs cf ON cf.id = cfl.commande_id;

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_commande_lignes_quantite_recue ON commande_fournisseur_lignes(quantite_recue);
CREATE INDEX IF NOT EXISTS idx_reception_numero ON receptions(numero_reception, commande_id);
CREATE INDEX IF NOT EXISTS idx_reception_lignes_commande ON reception_lignes(reception_id);
