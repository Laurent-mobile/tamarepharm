import Dexie, { type Table } from 'dexie';

// ============================================
// TYPES pour la base de données locale (IndexedDB)
// ============================================

export interface LocalProduit {
  id: string;
  pharmacy_id: string;
  nom: string;
  code_produit: string;
  dci?: string;
  forme?: string;
  dosage?: string;
  prix_achat: number;
  prix_vente: number;
  stock_minimum: number;
  prescription_requise?: boolean;
  categorie?: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
  _sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
  _local_id?: string;
}

export interface LocalProforma {
  id: string;
  pharmacy_id: string;
  fournisseur_id: string;
  numero_demande: string;
  date_demande: string;
  statut: string;
  montant_estime: number;
  created_at: string;
  _sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
}

export interface LocalCommande {
  id: string;
  pharmacy_id: string;
  fournisseur_id: string;
  numero_commande: string;
  date_commande: string;
  statut: string;
  montant_total: number;
  created_at: string;
  _sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
}

export interface LocalReception {
  id: string;
  pharmacy_id: string;
  commande_id: string;
  date_reception: string;
  type_reception: string;
  quantite_totale_recue: number;
  created_at: string;
  _sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
}

export interface LocalAssurance {
  id: string;
  pharmacy_id: string;
  nom: string;
  taux_couverture: number;
  telephone?: string;
  email?: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
  _sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
}

export interface LocalClient {
  id: string;
  pharmacy_id: string;
  nom_complet: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  type_client?: string;
  assurance_id?: string;
  numero_assure?: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
  _sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
}

export interface LocalVente {
  id: string;
  pharmacy_id: string;
  client_id?: string;
  date_vente: string;
  montant_total: number;
  montant_assurance?: number;
  montant_patient?: number;
  statut: string;
  mode_paiement?: string;
  utilisateur_id: string;
  created_at: string;
  updated_at: string;
  _sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
}

export interface LocalVenteLigne {
  id: string;
  pharmacy_id: string;
  vente_id: string;
  produit_id: string;
  quantite: number;
  prix_unitaire: number;
  montant_total: number;
  lot?: string;
  _sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
}

export interface LocalStock {
  id: string;
  pharmacy_id: string;
  produit_id: string;
  magasin_id?: string | null;
  quantite: number;
  lot_numero: string;
  date_expiration?: string;
  date_reception: string;
  statut: string;
  updated_at: string;
  _sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
}

export interface LocalFournisseur {
  id: string;
  pharmacy_id: string;
  nom: string;
  contact?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
  _sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
}

export interface LocalMagasin {
  id: string;
  pharmacie_principale_id: string;
  nom: string;
  code: string;
  type: string;
  actif: boolean;
  created_at: string;
  _sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
}

export interface LocalTransfert {
  id: string;
  pharmacy_id: string;
  magasin_source_id: string | null;
  magasin_destination_id: string | null;
  pharmacy_source_id: string;
  pharmacy_destination_id: string;
  numero_transfert: string;
  date_transfert: string;
  statut: 'en_attente' | 'en_transit' | 'recu' | 'annule';
  remarques?: string;
  expedie_par: string;
  recu_par?: string;
  created_at: string;
  _sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
}

export interface LocalTransfertLigne {
  id: string;
  transfert_id: string;
  produit_id: string;
  quantite: number;
  lot?: string;
  created_at: string;
  _sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
}

export interface LocalSyncLog {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'create' | 'update' | 'delete';
  data: any;
  status: 'pending' | 'synced' | 'failed';
  error_message?: string;
  created_at: string;
  synced_at?: string;
  retry_count: number;
}

// ============================================
// ✅ NOUVEAUX TYPES POUR LES LIGNES (AJOUTÉS)
// ============================================

export interface LocalCommandeFournisseurLigne {
  id: string;
  commande_id: string;
  produit_id: string;
  quantite_commandee: number;
  quantite_recue: number;
  prix_unitaire: number;
  _sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
}

export interface LocalDemandeProformaLigne {
  id: string;
  demande_id: string;
  produit_id: string;
  quantite_demandee: number;
  prix_unitaire_estime: number;
  prix_unitaire_propose: number;
  _sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
}

export interface LocalReceptionLigne {
  id: string;
  reception_id: string;
  produit_id: string;
  quantite_recue: number;
  quantite_commandee: number;
  lot: string;
  date_expiration: string;
  prix_unitaire: number;
  etat_produit: string;
  _sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
}

// ============================================
// BASE DE DONNÉES DEXIE (IndexedDB)
// ============================================
class PharmacieLocalDB extends Dexie {
  produits!: Table<LocalProduit, string>;
  clients!: Table<LocalClient, string>;
  assurances!: Table<LocalAssurance, string>;
  ventes!: Table<LocalVente, string>;
  vente_lignes!: Table<LocalVenteLigne, string>;
  stock!: Table<LocalStock, string>;
  fournisseurs!: Table<LocalFournisseur, string>;
  commandes!: Table<LocalCommande, string>;
  demandes_proforma!: Table<LocalProforma, string>;
  receptions!: Table<LocalReception, string>;
  magasins!: Table<LocalMagasin, string>;
  transferts!: Table<LocalTransfert, string>;
  transfert_lignes!: Table<LocalTransfertLigne, string>;
  sync_log!: Table<LocalSyncLog, string>;

  // ✅ NOUVELLES TABLES DE LIGNES
  commande_fournisseur_lignes!: Table<LocalCommandeFournisseurLigne, string>;
  demandes_proforma_lignes!: Table<LocalDemandeProformaLigne, string>;
  reception_lignes!: Table<LocalReceptionLigne, string>;

  constructor() {
    super('PharmacieDB');

    // Version 1 : Tables de base
    this.version(1).stores({
      produits: 'id, pharmacy_id, code_produit, nom, actif, _sync_status',
      clients: 'id, pharmacy_id, nom_complet, telephone, assurance_id, actif, _sync_status',
      assurances: 'id, pharmacy_id, nom, actif, _sync_status',
      ventes: 'id, pharmacy_id, client_id, date_vente, statut, utilisateur_id, _sync_status',
      vente_lignes: 'id, pharmacy_id, vente_id, produit_id, _sync_status',
      stock: 'id, pharmacy_id, produit_id, lot_numero, statut, _sync_status, [pharmacy_id+produit_id]',
      fournisseurs: 'id, pharmacy_id, nom, actif, _sync_status',
      commandes: 'id, pharmacy_id, created_at, statut, _sync_status',
      demandes_proforma: 'id, pharmacy_id, date_demande, statut, _sync_status',
      receptions: 'id, pharmacy_id, date_reception, _sync_status',
      sync_log: 'id, table_name, record_id, status, created_at',
    });

    // Version 2 : Ajout des tables Magasins et Transferts
    this.version(2).stores({
      magasins: 'id, pharmacie_principale_id, nom, code, actif, _sync_status',
      transferts: 'id, pharmacy_id, numero_transfert, date_transfert, statut, _sync_status',
      transfert_lignes: 'id, transfert_id, produit_id, _sync_status',
    });

    // ✅ Version 3 : Ajout des tables de lignes pour les jointures locales
    this.version(3).stores({
      commande_fournisseur_lignes: 'id, commande_id, produit_id, _sync_status',
      demandes_proforma_lignes: 'id, demande_id, produit_id, _sync_status',
      reception_lignes: 'id, reception_id, produit_id, _sync_status',
    });
  }
}

export const localDb = new PharmacieLocalDB();
