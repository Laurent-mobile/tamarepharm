/*
  # Fix RLS Policy for vente_lignes SELECT

  1. Changes
    - Add SELECT policy for vente_lignes table to allow authenticated users to read sales lines
    - Policy checks that the user belongs to the same pharmacy as the sale
  
  2. Security
    - Users can only read sales lines from their own pharmacy
    - Policy enforces pharmacy_id check through the ventes table
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Enable read for authenticated users" ON vente_lignes;

-- Add SELECT policy for vente_lignes
CREATE POLICY "Enable read for authenticated users"
  ON vente_lignes
  FOR SELECT
  TO authenticated
  USING (
    vente_id IN (
      SELECT ventes.id
      FROM ventes
      WHERE ventes.pharmacy_id IN (
        SELECT utilisateurs.pharmacy_id
        FROM utilisateurs
        WHERE utilisateurs.id = auth.uid()
      )
    )
  );
