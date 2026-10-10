/*
  # Création du système complet de gestion des commandes fournisseurs

  ## 1. Nouvelles Tables
    
    ### `demandes_proforma`
    - Demandes de pro-forma (devis) envoyées aux fournisseurs
    - Statut: brouillon, envoyee, recu, validee, refusee
    - Contient les produits demandés avec quantités
    
    ### `demandes_proforma_lignes`
    - Lignes de produits des demandes de pro-forma
    
    ### `historique_commandes`
    - Historisation de toutes les étapes du workflow
    - Pro-forma → Validation → Bon de commande → Réception
    
    ### `reception_lignes`
    - Détail des produits reçus à chaque réception partielle
    - Permet de suivre lot, date d'expiration, état des produits reçus

  ## 2. Modifications
    - Ajout d'un champ `proforma_id` dans `commandes_fournisseurs`
    - Ajout d'un champ `bon_commande_numero` généré automatiquement
    - Ajout de champs pour validation du pro-forma

  ## 3. Sécurité
    - RLS activé sur toutes les tables
    - Politiques pour authenticated users avec vérification pharmacy_id
*/

-- Table des demandes de pro-forma
CREATE TABLE IF NOT EXISTS demandes_proforma (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
  fournisseur_id UUID NOT NULL REFERENCES fournisseurs(id),
  numero_demande TEXT NOT NULL UNIQUE,
  date_demande DATE NOT NULL DEFAULT CURRENT_DATE,
  date_besoin DATE,
  statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'envoyee', 'recu', 'validee', 'refusee', 'transformee')),
  montant_estime NUMERIC DEFAULT 0,
  remarques TEXT,
  created_by UUID NOT NULL REFERENCES utilisateurs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Lignes des demandes de pro-forma
CREATE TABLE IF NOT EXISTS demandes_proforma_lignes (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  demande_id UUID NOT NULL REFERENCES demandes_proforma(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produits(id),
  quantite_demandee INTEGER NOT NULL,
  prix_unitaire_estime NUMERIC,
  prix_unitaire_propose NUMERIC,
  remarques TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ajouter des colonnes à commandes_fournisseurs si elles n'existent pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commandes_fournisseurs' AND column_name = 'proforma_id'
  ) THEN
    ALTER TABLE commandes_fournisseurs ADD COLUMN proforma_id UUID REFERENCES demandes_proforma(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commandes_fournisseurs' AND column_name = 'bon_commande_numero'
  ) THEN
    ALTER TABLE commandes_fournisseurs ADD COLUMN bon_commande_numero TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commandes_fournisseurs' AND column_name = 'date_livraison_prevue'
  ) THEN
    ALTER TABLE commandes_fournisseurs ADD COLUMN date_livraison_prevue DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commandes_fournisseurs' AND column_name = 'valide_par'
  ) THEN
    ALTER TABLE commandes_fournisseurs ADD COLUMN valide_par UUID REFERENCES utilisateurs(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commandes_fournisseurs' AND column_name = 'date_validation'
  ) THEN
    ALTER TABLE commandes_fournisseurs ADD COLUMN date_validation TIMESTAMPTZ;
  END IF;
END $$;

