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
    const vente = { ...data, id: venteId, created_at: now, updated_at: now, _sync_status: 'pending_create' as const };
    await localDb.ventes.add(vente);
    await syncEngine.logOperation('ventes', venteId, 'create', vente);
    for (const ligne of lignes) {
      const ligneId = ligne.id || uuidv4();
      const venteLigne = { ...ligne, id: ligneId, pharmacy_id: data.pharmacy_id, vente_id: venteId, _sync_status: 'pending_create' as const };
      await localDb.vente_lignes.add(venteLigne);
      await syncEngine.logOperation('vente_lignes', ligneId, 'create', venteLigne);
      await this.decrementerStock(data.pharmacy_id, ligne.produit_id, ligne.quantite, ligne.lot);
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
  async decrementerStock(pharmacyId: string, produitId: string, quantite: number, lot?: string) {
    const stockItems = await localDb.stock.where('pharmacy_id').equals(pharmacyId).and(s => s.produit_id === produitId && s.quantite > 0).sortBy('date_expiration');
    let resteADeduire = quantite;
    for (const item of stockItems) {
      if (resteADeduire <= 0) break;
      const deduction = Math.min(item.quantite, resteADeduire);
      const nouvelleQuantite = item.quantite - deduction;
      await localDb.stock.update(item.id, { quantite: nouvelleQuantite, updated_at: new Date().toISOString(), _sync_status: 'pending_update' });
      await syncEngine.logOperation('stock', item.id, 'update', { id: item.id, quantite: nouvelleQuantite, updated_at: new Date().toISOString() });
      resteADeduire -= deduction;
    }
    if (resteADeduire > 0) console.warn(`⚠️ Stock insuffisant pour produit ${produitId}: manque ${resteADeduire}`);
  },

  // ═══════════════════════════════════════
  // FOURNISSEURS & COMMANDES (Version unique et nettoyée)
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
          const produit = await localDb.produits.get(ligne.produit_id);
          (ligne as any).produits = produit;
        }
        (commande as any).commande_fournisseur_lignes = lignes;
        if (commande.fournisseur_id) {
          (commande as any).fournisseurs = await localDb.fournisseurs.get(commande.fournisseur_id);
        }
        if ((commande as any).proforma_id) {
          (commande as any).demandes_proforma = await localDb.demandes_proforma.get((commande as any).proforma_id);
        }
      }
      console.log('✅ Commandes chargées et enrichies depuis le cache local:', commandes.length);
      return commandes;
    } catch (error) {
      console.error('❌ Erreur chargement local commandes:', error);
      return [];
    }
  },

  async getProformas(pharmacyId: string) {
    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('demandes_proforma')
          .select(`*, fournisseurs(*), demandes_proforma_lignes(*, produits(*)), utilisateurs(*)`)
          .eq('pharmacy_id', pharmacyId)
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
          console.log('✅ Proformas chargés et mis en cache depuis Supabase:', data.length);
          return data;
        }
      } catch (error) {
        console.error('❌ Erreur Supabase proformas:', error);
      }
    }

    try {
      const proformas = await localDb.demandes_proforma.where('pharmacy_id').equals(pharmacyId).reverse().sortBy('date_demande');
      for (const proforma of proformas) {
        const lignes = await localDb.demandes_proforma_lignes.where('demande_id').equals(proforma.id).toArray();
        for (const ligne of lignes) {
          const produit = await localDb.produits.get(ligne.produit_id);
          (ligne as any).produits = produit;
        }
        (proforma as any).demandes_proforma_lignes = lignes;
        if (proforma.fournisseur_id) {
          (proforma as any).fournisseurs = await localDb.fournisseurs.get(proforma.fournisseur_id);
        }
      }
      console.log('✅ Proformas chargés et enrichis depuis le cache local:', proformas.length);
      return proformas;
    } catch (error) {
      console.error('❌ Erreur chargement local proformas:', error);
      return [];
    }
  },

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
          const produit = await localDb.produits.get(ligne.produit_id);
          (ligne as any).produits = produit;
        }
        (reception as any).reception_lignes = lignes;
        if (reception.commande_id) {
          const commande = await localDb.commandes.get(reception.commande_id);
          if (commande) {
            (reception as any).commandes_fournisseurs = {
              numero_commande: commande.numero_commande,
              fournisseurs: await localDb.fournisseurs.get(commande.fournisseur_id)
            };
          }
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
  },
};
