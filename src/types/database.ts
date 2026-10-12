export interface Pharmacie {
  id: string;
  nom: string;
  type: 'principale' | 'sous_depot';
  adresse?: string;
  telephone?: string;
  email?: string;
  created_at: string;
}

export interface Utilisateur {
  id: string;
  pharmacy_id: string;
  nom_complet: string;
  role: 'admin' | 'pharmacien' | 'vendeur' | 'caissier' | 'superviseur';
  telephone?: string;
  actif: boolean;
  created_at: string;
}

export interface Fournisseur {
  id: string;
  nom: string;
  contact?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  agrement?: string;
  actif: boolean;
  created_at: string;
}

export interface Produit {
  id: string;
  pharmacy_id: string;
  nom: string;
  dci?: string;
  forme?: string;
  dosage?: string;
  code_produit: string;
  numero_lot?: string;
  prix_achat: number;
  prix_vente: number;
  prix_public?: number;
  stock_minimum: number;
  prescription_requise: boolean;
  stockable?: boolean;
  classement?: string;
  statut_produit?: 'actif' | 'declasse' | 'perime' | 'retire';
  motif_declassement?: string;
  date_declassement?: string;
  actif: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Stock {
  id: string;
  pharmacy_id: string;
  produit_id: string;
  magasin_id?: string | null;
  quantite: number;
  quantite_reservee: number;
  lot_numero?: string;
  date_expiration?: string;
  date_reception?: string;
  emplacement?: string;
  prix_achat_lot?: number;
  statut: 'actif' | 'perime' | 'vendu' | 'retour';
  updated_at: string;
}

export interface Assurance {
  id: string;
  pharmacy_id: string; // ✅ AJOUTÉ
  nom: string;
  sous_societe?: string;
  taux_couverture: number;
  telephone?: string;
  email?: string;
  actif: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  pharmacy_id: string;
  matricule?: string;
  entreprise?: string;
  nom_complet: string;
  adresse?: string;
  telephone?: string;
  assurance_id?: string;
  taux_couverture?: number;
  numero_assure?: string;
  autorise_bon?: boolean;
  autorise_credit?: boolean;
  autorise_avoir?: boolean;
  plafond_credit?: number;
  created_at: string;
  updated_at?: string; // ✅ AJOUTÉ
  assurances?: Assurance;
}

export interface CompteClient {
  id: string;
  pharmacy_id: string;
  client_id: string;
  type_compte: 'avoir' | 'credit_bon';
  solde_actuel: number;
  societe_reference?: string;
  date_creation: string;
  updated_at: string;
  clients?: Client;
}

export interface HistoriqueConsommationCompte {
  id: string;
  compte_id: string;
  vente_id?: string;
  type_operation: 'depot' | 'consommation' | 'remboursement';
  montant: number;
  solde_apres_operation: number;
  date_operation: string;
  description?: string;
  comptes_clients?: CompteClient;
  ventes?: Vente;
}

export interface CommandeFournisseur {
  id: string;
  pharmacy_id: string;
  fournisseur_id: string;
  numero_commande: string;
  date_commande: string;
  statut: 'en_attente' | 'partielle' | 'complete' | 'annulee';
  montant_total: number;
  created_by: string;
  proforma_id?: string;
  bon_commande_numero?: string;
  date_livraison_prevue?: string;
  valide_par?: string;
  date_validation?: string;
  created_at: string;
  fournisseurs?: Fournisseur;
  commande_fournisseur_lignes?: CommandeFournisseurLigne[];
  demandes_proforma?: DemandeProforma;
  utilisateurs?: Utilisateur;
  utilisateurs_valide_par?: Utilisateur;
}

export interface Reception {
  id: string;
  commande_id: string;
  date_reception: string;
  type_reception: 'totale' | 'partielle';
  remarques?: string;
  recu_par: string;
  created_at: string;
  receptions_lignes?: ReceptionLigne[];
  utilisateurs?: Utilisateur;
}

export interface ReceptionLigne {
  id: string;
  reception_id: string;
  produit_id: string;
  quantite_recue: number;
  quantite_commandee: number;
  lot?: string;
  date_expiration?: string;
  prix_unitaire: number;
  etat_produit: 'conforme' | 'non_conforme' | 'endommage';
  remarques?: string;
  created_at: string;
  produits?: Produit;
}

export interface HistoriqueCommande {
  id: string;
  commande_id?: string;
  proforma_id?: string;
  type_evenement: 'proforma_cree' | 'proforma_envoye' | 'proforma_recu' | 'proforma_valide' | 'proforma_refuse' | 'commande_creee' | 'commande_validee' | 'commande_envoyee' | 'commande_modifiee' | 'reception_partielle' | 'reception_complete' | 'commande_annulee';
  description: string;
  details: any;
  utilisateur_id: string;
  date_evenement: string;
  created_at: string;
  utilisateurs?: Utilisateur;
  commandes_fournisseurs?: CommandeFournisseur;
  demandes_proforma?: DemandeProforma;
}

export interface Vente {
  id: string;
  pharmacy_id: string;
  client_id?: string;
  numero_vente: string;
  date_vente: string;
  type_de_vente: 'ordinaire' | 'bon' | 'credit' | 'credit_bon' | 'avoir';
  statut: 'en_preparation' | 'en_attente_paiement' | 'payee' | 'annulee';
  montant_total: number;
  montant_assurance: number;
  montant_patient: number;
  vendeur_id: string;
  caissier_id?: string;
  numero_bon?: string;
  montant_credit?: number;
  date_limite_credit?: string;
  avoir_id?: string;
  montant_avoir_utilise?: number;
  ordonnance_presente?: boolean;
  created_at: string;
  clients?: Client;
}

export interface VenteLigne {
  id: string;
  vente_id: string;
  produit_id: string;
  quantite: number;
  prix_unitaire: number;
  lot?: string;
  created_at: string;
  produits?: Produit;
}

export interface DemandeProforma {
  id: string;
  pharmacy_id: string;
  fournisseur_id?: string;
  client_structure_id?: string;
  numero_demande: string;
  date_demande: string;
  date_besoin?: string;
  statut: 'brouillon' | 'envoyee' | 'recu' | 'validee' | 'refusee' | 'transformee';
  montant_estime: number;
  taux_reduction?: number;
  remarques?: string;
  created_by: string;
  created_at: string;
  fournisseurs?: Fournisseur;
  clients?: Client;
  demandes_proforma_lignes?: DemandeProformaLigne[];
  utilisateurs?: Utilisateur;
}

export interface DemandeProformaLigne {
  id: string;
  demande_id: string;
  produit_id: string;
  quantite_demandee: number;
  prix_unitaire_estime?: number;
  prix_unitaire_propose?: number;
  remarques?: string;
  created_at: string;
  produits?: Produit;
}

export interface AvoirClient {
  id: string;
  pharmacy_id: string;
  client_id: string;
  numero_avoir: string;
  montant: number;
  montant_utilise: number;
  montant_restant: number;
  date_emission: string;
  date_expiration?: string;
  motif?: string;
  statut: 'actif' | 'utilise' | 'expire' | 'annule';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreditClient {
  id: string;
  pharmacy_id: string;
  client_id: string;
  vente_id?: string;
  montant_total: number;
  montant_paye: number;
  montant_restant: number;
  date_credit: string;
  date_limite_paiement: string;
  statut: 'en_cours' | 'partiellement_paye' | 'paye' | 'en_retard' | 'annule';
  remarques?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ClassementProduit {
  id: string;
  pharmacy_id: string;
  nom: string;
  description?: string;
  couleur: string;
  actif: boolean;
  created_at: string;
}

export interface Transfert {
  id: string;
  pharmacy_source_id: string;
  pharmacy_destination_id: string;
  numero_transfert: string;
  date_transfert: string;
  statut: 'en_attente' | 'en_transit' | 'recu' | 'annule';
  remarques?: string;
  expedie_par: string;
  recu_par?: string;
  created_at: string;
}

export interface TransfertLigne {
  id: string;
  transfert_id: string;
  produit_id: string;
  quantite: number;
  lot?: string;
  created_at: string;
  produits?: Produit;
}

export interface Inventaire {
  id: string;
  pharmacy_id: string;
  date_inventaire: string;
  statut: 'en_cours' | 'termine' | 'valide';
  remarques?: string;
  realise_par: string;
  created_at: string;
}

export interface InventaireLigne {
  id: string;
  inventaire_id: string;
  produit_id: string;
  quantite_theorique: number;
  quantite_physique: number;
  ecart: number;
  lot?: string;
  created_at: string;
  produits?: Produit;
}

export interface DashboardStats {
  commandesEnAttente: number;
  inventairesEnCours: number;
  stockBas: number;
  produitsExpires: number;
  chiffreAffaireMois: number;
  chiffreAffaireSemaine: number;
  chiffreAffaireJour: number;
  evolutionMensuelle: number;
}
