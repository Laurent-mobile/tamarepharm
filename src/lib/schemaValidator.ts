// src/lib/schemaValidator.ts

// Liste officielle et stricte des colonnes autorisées pour chaque table dans Supabase
export const SCHEMA_MAP: Record<string, string[]> = {
  produits: [
    'id', 'pharmacy_id', 'nom', 'dci', 'forme', 'dosage', 'code_produit',
    'prix_achat', 'prix_vente', 'stock_minimum', 'prescription_requise',
    'tva', 'prix_vente_gros', 'prix_public', 'actif', 'numero_lot',
    'sous_ordonnance', 'stockable', 'classement', 'motif_declassement',
    'date_declassement', 'statut_produit'
  ],
  clients: [
    'id', 'pharmacy_id', 'nom_complet', 'telephone', 'adresse', 'assurance_id',
    'numero_assure', 'actif', 'matricule', 'taux_couverture', 'autorise_bon',
    'autorise_credit', 'autorise_avoir', 'plafond_credit', 'entreprise',
    'type_relation', 'entreprise_employeur', 'structure_acheteuse'
  ],
  assurances: [
    'id', 'pharmacy_id', 'nom', 'sous_societe', 'taux_couverture', 
    'telephone', 'email', 'actif'
  ],
  ventes: [
    'id', 'pharmacy_id', 'client_id', 'numero_vente', 'date_vente', 'statut',
    'montant_total', 'montant_assurance', 'montant_patient', 'vendeur_id',
    'caissier_id', 'montant_percu', 'monnaie_rendue', 'session_caisse_id',
    'type_paiement', 'operateur_mobile', 'numero_transaction_mobile',
    'ordonnance_presente', 'type_de_vente', 'numero_bon', 'montant_credit',
    'date_limite_credit', 'avoir_id', 'montant_avoir_utilise', 
    'montant_paye_comptant', 'proforma_origine_id'
    // ⚠️ NOTE: 'magasin_id' est INTENTIONNELLEMENT absent ici car il n'existe pas dans la table ventes
  ],
  vente_lignes: [
    'id', 'pharmacy_id', 'vente_id', 'produit_id', 'quantite', 
    'prix_unitaire', 'montant_total', 'lot'
  ],
  stock: [
    'id', 'pharmacy_id', 'produit_id', 'quantite', 'lot_numero', 
    'date_expiration', 'date_reception', 'statut', 'magasin_id', 'prix_achat_lot'
  ],
  fournisseurs: [
    'id', 'pharmacy_id', 'nom', 'contact', 'telephone', 'email', 'adresse', 'actif'
  ],
  commandes: [
    'id', 'pharmacy_id', 'fournisseur_id', 'numero_commande', 'date_commande', 
    'statut', 'montant_total'
  ],
  magasins: [
    'id', 'pharmacie_principale_id', 'nom', 'code', 'type', 'adresse', 
    'telephone', 'responsable', 'capacite_stock', 'actif'
  ],
  transferts: [
    'id', 'pharmacy_id', 'magasin_source_id', 'magasin_destination_id', 
    'pharmacy_source_id', 'pharmacy_destination_id', 'numero_transfert', 
    'date_transfert', 'statut', 'remarques', 'expedie_par', 'recu_par'
  ],
  transfert_lignes: [
    'id', 'transfert_id', 'produit_id', 'quantite', 'lot'
  ],
  demandes_proforma: [
    'id', 'pharmacy_id', 'fournisseur_id', 'client_structure_id', 'numero_demande', 
    'date_demande', 'statut', 'montant_estime', 'taux_reduction'
  ],
  demandes_proforma_lignes: [
    'id', 'demande_id', 'produit_id', 'quantite_demandee', 
    'prix_unitaire_estime', 'prix_unitaire_propose'
  ],
  receptions: [
    'id', 'pharmacy_id', 'commande_id', 'date_reception', 'type_reception', 
    'quantite_totale_recue'
  ],
  reception_lignes: [
    'id', 'reception_id', 'produit_id', 'quantite_recue', 'quantite_commandee', 
    'lot', 'date_expiration', 'prix_unitaire', 'etat_produit'
  ],
  comptes_clients: [
    'id', 'pharmacy_id', 'client_id', 'type_compte', 'solde_actuel', 'societe_reference'
  ],
  historique_consommation_compte: [
    'id', 'compte_id', 'vente_id', 'type_operation', 'montant', 
    'solde_apres_operation', 'date_operation', 'description'
  ],
  avoirs_clients: [
    'id', 'pharmacy_id', 'client_id', 'numero_avoir', 'montant', 'montant_utilise', 
    'montant_restant', 'date_emission', 'date_expiration', 'motif', 'statut', 'created_by'
  ],
  credits_clients: [
    'id', 'pharmacy_id', 'client_id', 'vente_id', 'montant_total', 'montant_paye', 
    'montant_restant', 'date_credit', 'date_limite_paiement', 'statut', 'remarques', 'created_by'
  ]
};

/**
 * Nettoie un objet en ne gardant QUE les colonnes autorisées par le schéma Supabase.
 * Cela empêche définitivement les erreurs "Column does not exist".
 */
export function sanitizeForSupabase(tableName: string, data: Record<string, any>): Record<string, any> {
  const allowedColumns = SCHEMA_MAP[tableName];
  
  if (!allowedColumns) {
    console.warn(`⚠️ Table '${tableName}' non référencée dans SCHEMA_MAP. Envoi des données brutes.`);
    return data;
  }
  
  const cleaned: Record<string, any> = {};
  for (const col of allowedColumns) {
    if (data[col] !== undefined) {
      cleaned[col] = data[col];
    }
  }
  
  // Nettoyage agressif des champs internes de synchronisation
  delete cleaned._sync_status;
  delete cleaned._local_id;
  delete cleaned.created_at; // Supabase gère les défauts, on évite les conflits de format
  delete cleaned.updated_at; 
  
  return cleaned;
}
