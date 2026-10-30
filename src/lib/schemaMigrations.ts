const CURRENT_SCHEMA_VERSION = 5; // Incrémentez à chaque changement

export async function ensureSchemaUpToDate() {
  const localVersion = await localDb.schemaVersion.get('current');
  
  if (!localVersion || localVersion.version < CURRENT_SCHEMA_VERSION) {
    console.log(`🔄 Migration du schéma: ${localVersion?.version || 0} → ${CURRENT_SCHEMA_VERSION}`);
    
    // Exemple de migration
    if (!localVersion || localVersion.version < 2) {
      await localDb.sync_log.toCollection().modify(record => {
        if (record.retry_count === undefined) record.retry_count = 0;
      });
    }
    
    if (localVersion?.version < 3) {
      // Ajouter un index sur status pour les requêtes rapides
      await localDb.sync_log.createIndex('status');
    }
    
    await localDb.schemaVersion.put({ version: CURRENT_SCHEMA_VERSION, updated_at: new Date() });
    console.log('✅ Migration terminée');
  }
}

// Appeler au démarrage de l'app
await ensureSchemaUpToDate();