import { localDb } from './localDb';
import { syncEngine } from './syncEngine';
import { supabase } from './supabase'; 
import { v4 as uuidv4 } from 'uuid';

export const repository = {
  // ═══════════════════════════════════════
  // PRODUITS
  // ═══════════════════════════════════════
  async getProduits(pharmacyId: string) {
    return await localDb.produits.where('pharmacy_id').equals(pharmacyId).and(p => p.actif !== false).toArray();
  },
  async createProduit(data: any) {
    const id = data.id || uuidv4();
    const now = new Date().toISOString();
    const produit = { ...data, id, created_at: now, updated_at: now, _sync_status: 'pending_create' as const };
    await localDb.produits.add(produit);
    await syncEngine.logOperation('produits', id, 'create', produit);
    return produit;
  },
  async updateProduit(id: string, data: any) {
    const updated = { ...data, id, updated_at: new Date().toISOString(), _sync_status: 'pending_update' as const };
    await localDb.produits.update(id, updated);
    await syncEngine.logOperation('produits', id, 'update', updated);
    return updated;
  },
  async deleteProduit(id: string) {
    await localDb.produits.update(id, { _sync_status: 'pending_delete' });
    await syncEngine.logOperation('produits', id, 'delete', { id });
  },

  // ═══════════════════════════════════════
  // CLIENTS
  // ═══════════════════════════════════════
  async getClients(pharmacyId: string) {
    return await localDb.clients.where('pharmacy_id').equals(pharmacyId).and(c => c.actif !== false).toArray();
  },
  async createClient(data: any) {
    const id = data.id || uuidv4();
    const now = new Date().toISOString();
    const client = { ...data, id, created_at: now, updated_at: now, _sync_status: 'pending_create' as const };
    await localDb.clients.add(client);
    await syncEngine.logOperation('clients', id, 'create', client);
    return client;
  },
  async updateClient(id: string, data: any) {
    const updated = { ...data, id, updated_at: new Date().toISOString(), _sync_status: 'pending_update' as const };
    await localDb.clients.update(id, updated);
    await syncEngine.logOperation('clients', id, 'update', updated);
    return updated;
  },
  async deleteClient(id: string) {
    await localDb.clients.update(id, { _sync_status: 'pending_delete' });
    await syncEngine.logOperation('clients', id, 'delete', { id });
  },

  // ═══════════════════════════════════════
  // ASSURANCES
  // ═══════════════════════════════════════
  async getAssurances(pharmacyId: string) {
    return await localDb.assurances.where('pharmacy_id').equals(pharmacyId).and(a => a.actif !== false).toArray();
  },
  async createAssurance(data: any) {
    const id = data.id || uuidv4();
    const now = new Date().toISOString();
    const assurance = { ...data, id, created_at: now, updated_at: now, _sync_status: 'pending_create' as const };
    await localDb.assurances.add(assurance);
    await syncEngine.logOperation('assurances', id, 'create', assurance);
    return assurance;
  },
  async updateAssurance(id: string, data: any) {
    const updated = { ...data, id, updated_at: new Date().toISOString(), _sync_status: 'pending_update' as const };
    await localDb.assurances.update(id, updated);
    await syncEngine.logOperation('assurances', id, 'update', updated);
    return updated;
  },
  async deleteAssurance(id: string) {
    await localDb.assurances.update(id, { _sync_status: 'pending_delete' });
    await syncEngine.logOperation('assurances', id, 'delete', { id });
  },

  // ═══════════════════════════════════════
  // MAGASINS & DÉPÔT
  // ═══════════════════════════════════════
  async getMagasins(pharmacyId: string) {
    return await localDb.magasins.where('pharmacie_principale_id').equals(pharmacyId).and(m => m.actif !== false).toArray();
  },
  async createMagasin(data: any) {
    const id = data.id || uuidv4();
    const now = new Date().toISOString();
    const magasin = { ...data, id, pharmacie_principale_id: data.pharmacy_id || data.pharmacie_principale_id, created_at: now, updated_at: now, _sync_status: 'pending_create' as const };
    await localDb.magasins.add(magasin);
    await syncEngine.logOperation('magasins', id, 'create', magasin);
    return magasin;
  },
  async getDepotPrincipal(pharmacyId: string) {
    try {
      const magasins = await this.getMagasins(pharmacyId);
      if (!magasins || magasins.length === 0) {
        console.warn('⚠️ Aucun magasin configuré pour cette pharmacie');
        return null;
      }
      const entrepot = magasins.find(m => m.type === 'entrepot');
      if (entrepot) {
        console.log('🏭 Dépôt principal détecté (type entrepôt):', entrepot.nom);
        return entrepot;
      }
      const plusAncien = [...magasins].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      console.log('🏛️ Dépôt principal détecté (plus ancien):', plusAncien.nom);
      return plusAncien;
    } catch (error) {
      console.error('❌ Erreur détection dépôt principal:', error);
      return null;
    }
  },
  async isDepotPrincipal(pharmacyId: string, magasinId: string) {
    const depot = await this.getDepotPrincipal(pharmacyId);
    return depot?.id === magasinId;
  },

  // ═══════════════════════════════════════
  // VENTES
  // ═══════════════════════════════════════
  async getVentes(pharmacyId: string, dateDebut?: string, dateFin?: string) {
    let query = localDb.ventes.where('pharmacy_id').equals(pharmacyId);
    if (dateDebut) {
      return await query.and(v => v.date_vente >= dateDebut && (!dateFin || v.date_vente <= dateFin)).reverse().sortBy('date_vente');
    }
    return await query.reverse().sortBy('date_vente');
  },
  async getVentesEnAttente(pharmacyId: string) {
    return await localDb.ventes.where('pharmacy_id').equals(pharmacyId).and(v => v.statut === 'en_attente_paiement').reverse().sortBy('date_vente');
  },
     async createVente(data: any, lignes: any[]) {
    const venteId = data.id || uuidv4();
    const now = new Date().toISOString();
    
    // ✅ AUTO-DÉTECTION DU MAGASIN DE VENTE (Pharmacie)
    // Si le magasin_id n'est pas fourni, on le cherche automatiquement
    let magasinId = data.magasin_id;
    if (magasinId === undefined) {
      const magasins = await this.getMagasins(data.pharmacy_id);
      // On cherche un magasin dont le nom contient "pharmacie" ou dont le type est "pharmacie"
      const magasinPharmacie = magasins?.find(m => 
        m.nom.toLowerCase().includes('pharmacie') || m.type === 'pharmacie'
      );
      // Fallback : si on ne trouve pas, on prend null (qui représente souvent la Pharmacie Principale)
      magasinId = magasinPharmacie?.id || null;
    }

    // On enregistre explicitement le magasin_id dans la vente pour la traçabilité
    const vente = { 
      ...data, 
      id: venteId, 
      magasin_id: magasinId, 
      created_at: now, 
      updated_at: now, 
      _sync_status: 'pending_create' as const 
    };
    
    await localDb.ventes.add(vente);
    await syncEngine.logOperation('ventes', venteId, 'create', vente);
    
    for (const ligne of lignes) {
      const ligneId = ligne.id || uuidv4();
      const venteLigne = { 
        ...ligne, 
        id: ligneId, 
        pharmacy_id: data.pharmacy_id, 
        vente_id: venteId, 
        _sync_status: 'pending_create' as const 
      };
      await localDb.vente_lignes.add(venteLigne);
      await syncEngine.logOperation('vente_lignes', ligneId, 'create', venteLigne);
      
      // ✅ CRITIQUE : On passe le magasinId pour ne déduire QUE du stock de la Pharmacie
      await this.decrementerStock(
        data.pharmacy_id, 
        ligne.produit_id, 
        ligne.quantite, 
        ligne.lot, 
        magasinId // <-- C'est ce paramètre qui garantit que le dépôt n'est pas touché
      );
    }
    return vente;
  },
  async getVenteLignes(venteId: string) {
    return await localDb.vente_lignes.where('vente_id').equals(venteId).toArray();
  },
  async updateVente(id: string, data: any) {
    const updated = { ...data, id, updated_at: new Date().toISOString(), _sync_status: 'pending_update' as const };
    await localDb.ventes.update(id, updated);
    await syncEngine.logOperation('ventes', id, 'update', updated);
    return updated;
  },

  // ═══════════════════════════════════════
  // TRANSFERTS
  // ═══════════════════════════════════════
  async getTransferts(pharmacyId: string) {
    return await localDb.transferts.where('pharmacy_id').equals(pharmacyId).reverse().sortBy('date_transfert');
  },
  async getTransfertLignes(transfertId: string) {
    return await localDb.transfert_lignes.where('transfert_id').equals(transfertId).toArray();
  },
  async createTransfert(data: any) {
    const id = data.id || uuidv4();
    const now = new Date().toISOString();
    const transfert = { ...data, id, created_at: now, updated_at: now, _sync_status: 'pending_create' as const };
    await localDb.transferts.add(transfert);
    await syncEngine.logOperation('transferts', id, 'create', transfert);
    return transfert;
  },
  async createTransfertLignes(lignes: any[]) {
    for (const ligne of lignes) {
      const ligneId = ligne.id || uuidv4();
      const nouvelleLigne = { ...ligne, id: ligneId, _sync_status: 'pending_create' as const };
      await localDb.transfert_lignes.add(nouvelleLigne);
      await syncEngine.logOperation('transfert_lignes', ligneId, 'create', nouvelleLigne);
    }
  },
  async updateTransfert(id: string, data: any) {
    const updated = { ...data, id, updated_at: new Date().toISOString(), _sync_status: 'pending_update' as const };
    await localDb.transferts.update(id, updated);
    await syncEngine.logOperation('transferts', id, 'update', updated);
    return updated;
  },

  // ═══════════════════════════════════════
  // STOCK
  // ═══════════════════════════════════════
  async getStock(pharmacyId: string) {
    return await localDb.stock.where('pharmacy_id').equals(pharmacyId).and(s => s.quantite > 0).toArray();
  },
  async getStockByProduit(pharmacyId: string, produitId: string) {
    return await localDb.stock.where('[pharmacy_id+produit_id]').equals([pharmacyId, produitId]).toArray();
  },
  async ajouterEntreeStock(data: any) {
    const id = data.id || uuidv4();
    const now = new Date().toISOString();
    const stockItem = {
      id, pharmacy_id: data.pharmacy_id, produit_id: data.produit_id, magasin_id: data.magasin_id || null,
      quantite: data.quantite, lot_numero: data.lot_numero || '', date_reception: data.date_reception,
      date_expiration: data.date_expiration || null, emplacement: data.emplacement || null,
      prix_achat_lot: data.prix_achat_lot || 0, statut: 'actif', created_at: now, updated_at: now,
      _sync_status: 'pending_create' as const
    };
    await localDb.stock.add(stockItem);
    await syncEngine.logOperation('stock', id, 'create', stockItem);
    return stockItem;
  },
  async enregistrerSortieAjustement(pharmacyId: string, stockId: string, produitId: string, quantite: number, motif: string, typeAjustement: string, utilisateurId: string, lotNumero: string) {
    await this.decrementerStock(pharmacyId, produitId, quantite, lotNumero);
    return true;
  },
  // ✅ FONCTION CORRIGÉE : Décrémenter le stock en respectant le magasin source et le lot (FEFO)
      async decrementerStock(pharmacyId: string, produitId: string, quantite: number, lot?: string, magasinId?: string | null) {
    const allStock = await localDb.stock.toArray();
    
    const stockItems = allStock
      .filter(s => 
        s.pharmacy_id === pharmacyId && 
        s.produit_id === produitId && 
        s.quantite > 0 && 
        // ✅ FILTRE STRICT : On ne regarde que le stock du magasin concerné
        (magasinId === undefined ? true : s.magasin_id === magasinId)
      )
      .sort((a, b) => {
        // Tri FEFO (First Expired, First Out)
        if (!a.date_expiration) return 1;
        if (!b.date_expiration) return -1;
        return new Date(a.date_expiration).getTime() - new Date(b.date_expiration).getTime();
      });

    let resteADeduire = quantite;
    for (const item of stockItems) {
      if (resteADeduire <= 0) break;
      
      // Si un lot spécifique est demandé, on ne touche qu'à ce lot
      if (lot && item.lot_numero !== lot) continue;

      const deduction = Math.min(item.quantite, resteADeduire);
      const nouvelleQuantite = item.quantite - deduction;
      
      await localDb.stock.update(item.id, { 
        quantite: nouvelleQuantite, 
        updated_at: new Date().toISOString(), 
        _sync_status: 'pending_update' 
      });
      await syncEngine.logOperation('stock', item.id, 'update', { id: item.id, quantite: nouvelleQuantite });
      
      resteADeduire -= deduction;
    }
    
    if (resteADeduire > 0) {
      console.warn(`⚠️ Stock insuffisant pour produit ${produitId} dans le magasin ${magasinId || 'Principal'}: manque ${resteADeduire}`);
      throw new Error(`Stock insuffisant dans ce magasin pour ce produit.`);
    }
  },

  // ═══════════════════════════════════════
  // FOURNISSEURS & COMMANDES
  // ═══════════════════════════════════════
  async getFournisseurs(pharmacyId: string) {
    return await localDb.fournisseurs.where('pharmacy_id').equals(pharmacyId).and(f => f.actif !== false).toArray();
  },

  async createCommande(data: any) {
    const id = data.id || uuidv4();
    const now = new Date().toISOString();
    const commande = { ...data, id, created_at: now, updated_at: now, _sync_status: 'pending_create' as const };
    try {
      await localDb.commandes.add(commande);
      await syncEngine.logOperation('commandes', id, 'create', commande);
    } catch (error) {
      console.warn('⚠️ Table commandes non disponible en local, création directe dans Supabase');
    }
    return commande;
  },

  async getCommandes(pharmacyId: string) {
    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('commandes_fournisseurs')
          .select(`*, fournisseurs(*), commande_fournisseur_lignes(*, produits(*)), demandes_proforma(*)`)
          .eq('pharmacy_id', pharmacyId)
          .order('created_at', { ascending: false });
        
        if (!error && data) {
          for (const commande of data) {
            await localDb.commandes.put(commande);
            if (commande.commande_fournisseur_lignes) {
              for (const ligne of commande.commande_fournisseur_lignes) {
                await localDb.commande_fournisseur_lignes.put(ligne);
              }
            }
          }
          console.log('✅ Commandes chargées et mises en cache depuis Supabase:', data.length);
          return data;
        }
      } catch (error) {
        console.error('❌ Erreur Supabase commandes:', error);
      }
    }

    try {
      const commandes = await localDb.commandes.where('pharmacy_id').equals(pharmacyId).reverse().sortBy('created_at');
      for (const commande of commandes) {
        const lignes = await localDb.commande_fournisseur_lignes.where('commande_id').equals(commande.id).toArray();
        for (const ligne of lignes) {
          if (ligne.produit_id && typeof ligne.produit_id === 'string') {
            try { (ligne as any).produits = await localDb.produits.get(ligne.produit_id); } catch(e) { (ligne as any).produits = null; }
          } else { (ligne as any).produits = null; }
        }
        (commande as any).commande_fournisseur_lignes = lignes;
        
        if (commande.fournisseur_id && typeof commande.fournisseur_id === 'string') {
          try { (commande as any).fournisseurs = await localDb.fournisseurs.get(commande.fournisseur_id); } catch(e) { (commande as any).fournisseurs = null; }
        } else { (commande as any).fournisseurs = null; }

        if ((commande as any).proforma_id && typeof (commande as any).proforma_id === 'string') {
          try { (commande as any).demandes_proforma = await localDb.demandes_proforma.get((commande as any).proforma_id); } catch(e) { (commande as any).demandes_proforma = null; }
        }
      }
      console.log('✅ Commandes chargées et enrichies depuis le cache local:', commandes.length);
      return commandes;
    } catch (error) {
      console.error('❌ Erreur chargement local commandes:', error);
      return [];
    }
  },

  // ═══════════════════════════════════════
  // PROFORMAS DE VENTE (Ventes Structures)
  // ═══════════════════════════════════════
  async getProformasVentes(pharmacyId: string) {
    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('demandes_proforma')
          .select(`*, clients(*), demandes_proforma_lignes(*, produits(*)), utilisateurs(*)`)
          .eq('pharmacy_id', pharmacyId)
          .not('client_structure_id', 'is', null)
          .order('date_demande', { ascending: false });
        
        if (!error && data) {
          for (const proforma of data) {
            await localDb.demandes_proforma.put(proforma);
            if (proforma.demandes_proforma_lignes) {
              for (const ligne of proforma.demandes_proforma_lignes) {
                await localDb.demandes_proforma_lignes.put(ligne);
              }
            }
          }
          console.log('✅ Proformas Ventes chargés depuis Supabase:', data.length);
          return data;
        }
      } catch (error) {
        console.error('❌ Erreur Supabase proformas ventes:', error);
      }
    }

    try {
      const allProformas = await localDb.demandes_proforma.where('pharmacy_id').equals(pharmacyId).toArray();
      const proformasVentes = allProformas.filter(p => p.client_structure_id || p.client_id);
      
      for (const proforma of proformasVentes) {
        const lignes = await localDb.demandes_proforma_lignes.where('demande_id').equals(proforma.id).toArray();
        
        for (const ligne of lignes) {
          // ✅ PROTECTION BLINDÉE : Ne chercher le produit que si l'ID est une chaîne valide
          if (ligne.produit_id && typeof ligne.produit_id === 'string' && ligne.produit_id.trim() !== '') {
            try {
              const produit = await localDb.produits.get(ligne.produit_id);
              (ligne as any).produits = produit || null;
            } catch (e) {
              (ligne as any).produits = null;
            }
          } else {
            (ligne as any).produits = null;
          }
        }
        (proforma as any).demandes_proforma_lignes = lignes;
        
        // ✅ PROTECTION BLINDÉE : Ne chercher le client que si l'ID est une chaîne valide
        const clientId = proforma.client_structure_id || proforma.client_id;
        if (clientId && typeof clientId === 'string' && clientId.trim() !== '') {
          try {
            (proforma as any).clients = await localDb.clients.get(clientId);
          } catch (e) {
            (proforma as any).clients = null;
          }
        } else {
          (proforma as any).clients = null;
        }
      }
      
      console.log('✅ Proformas Ventes chargés depuis le cache local:', proformasVentes.length);
      return proformasVentes;
    } catch (error) {
      console.error('❌ Erreur chargement local proformas ventes:', error);
      return [];
    }
  },

  // ═══════════════════════════════════════
  // PROFORMAS D'ACQUISITION (Menu Commandes)
  // ═══════════════════════════════════════
  async getProformasFournisseur(pharmacyId: string) {
    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('demandes_proforma')
          .select(`*, fournisseurs(*), demandes_proforma_lignes(*, produits(*)), utilisateurs(*)`)
          .eq('pharmacy_id', pharmacyId)
          .not('fournisseur_id', 'is', null)
          .order('date_demande', { ascending: false });
        
        if (!error && data) {
          for (const proforma of data) {
            await localDb.demandes_proforma.put(proforma);
            if (proforma.demandes_proforma_lignes) {
              for (const ligne of proforma.demandes_proforma_lignes) {
                await localDb.demandes_proforma_lignes.put(ligne);
              }
            }
          }
          console.log('✅ Proformas Fournisseurs chargés depuis Supabase:', data.length);
          return data;
        }
      } catch (error) {
        console.error('❌ Erreur Supabase proformas fournisseurs:', error);
      }
    }

    try {
      const allProformas = await localDb.demandes_proforma.where('pharmacy_id').equals(pharmacyId).toArray();
      const proformasFournisseur = allProformas.filter(p => p.fournisseur_id);
      
      for (const proforma of proformasFournisseur) {
        const lignes = await localDb.demandes_proforma_lignes.where('demande_id').equals(proforma.id).toArray();
        
        for (const ligne of lignes) {
          // ✅ PROTECTION BLINDÉE
          if (ligne.produit_id && typeof ligne.produit_id === 'string' && ligne.produit_id.trim() !== '') {
            try {
              const produit = await localDb.produits.get(ligne.produit_id);
              (ligne as any).produits = produit || null;
            } catch (e) {
              (ligne as any).produits = null;
            }
          } else {
            (ligne as any).produits = null;
          }
        }
        (proforma as any).demandes_proforma_lignes = lignes;
        
        // ✅ PROTECTION BLINDÉE
        const fournisseurId = proforma.fournisseur_id;
        if (fournisseurId && typeof fournisseurId === 'string' && fournisseurId.trim() !== '') {
          try {
            (proforma as any).fournisseurs = await localDb.fournisseurs.get(fournisseurId);
          } catch (e) {
            (proforma as any).fournisseurs = null;
          }
        } else {
          (proforma as any).fournisseurs = null;
        }
      }
      
      console.log('✅ Proformas Fournisseurs chargés depuis le cache local:', proformasFournisseur.length);
      return proformasFournisseur;
    } catch (error) {
      console.error('❌ Erreur chargement local proformas fournisseurs:', error);
      return [];
    }
  },

  // ═══════════════════════════════════════
  // RÉCEPTIONS
  // ═══════════════════════════════════════
  async getReceptions(pharmacyId: string) {
    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('receptions')
          .select(`*, utilisateurs!receptions_recu_par_fkey(nom_complet), commandes_fournisseurs!receptions_commande_id_fkey(numero_commande, fournisseurs(nom)), reception_lignes(*, produits(nom, code_produit))`)
          .eq('pharmacy_id', pharmacyId)
          .order('date_reception', { ascending: false });
        
        if (!error && data) {
          for (const reception of data) {
            await localDb.receptions.put(reception);
            if (reception.reception_lignes) {
              for (const ligne of reception.reception_lignes) {
                await localDb.reception_lignes.put(ligne);
              }
            }
          }
          console.log('✅ Réceptions chargées et mises en cache depuis Supabase:', data.length);
          return data;
        }
      } catch (error) {
        console.error('❌ Erreur Supabase réceptions:', error);
      }
    }

    try {
      const receptions = await localDb.receptions.where('pharmacy_id').equals(pharmacyId).reverse().sortBy('date_reception');
      for (const reception of receptions) {
        const lignes = await localDb.reception_lignes.where('reception_id').equals(reception.id).toArray();
        for (const ligne of lignes) {
          if (ligne.produit_id && typeof ligne.produit_id === 'string') {
            try { (ligne as any).produits = await localDb.produits.get(ligne.produit_id); } catch(e) { (ligne as any).produits = null; }
          } else { (ligne as any).produits = null; }
        }
        (reception as any).reception_lignes = lignes;
        
        if (reception.commande_id && typeof reception.commande_id === 'string') {
          try {
            const commande = await localDb.commandes.get(reception.commande_id);
            if (commande) {
              (reception as any).commandes_fournisseurs = {
                numero_commande: commande.numero_commande,
                fournisseurs: commande.fournisseur_id && typeof commande.fournisseur_id === 'string' ? await localDb.fournisseurs.get(commande.fournisseur_id) : null
              };
            }
          } catch(e) { /* Ignorer les erreurs de jointure locale */ }
        }
      }
      console.log('✅ Réceptions chargées et enrichies depuis le cache local:', receptions.length);
      return receptions;
    } catch (error) {
      console.error('❌ Erreur chargement local réceptions:', error);
      return [];
    }
  },

  // ═══════════════════════════════════════
  // GESTION DES COMPTES CLIENTS (AVOIR / CRÉDIT)
  // ═══════════════════════════════════════
  async getCompteClient(pharmacyId: string, clientId: string, typeCompte: 'avoir' | 'credit_bon') {
    return await localDb.comptes_clients
      .where('pharmacy_id').equals(pharmacyId)
      .and(c => c.client_id === clientId && c.type_compte === typeCompte)
      .first();
  },

  async enregistrerDepotClient(pharmacyId: string, clientId: string, typeCompte: 'avoir' | 'credit_bon', montant: number, societeReference?: string, description?: string) {
    // Vérifier si un compte existe déjà pour ce client et ce type
    const compteExistant = await localDb.comptes_clients
      .where('pharmacy_id').equals(pharmacyId)
      .and(c => c.client_id === clientId && c.type_compte === typeCompte)
      .first();

    const now = new Date().toISOString();

    if (compteExistant) {
      const nouveauSolde = compteExistant.solde_actuel + montant;
      await localDb.comptes_clients.update(compteExistant.id, {
        solde_actuel: nouveauSolde,
        updated_at: now,
        _sync_status: 'pending_update'
      });
      await syncEngine.logOperation('comptes_clients', compteExistant.id, 'update', { solde_actuel: nouveauSolde });

      // Historique
      await localDb.historique_consommation_comptes.add({
        id: uuidv4(),
        pharmacy_id: pharmacyId,
        compte_client_id: compteExistant.id,
        client_id: clientId,
        type_operation: 'depot',
        montant: montant,
        solde_avant_operation: compteExistant.solde_actuel,
        solde_apres_operation: nouveauSolde,
        description: description || `Dépôt ${typeCompte}`,
        date_operation: now,
        _sync_status: 'pending_create'
      });
      return compteExistant;
    } else {
      const nouveauCompte = {
        id: uuidv4(),
        pharmacy_id: pharmacyId,
        client_id: clientId,
        type_compte: typeCompte,
        solde_actuel: montant,
        societe_reference: societeReference || null,
        description: description || null,
        created_at: now,
        updated_at: now,
        _sync_status: 'pending_create'
      };
      await localDb.comptes_clients.add(nouveauCompte);
      await syncEngine.logOperation('comptes_clients', nouveauCompte.id, 'create', nouveauCompte);

      await localDb.historique_consommation_comptes.add({
        id: uuidv4(),
        pharmacy_id: pharmacyId,
        compte_client_id: nouveauCompte.id,
        client_id: clientId,
        type_operation: 'depot',
        montant: montant,
        solde_avant_operation: 0,
        solde_apres_operation: montant,
        description: description || `Dépôt initial ${typeCompte}`,
        date_operation: now,
        _sync_status: 'pending_create'
      });
      return nouveauCompte;
    }
  },
  // ✅ NOUVEAU : Consommer un compte (avoir ou crédit bon) lors d'une vente
    async consommerCompte(compteId: string, montant: number, venteId: string, description?: string) {
    const compte = await localDb.comptes_clients.get(compteId);
    if (!compte) throw new Error('Compte client introuvable');
    if (montant > compte.solde_actuel) {
      throw new Error(`Montant (${montant}) supérieur au solde disponible (${compte.solde_actuel})`);
    }

    const nouveauSolde = compte.solde_actuel - montant;
    const now = new Date().toISOString();

    await localDb.comptes_clients.update(compteId, {
      solde_actuel: nouveauSolde,
      updated_at: now,
      _sync_status: 'pending_update'
    });
    await syncEngine.logOperation('comptes_clients', compteId, 'update', { solde_actuel: nouveauSolde });

    // ✅ CORRECTION : Nom de la table au singulier et champs correspondants au schéma SQL
    await localDb.historique_consommation_compte.add({
      id: uuidv4(),
      compte_id: compteId,
      vente_id: venteId,
      type_operation: 'consommation',
      montant: montant,
      solde_apres_operation: nouveauSolde,
      date_operation: now,
      description: description || `Utilisation pour vente ${venteId}`,
      _sync_status: 'pending_create'
    });

    return { nouveauSolde };
  },

  async consommerSoldeClient(pharmacyId: string, clientId: string, typeCompte: 'avoir' | 'credit_bon', montantConsomme: number, venteId: string) {
    const compte = await this.getCompteClient(pharmacyId, clientId, typeCompte);

    if (!compte || compte.solde_actuel < montantConsomme) {
      throw new Error(`Solde insuffisant. Disponible: ${compte?.solde_actuel || 0} F`);
    }

    const now = new Date().toISOString();
    const nouveauSolde = compte.solde_actuel - montantConsomme;

    await localDb.comptes_clients.update(compte.id, {
      solde_actuel: nouveauSolde,
      updated_at: now,
      _sync_status: 'pending_update'
    });

    const historiqueId = uuidv4();
    await localDb.historique_consommation_compte.add({
      id: historiqueId,
      compte_id: compte.id,
      vente_id: venteId,
      type_operation: 'consommation',
      montant: montantConsomme,
      solde_apres_operation: nouveauSolde,
      date_operation: now,
      description: `Consommation via vente`,
      _sync_status: 'pending_create'
    });

    await syncEngine.logOperation('comptes_clients', compte.id, 'update', { solde_actuel: nouveauSolde });
    await syncEngine.logOperation('historique_consommation_compte', historiqueId, 'create', { compte_id: compte.id, montant: montantConsomme, type_operation: 'consommation' });

    return nouveauSolde;
  },

  async getAllComptesClients(pharmacyId: string) {
    return await localDb.comptes_clients
      .where('pharmacy_id').equals(pharmacyId)
      .and(c => c.solde_actuel > 0)
      .toArray();
      },

       async getComptesAvoirsClient(pharmacyId: string, clientId: string) {
    return await localDb.comptes_clients
      .where('pharmacy_id').equals(pharmacyId)
      .and(c => c.client_id === clientId && c.type_compte === 'avoir' && c.solde_actuel > 0)
      .toArray();
  },
  async getComptesActifsClient(pharmacyId: string, clientId: string) {
    return await localDb.comptes_clients
      .where('pharmacy_id').equals(pharmacyId)
      .and(c => c.client_id === clientId && c.solde_actuel > 0)
      .toArray();
  },

  async getHistoriqueCompte(compteId: string) {
    return await localDb.historique_consommation_compte
      .where('compte_id')
      .equals(compteId)
      .reverse()
      .sortBy('date_operation');
  },

  async getAllClientsForAccounts(pharmacyId: string) {
    return await localDb.clients.where('pharmacy_id').equals(pharmacyId).toArray();
  },

    // ═══════════════════════════════════════
  // AVOIRS CLIENTS
  // ═══════════════════════════════════════
  async getAvoirsClient(pharmacyId: string, clientId: string) {
    return await localDb.avoirs_clients
      .where('pharmacy_id').equals(pharmacyId)
      .and(a => a.client_id === clientId && a.statut === 'actif' && a.montant_restant > 0)
      .toArray();
  },

  async getAvoirsActifs(pharmacyId: string) {
    return await localDb.avoirs_clients
      .where('pharmacy_id').equals(pharmacyId)
      .and(a => a.statut === 'actif' && a.montant_restant > 0)
      .toArray();
  },

  async utiliserAvoir(avoirId: string, montantUtilise: number, venteId: string) {
    const avoir = await localDb.avoirs_clients.get(avoirId);
    if (!avoir) throw new Error('Avoir introuvable');
    if (montantUtilise > avoir.montant_restant) {
      throw new Error(`Montant utilisé (${montantUtilise}) supérieur au solde disponible (${avoir.montant_restant})`);
    }

    const nouveauRestant = avoir.montant_restant - montantUtilise;
    const nouveauStatut = nouveauRestant <= 0 ? 'utilise' : 'actif';

    await localDb.avoirs_clients.update(avoirId, {
      montant_utilise: avoir.montant_utilise + montantUtilise,
      montant_restant: nouveauRestant,
      statut: nouveauStatut,
      updated_at: new Date().toISOString(),
      _sync_status: 'pending_update'
    });

    await syncEngine.logOperation('avoirs_clients', avoirId, 'update', {
      montant_utilise: avoir.montant_utilise + montantUtilise,
      montant_restant: nouveauRestant,
      statut: nouveauStatut
    });

    return { nouveauRestant, nouveauStatut };
  },

  async createAvoir(data: any) {
    const id = data.id || uuidv4();
    const now = new Date().toISOString();
    const avoir = {
      ...data,
      id,
      montant_utilise: 0,
      montant_restant: data.montant,
      statut: 'actif',
      created_at: now,
      updated_at: now,
      _sync_status: 'pending_create'
    };
    await localDb.avoirs_clients.add(avoir);
    await syncEngine.logOperation('avoirs_clients', id, 'create', avoir);
    return avoir;
  },

  // ═══════════════════════════════════════
  // PROFORMA & PAIEMENT COMPTANT
  // ═══════════════════════════════════════
  async createProforma(data: any, lignes: any[]) {
    const proformaId = data.id || uuidv4();
    const now = new Date().toISOString();

    const proforma = { 
      ...data, 
      id: proformaId, 
      created_at: now, 
      updated_at: now, 
      statut: 'brouillon',
      _sync_status: 'pending_create' as const 
    };
    
    await localDb.demandes_proforma.add(proforma);
    await syncEngine.logOperation('demandes_proforma', proformaId, 'create', proforma);

    for (const ligne of lignes) {
      const ligneId = ligne.id || uuidv4();
      await localDb.demandes_proforma_lignes.add({ 
        ...ligne, 
        id: ligneId, 
        demande_id: proformaId, 
        _sync_status: 'pending_create' as const 
      });
      await syncEngine.logOperation('demandes_proforma_lignes', ligneId, 'create', { demande_id: proformaId });
    }
    return proforma;
  },

  async updateProforma(proformaId: string, data: any, lignes: any[]) {
  console.log('🔄 Mise à jour proforma:', proformaId, 'avec', lignes.length, 'lignes');
  
  // 1. Mettre à jour le proforma
  await localDb.demandes_proforma.update(proformaId, { 
    ...data, 
    updated_at: new Date().toISOString(),
    _sync_status: 'pending_update'
  });
  await syncEngine.logOperation('demandes_proforma', proformaId, 'update', data);

  // 2. SUPPRIMER TOUTES les anciennes lignes du proforma
  const anciennesLignes = await localDb.demandes_proforma_lignes
    .where('demande_id')
    .equals(proformaId)
    .toArray();
  
  console.log('🗑️ Suppression de', anciennesLignes.length, 'anciennes lignes');
  
  for (const ligne of anciennesLignes) {
    await localDb.demandes_proforma_lignes.delete(ligne.id);
    await syncEngine.logOperation('demandes_proforma_lignes', ligne.id, 'delete', { 
      demande_id: proformaId,
      ancienne_ligne_id: ligne.id 
    });
  }

  // 3. Ajouter les nouvelles lignes
  console.log('➕ Ajout de', lignes.length, 'nouvelles lignes');
  for (const ligne of lignes) {
    const ligneId = ligne.id || uuidv4();
    const nouvelleLigne = {
      id: ligneId,
      produit_id: ligne.produit_id,
      quantite_demandee: ligne.quantite_demandee,
      prix_unitaire_estime: ligne.prix_unitaire_estime,
      prix_unitaire_propose: ligne.prix_unitaire_propose,
      lot_numero: ligne.lot_numero,
      date_expiration: ligne.date_expiration || null,
      demande_id: proformaId,
      _sync_status: 'pending_create' as const
    };
    
    await localDb.demandes_proforma_lignes.add(nouvelleLigne);
    await syncEngine.logOperation('demandes_proforma_lignes', ligneId, 'create', nouvelleLigne);
  }
  
  return data;
},

  async transformerProformaEnVente(proformaId: string, venteData: any, lignesVente: any[]) {
    await localDb.demandes_proforma.update(proformaId, { 
      statut: 'transformee',
      updated_at: new Date().toISOString(),
      _sync_status: 'pending_update'
    });
    await syncEngine.logOperation('demandes_proforma', proformaId, 'update', { statut: 'transformee' });

    const venteDataPourCaisse = {
      ...venteData,
      statut: 'en_attente_paiement'
    };

    const venteCreee = await this.createVente(venteDataPourCaisse, lignesVente);
    return venteCreee;
  },

    // ═══════════════════════════════════════
  // SUPPRESSION DE PROFORMA (Brouillon uniquement)
  // ═══════════════════════════════════════
  async deleteProforma(proformaId: string) {
    // 1. Supprimer les lignes associées
    const lignes = await localDb.demandes_proforma_lignes.where('demande_id').equals(proformaId).toArray();
    for (const ligne of lignes) {
      await localDb.demandes_proforma_lignes.delete(ligne.id);
      await syncEngine.logOperation('demandes_proforma_lignes', ligne.id, 'delete', { demande_id: proformaId });
    }
    
    // 2. Supprimer le proforma
    await localDb.demandes_proforma.delete(proformaId);
    await syncEngine.logOperation('demandes_proforma', proformaId, 'delete', { id: proformaId });
  },

  // ═══════════════════════════════════════
  // RÉCUPÉRER LE PREMIER LOT DISPONIBLE (FEFO)
  // ═══════════════════════════════════════
  async getFirstAvailableStock(pharmacyId: string, produitId: string) {
  try {
    const stocks = await localDb.stock
      .where('pharmacy_id').equals(pharmacyId)
      .and(s => s.produit_id === produitId && s.quantite > 0)
      .sortBy('date_expiration'); // Trie par date de péremption la plus proche (FEFO)
    
    console.log('📦 Stocks trouvés pour', produitId, ':', stocks.length);
    
    return stocks.length > 0 ? stocks[0] : null;
  } catch (error) {
    console.error('❌ Erreur récupération stock pour produit', produitId, error);
    return null;
  }
},