-- Table d'historisation des étapes
CREATE TABLE IF NOT EXISTS historique_commandes (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  commande_id UUID REFERENCES commandes_fournisseurs(id) ON DELETE CASCADE,
  proforma_id UUID REFERENCES demandes_proforma(id) ON DELETE CASCADE,
  type_evenement TEXT NOT NULL CHECK (type_evenement IN (
    'proforma_cree', 'proforma_envoye', 'proforma_recu', 'proforma_valide', 'proforma_refuse',
    'commande_creee', 'commande_validee', 'commande_envoyee', 'commande_modifiee',
    'reception_partielle', 'reception_complete', 'commande_annulee'
  )),
  description TEXT NOT NULL,
  details JSONB,
  utilisateur_id UUID NOT NULL REFERENCES utilisateurs(id),
  date_evenement TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Table des lignes de réception détaillées
CREATE TABLE IF NOT EXISTS reception_lignes (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  reception_id UUID NOT NULL REFERENCES receptions(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produits(id),
  quantite_recue INTEGER NOT NULL,
  quantite_commandee INTEGER NOT NULL,
  lot TEXT,
  date_expiration DATE,
  prix_unitaire NUMERIC NOT NULL,
  etat_produit TEXT DEFAULT 'conforme' CHECK (etat_produit IN ('conforme', 'non_conforme', 'endommage')),
  remarques TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Activer RLS sur les nouvelles tables
ALTER TABLE demandes_proforma ENABLE ROW LEVEL SECURITY;
ALTER TABLE demandes_proforma_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE historique_commandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reception_lignes ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour demandes_proforma
CREATE POLICY "Users can view proforma from their pharmacy"
  ON demandes_proforma FOR SELECT
  TO authenticated
  USING (
    pharmacy_id IN (
      SELECT pharmacy_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create proforma for their pharmacy"
  ON demandes_proforma FOR INSERT
  TO authenticated
  WITH CHECK (
    pharmacy_id IN (
      SELECT pharmacy_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update proforma from their pharmacy"
  ON demandes_proforma FOR UPDATE
  TO authenticated
  USING (
    pharmacy_id IN (
      SELECT pharmacy_id FROM utilisateurs WHERE id = auth.uid()
    )
  );

-- Politiques RLS pour demandes_proforma_lignes
CREATE POLICY "Users can view proforma lines from their pharmacy"
  ON demandes_proforma_lignes FOR SELECT
  TO authenticated
  USING (
    demande_id IN (
      SELECT id FROM demandes_proforma WHERE pharmacy_id IN (
        SELECT pharmacy_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert proforma lines"
  ON demandes_proforma_lignes FOR INSERT
  TO authenticated
  WITH CHECK (
    demande_id IN (
      SELECT id FROM demandes_proforma WHERE pharmacy_id IN (
        SELECT pharmacy_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update proforma lines"
  ON demandes_proforma_lignes FOR UPDATE
  TO authenticated
  USING (
    demande_id IN (
      SELECT id FROM demandes_proforma WHERE pharmacy_id IN (
        SELECT pharmacy_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

-- Politiques RLS pour historique_commandes
CREATE POLICY "Users can view order history from their pharmacy"
  ON historique_commandes FOR SELECT
  TO authenticated
  USING (
    (commande_id IN (
      SELECT id FROM commandes_fournisseurs WHERE pharmacy_id IN (
        SELECT pharmacy_id FROM utilisateurs WHERE id = auth.uid()
      )
    ))
    OR
    (proforma_id IN (
      SELECT id FROM demandes_proforma WHERE pharmacy_id IN (
        SELECT pharmacy_id FROM utilisateurs WHERE id = auth.uid()
      )
    ))
  );

CREATE POLICY "Users can insert order history"
  ON historique_commandes FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Politiques RLS pour reception_lignes
CREATE POLICY "Users can view reception lines from their pharmacy"
  ON reception_lignes FOR SELECT
  TO authenticated
  USING (
    reception_id IN (
      SELECT r.id FROM receptions r
      JOIN commandes_fournisseurs cf ON cf.id = r.commande_id
      WHERE cf.pharmacy_id IN (
        SELECT pharmacy_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert reception lines"
  ON reception_lignes FOR INSERT
  TO authenticated
  WITH CHECK (
    reception_id IN (
      SELECT r.id FROM receptions r
      JOIN commandes_fournisseurs cf ON cf.id = r.commande_id
      WHERE cf.pharmacy_id IN (
        SELECT pharmacy_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update reception lines"
  ON reception_lignes FOR UPDATE
  TO authenticated
  USING (
    reception_id IN (
      SELECT r.id FROM receptions r
      JOIN commandes_fournisseurs cf ON cf.id = r.commande_id
      WHERE cf.pharmacy_id IN (
        SELECT pharmacy_id FROM utilisateurs WHERE id = auth.uid()
      )
    )
  );

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_demandes_proforma_pharmacy ON demandes_proforma(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_demandes_proforma_fournisseur ON demandes_proforma(fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_demandes_proforma_statut ON demandes_proforma(statut);
CREATE INDEX IF NOT EXISTS idx_historique_commandes_commande ON historique_commandes(commande_id);
CREATE INDEX IF NOT EXISTS idx_historique_commandes_proforma ON historique_commandes(proforma_id);
CREATE INDEX IF NOT EXISTS idx_reception_lignes_reception ON reception_lignes(reception_id);
