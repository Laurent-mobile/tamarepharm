export async function runSyncHealthCheck() {
  const results = {
    schemaValid: true,
    noOrphanRecords: true,
    noNegativeStock: true,
    syncWorking: true
  };

  // Test 1: Schéma cohérent
  const ventes = await localDb.ventes.toArray();
  for (const vente of ventes) {
    if (!vente.pharmacy_id || !vente.numero_vente) {
      results.schemaValid = false;
      console.error('❌ Vente invalide:', vente.id);
    }
  }

  // Test 2: Pas de lignes orphelines
  const lignes = await localDb.vente_lignes.toArray();
  for (const ligne of lignes) {
    const vente = await localDb.ventes.get(ligne.vente_id);
    if (!vente) {
      results.noOrphanRecords = false;
      console.error(' Ligne orpheline:', ligne.id);
    }
  }

  // Test 3: Pas de stock négatif
  const stock = await localDb.stock.toArray();
  for (const item of stock) {
    if (item.quantite < 0) {
      results.noNegativeStock = false;
      console.error('❌ Stock négatif:', item.produit_id);
    }
  }

  // Test 4: Sync fonctionne
  try {
    await supabase.from('produits').select('id').limit(1);
  } catch (e) {
    results.syncWorking = false;
  }

  return results;
}

// Exécuter au démarrage
const health = await runSyncHealthCheck();
if (!health.schemaValid || !health.syncWorking) {
  console.error('🚨 Problèmes de santé détectés!', health);
}