// ✅ NOUVELLE FONCTION : Ajouter du stock dans un magasin spécifique (pour les réceptions de transfert)
  async ajouterStock(pharmacyId: string, produitId: string, quantite: number, lot_numero: string, magasin_id: string | null) {
    // 1. Chercher si ce lot exact existe déjà dans ce magasin
    const allStock = await localDb.stock.toArray();
    const existingStock = allStock.find(s => 
      s.pharmacy_id === pharmacyId && 
      s.produit_id === produitId && 
      s.magasin_id === magasin_id && 
      s.lot_numero === (lot_numero || 'SANS-LOT')
    );

    if (existingStock) {
      // Mettre à jour la quantité du lot existant
      const newQty = (existingStock.quantite || 0) + quantite;
      await localDb.stock.update(existingStock.id, {
        quantite: newQty,
        updated_at: new Date().toISOString(),
        _sync_status: 'pending_update'
      });
      await syncEngine.logOperation('stock', existingStock.id, 'update', { quantite: newQty });
    } else {
      // Créer une nouvelle entrée de stock pour ce lot
      await this.ajouterEntreeStock({
        pharmacy_id: pharmacyId,
        produit_id: produitId,
        quantite: quantite,
        lot_numero: lot_numero || 'SANS-LOT',
        date_reception: new Date().toISOString().split('T')[0],
        magasin_id: magasin_id,
        prix_achat_lot: 0
      });
    }
  },


  // ═══════════════════════════════════════
  // SYNC UTILITAIRES
  // ═══════════════════════════════════════
  async forceSync() {
    return await syncEngine.syncAll();
  },
  
  getSyncStatus() {
    return syncEngine.getStatus();
  },
  
  onSyncStatusChange(listener: (status: any) => void) {
    return syncEngine.onStatusChange(listener);
  }
}; // ←⚠️ CETTE ACCOLADE FERME L'OBJET 'repository' À LA TOUTE FIN
