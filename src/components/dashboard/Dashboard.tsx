// src/components/dashboard/Dashboard.tsx
import { Package, ShoppingCart, Truck, ClipboardList, AlertTriangle, TrendingUp, DollarSign, Calendar, BarChart3, PieChart, Warehouse, ArrowLeftRight } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CAChart } from './CAChart';
import { VentesRecentees } from './VentesRecentees';
import { ProduitsPlusVendusChart } from './ProduitsPlusVendusChart';
import { RepartitionStockChart } from './RepartitionStockChart';

interface MagasinStats {
  id: string;
  nom: string;
  code: string;
  total_stock: number;
  nombre_produits: number;
  valeur_stock: number;
  capacite_utilisation: number;
}

export function Dashboard() {
  const { utilisateur, dataVersion } = useAuth();
  const [stats, setStats] = useState({
    commandesEnAttente: 0,
    inventairesEnCours: 0,
    stockBas: 0,
    produitsExpires: 0,
    chiffreAffaireMois: 0,
    chiffreAffaireSemaine: 0,
    chiffreAffaireJour: 0,
    evolutionMensuelle: 0,
    clientsServis: 0,
    produitsVendus: 0
  });
  const [magasinsStats, setMagasinsStats] = useState<MagasinStats[]>([]);
  const [totalMagasins, setTotalMagasins] = useState(0);
  const [transfertsEnCours, setTransfertsEnCours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [periode, setPeriode] = useState<'jour' | 'semaine' | 'mois'>('jour');
  const [donneesGraphique, setDonneesGraphique] = useState<any[]>([]);
  const [produitsPlusVendus, setProduitsPlusVendus] = useState<any[]>([]);
  const [repartitionStock, setRepartitionStock] = useState<any[]>([]);

  useEffect(() => {
    if (utilisateur) {
      loadDashboardStats();
      loadMagasinsData();
      loadTransfertsData();
    }
  }, [utilisateur, periode, dataVersion]);

  const loadDashboardStats = useCallback(async () => {
    if (!utilisateur?.pharmacy_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const [
        commandesEnAttente,
        inventairesEnCours,
        stockBas,
        produitsExpires,
        chiffreAffaireEvolution,
        donneesCA,
        produitsVendusData,
        repartitionStockData
      ] = await Promise.all([
        supabase.from('commandes_fournisseurs').select('*', { count: 'exact', head: true }).eq('pharmacy_id', utilisateur.pharmacy_id).eq('statut', 'en_attente'),
        supabase.from('inventaires').select('*', { count: 'exact', head: true }).eq('pharmacy_id', utilisateur.pharmacy_id).eq('statut', 'en_cours'),
        supabase.from('stock').select('*', { count: 'exact', head: true }).eq('pharmacy_id', utilisateur.pharmacy_id).lt('quantite', 10),
        supabase.from('stock').select('*', { count: 'exact', head: true }).eq('pharmacy_id', utilisateur.pharmacy_id).lt('date_expiration', new Date().toISOString().split('T')[0]),
        calculerEvolutionMensuelle(utilisateur.pharmacy_id),
        chargerDonneesGraphique(utilisateur.pharmacy_id, periode),
        chargerProduitsPlusVendus(utilisateur.pharmacy_id),
        chargerRepartitionStock(utilisateur.pharmacy_id)
      ]);

      setStats({
        commandesEnAttente: commandesEnAttente.count || 0,
        inventairesEnCours: inventairesEnCours.count || 0,
        stockBas: stockBas.count || 0,
        produitsExpires: produitsExpires.count || 0,
        chiffreAffaireMois: chiffreAffaireEvolution.chiffreAffaireMois,
        chiffreAffaireSemaine: chiffreAffaireEvolution.chiffreAffaireSemaine,
        chiffreAffaireJour: chiffreAffaireEvolution.chiffreAffaireJour,
        evolutionMensuelle: chiffreAffaireEvolution.evolution,
        clientsServis: chiffreAffaireEvolution.clientsServis,
        produitsVendus: chiffreAffaireEvolution.produitsVendus
      });

      setDonneesGraphique(donneesCA);
      setProduitsPlusVendus(produitsVendusData);
      setRepartitionStock(repartitionStockData);
    } catch (error) {
      console.error('Erreur chargement stats dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [utilisateur?.pharmacy_id, periode]);

  const loadMagasinsData = async () => {
    if (!utilisateur?.pharmacy_id) return;

    try {
      const { data: magasins, error: magasinsError } = await supabase
        .from('magasins')
        .select('*')
        .eq('pharmacie_principale_id', utilisateur.pharmacy_id)
        .eq('actif', true);

      if (magasinsError) throw magasinsError;
      setTotalMagasins(magasins?.length || 0);

      const magasinsStatsData: MagasinStats[] = [];
      for (const magasin of magasins || []) {
        const { data: stock, error: stockError } = await supabase
          .from('stock')
          .select(`quantite, produits (prix_vente)`)
          .eq('magasin_id', magasin.id)
          .eq('statut', 'actif');

        if (stockError) throw stockError;

        const totalStock = stock?.reduce((sum, s) => sum + (s.quantite || 0), 0) || 0;
        const nombreProduits = new Set(stock?.map(s => s.produit_id)).size;
        const valeurStock = stock?.reduce((sum, s) => sum + ((s.quantite || 0) * (s.produits?.prix_vente || 0)), 0) || 0;
        const capaciteUtilisation = magasin.capacite_stock > 0 ? (totalStock / magasin.capacite_stock) * 100 : 0;

        magasinsStatsData.push({
          id: magasin.id,
          nom: magasin.nom,
          code: magasin.code,
          total_stock: totalStock,
          nombre_produits: nombreProduits,
          valeur_stock: valeurStock,
          capacite_utilisation: capaciteUtilisation
        });
      }
      setMagasinsStats(magasinsStatsData);
    } catch (error) {
      console.error('Erreur chargement données magasins:', error);
    }
  };

  // ✅ CORRECTION CRITIQUE : Utilisation de .or() pour les deux colonnes de pharmacie
  const loadTransfertsData = async () => {
    if (!utilisateur?.pharmacy_id) return;

    try {
      const { data, error } = await supabase
        .from('transferts')
        .select('*')
        .or(`pharmacy_source_id.eq.${utilisateur.pharmacy_id},pharmacy_destination_id.eq.${utilisateur.pharmacy_id}`)
        .in('statut', ['en_attente', 'en_transit']);

      if (error) throw error;
      setTransfertsEnCours(data?.length || 0);
    } catch (error) {
      console.error('Erreur chargement transferts:', error);
    }
  };

  const chargerProduitsPlusVendus = async (pharmacyId: string) => {
    try {
      const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const finMois = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

      const { data: ventesIds, error: ventesError } = await supabase
        .from('ventes')
        .select('id')
        .eq('pharmacy_id', pharmacyId)
        .eq('statut', 'payee')
        .gte('date_vente', debutMois.toISOString().split('T')[0])
        .lte('date_vente', finMois.toISOString().split('T')[0]);

      if (ventesError || !ventesIds || ventesIds.length === 0) return [];

      const { data: lignesVentes, error: lignesError } = await supabase
        .from('vente_lignes')
        .select(`quantite, produits (nom, code_produit)`)
        .in('vente_id', ventesIds.map(v => v.id));

      if (lignesError) throw lignesError;

      const produitsMap = new Map();
      lignesVentes?.forEach(ligne => {
        const produit = ligne.produits;
        if (produit) {
          const quantite = ligne.quantite || 0;
          produitsMap.set(produit.nom, (produitsMap.get(produit.nom) || 0) + quantite);
        }
      });

      return Array.from(produitsMap, ([nom, quantite]) => ({ nom, quantite }))
        .sort((a, b) => b.quantite - a.quantite).slice(0, 10);
    } catch (error) {
      console.error('Erreur chargement produits plus vendus:', error);
      return [];
    }
  };

  const chargerRepartitionStock = async (pharmacyId: string) => {
    try {
      const { data, error } = await supabase
        .from('stock')
        .select(`quantite, produits (nom, code_produit)`)
        .eq('pharmacy_id', pharmacyId)
        .gt('quantite', 0);

      if (error) throw error;

      const stockMap = new Map();
      data?.forEach(item => {
        const produit = item.produits;
        if (produit) {
          const quantite = item.quantite || 0;
          stockMap.set(produit.nom, (stockMap.get(produit.nom) || 0) + quantite);
        }
      });

      return Array.from(stockMap, ([nom, quantite]) => ({ nom, quantite }))
        .sort((a, b) => b.quantite - a.quantite).slice(0, 15);
    } catch (error) {
      console.error('Erreur chargement répartition stock:', error);
      return [];
    }
  };

  const calculerEvolutionMensuelle = async (pharmacyId: string) => {
    try {
      const maintenant = new Date();
      const moisCourantDebut = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
      const moisPrecedentDebut = new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, 1);
      const moisPrecedentFin = new Date(maintenant.getFullYear(), maintenant.getMonth(), 0);
      const aujourdhui = new Date().toISOString().split('T')[0];
      
      const debutSemaine = new Date();
      debutSemaine.setDate(debutSemaine.getDate() - debutSemaine.getDay() + 1);
      const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);

      const [ventesMoisCourant, ventesMoisPrecedent, ventesSemaine, ventesJour, clientsData] = await Promise.all([
        supabase.from('ventes').select('montant_total, vente_lignes(quantite)').eq('pharmacy_id', pharmacyId).eq('statut', 'payee').gte('date_vente', moisCourantDebut.toISOString().split('T')[0]).lte('date_vente', aujourdhui),
        supabase.from('ventes').select('montant_total').eq('pharmacy_id', pharmacyId).eq('statut', 'payee').gte('date_vente', moisPrecedentDebut.toISOString().split('T')[0]).lte('date_vente', moisPrecedentFin.toISOString().split('T')[0]),
        supabase.from('ventes').select('montant_total, vente_lignes(quantite)').eq('pharmacy_id', pharmacyId).eq('statut', 'payee').gte('date_vente', debutSemaine.toISOString().split('T')[0]).lte('date_vente', aujourdhui),
        supabase.from('ventes').select('montant_total, vente_lignes(quantite)').eq('pharmacy_id', pharmacyId).eq('statut', 'payee').eq('date_vente', aujourdhui),
        supabase.from('ventes').select('client_id').eq('pharmacy_id', pharmacyId).eq('statut', 'payee').gte('date_vente', debutMois.toISOString().split('T')[0]).lte('date_vente', aujourdhui)
      ]);

      const caMoisCourant = ventesMoisCourant?.data?.reduce((sum, vente) => sum + Number(vente.montant_total), 0) || 0;
      const caMoisPrecedent = ventesMoisPrecedent?.data?.reduce((sum, vente) => sum + Number(vente.montant_total), 0) || 0;
      const caSemaine = ventesSemaine?.data?.reduce((sum, vente) => sum + Number(vente.montant_total), 0) || 0;
      const caJour = ventesJour?.data?.reduce((sum, vente) => sum + Number(vente.montant_total), 0) || 0;

      const produitsVendusMois = ventesMoisCourant?.data?.reduce((sum, vente) => 
        sum + (vente.vente_lignes?.reduce((ligneSum: number, ligne: any) => ligneSum + ligne.quantite, 0) || 0), 0) || 0;

      const clientsUniques = new Set(clientsData?.data?.filter(v => v.client_id).map(v => v.client_id)).size;
      const evolution = caMoisPrecedent > 0 ? ((caMoisCourant - caMoisPrecedent) / caMoisPrecedent) * 100 : (caMoisCourant > 0 ? 100 : 0);

      return {
        chiffreAffaireMois: caMoisCourant,
        chiffreAffaireSemaine: caSemaine,
        chiffreAffaireJour: caJour,
        evolution: Math.round(evolution * 100) / 100,
        clientsServis: clientsUniques,
        produitsVendus: produitsVendusMois
      };
    } catch (error) {
      console.error('Erreur calcul évolution:', error);
      return { chiffreAffaireMois: 0, chiffreAffaireSemaine: 0, chiffreAffaireJour: 0, evolution: 0, clientsServis: 0, produitsVendus: 0 };
    }
  };

  const chargerDonneesGraphique = async (pharmacyId: string, periode: 'jour' | 'semaine' | 'mois') => {
    try {
      let dateDebut = new Date();
      let groupBy: 'day' | 'week' | 'month' = 'day';

      if (periode === 'jour') { dateDebut.setDate(dateDebut.getDate() - 7); groupBy = 'day'; }
      else if (periode === 'semaine') { dateDebut.setDate(dateDebut.getDate() - 30); groupBy = 'week'; }
      else { dateDebut.setMonth(dateDebut.getMonth() - 6); groupBy = 'month'; }

      const { data: ventes, error } = await supabase
        .from('ventes')
        .select('montant_total, date_vente')
        .eq('pharmacy_id', pharmacyId)
        .eq('statut', 'payee')
        .gte('date_vente', dateDebut.toISOString().split('T')[0])
        .lte('date_vente', new Date().toISOString().split('T')[0])
        .order('date_vente', { ascending: true });

      if (error || !ventes || ventes.length === 0) return genererDonneesParDefaut(periode);

      const groupes: { [key: string]: number } = {};
      ventes.forEach(vente => {
        const date = new Date(vente.date_vente);
        let cle = '';
        if (groupBy === 'day') cle = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        else if (groupBy === 'week') {
          const ds = new Date(date); ds.setDate(date.getDate() - date.getDay());
          cle = `S${Math.ceil((ds.getDate() + 1) / 7)} ${ds.toLocaleDateString('fr-FR', { month: 'short' })}`;
        } else {
          cle = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        }
        groupes[cle] = (groupes[cle] || 0) + Number(vente.montant_total);
      });

      return Object.entries(groupes).map(([p, ca]) => ({ periode: p, chiffreAffaire: Math.round(ca) }));
    } catch (error) {
      console.error('Erreur chargement données graphique:', error);
      return genererDonneesParDefaut(periode);
    }
  };

  const genererDonneesParDefaut = (periode: 'jour' | 'semaine' | 'mois') => {
    const aujourdhui = new Date();
    const donnees = [];
    if (periode === 'jour') {
      for (let i = 6; i >= 0; i--) {
        const date = new Date(aujourdhui); date.setDate(date.getDate() - i);
        donnees.push({ periode: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), chiffreAffaire: 0 });
      }
    } else if (periode === 'semaine') {
      for (let i = 3; i >= 0; i--) {
        const date = new Date(aujourdhui); date.setDate(date.getDate() - (i * 7));
        donnees.push({ periode: `S${Math.ceil((date.getDate() + 1) / 7)} ${date.toLocaleDateString('fr-FR', { month: 'short' })}`, chiffreAffaire: 0 });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const date = new Date(aujourdhui); date.setMonth(date.getMonth() - i);
        donnees.push({ periode: date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), chiffreAffaire: 0 });
      }
    }
    return donnees;
  };

  const getChiffreAffaireActuel = () => {
    if (periode === 'jour') return stats.chiffreAffaireJour;
    if (periode === 'semaine') return stats.chiffreAffaireSemaine;
    return stats.chiffreAffaireMois;
  };

  const getLabelPeriode = () => {
    if (periode === 'jour') return "Aujourd'hui";
    if (periode === 'semaine') return 'Cette semaine';
    return 'Ce mois';
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle, trend, isCurrency = false }: any) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{isCurrency ? `${value.toLocaleString('fr-FR')} F` : value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp className={`w-4 h-4 ${trend < 0 ? 'rotate-180' : ''}`} />
              <span>{Math.abs(trend).toFixed(1)}%</span>
              <span className="text-gray-500 ml-1">{trend >= 0 ? 'hausse' : 'baisse'}</span>
            </div>
          )}
        </div>
        <div className={`p-3 ${color} rounded-lg`}><Icon className="w-6 h-6 text-white" /></div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Tableau de Bord</h2>
        <p className="text-gray-600 mt-1">Vue d'ensemble de la pharmacie et des magasins</p>
      </div>
      
      <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold">Chiffre d'Affaires</h3>
            <p className="text-emerald-100">{getLabelPeriode()}</p>
          </div>
          <div className="flex items-center gap-2 bg-white/20 rounded-lg p-1">
            {(['jour', 'semaine', 'mois'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriode(p)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition capitalize ${
                  periode === p ? 'bg-white text-emerald-600' : 'text-white hover:bg-white/10'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-4xl font-bold mb-2">{getChiffreAffaireActuel().toLocaleString('fr-FR')} F</p>
            <div className={`flex items-center gap-2 text-sm ${stats.evolutionMensuelle >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              <TrendingUp className={`w-4 h-4 ${stats.evolutionMensuelle < 0 ? 'rotate-180' : ''}`} />
              <span>{Math.abs(stats.evolutionMensuelle).toFixed(1)}%</span>
              <span>vs mois précédent</span>
            </div>
          </div>
          <div className="text-right">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><p className="text-emerald-200">Aujourd'hui</p><p className="font-bold">{stats.chiffreAffaireJour.toLocaleString('fr-FR')} F</p></div>
              <div><p className="text-emerald-200">Semaine</p><p className="font-bold">{stats.chiffreAffaireSemaine.toLocaleString('fr-FR')} F</p></div>
              <div><p className="text-emerald-200">Mois</p><p className="font-bold">{stats.chiffreAffaireMois.toLocaleString('fr-FR')} F</p></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Magasins" value={totalMagasins} icon={Warehouse} color="bg-blue-500" subtitle="Entrepôts actifs" />
        <StatCard title="Transferts en cours" value={transfertsEnCours} icon={ArrowLeftRight} color="bg-amber-500" subtitle="En attente ou en transit" />
        <StatCard title="Stock total magasins" value={magasinsStats.reduce((sum, m) => sum + m.total_stock, 0)} icon={Package} color="bg-purple-500" subtitle="Unités dans les entrepôts" />
      </div>

      {magasinsStats.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-blue-600" />
              État des Magasins
            </h3>
            <div className="text-sm text-gray-500">{magasinsStats.length} magasin(s) actif(s)</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {magasinsStats.map((magasin) => (
              <div key={magasin.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900">{magasin.nom}</p>
                    <p className="text-xs text-gray-500 font-mono">{magasin.code}</p>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    magasin.capacite_utilisation > 90 ? 'bg-red-100 text-red-700' :
                    magasin.capacite_utilisation > 70 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {magasin.capacite_utilisation.toFixed(0)}% utilisé
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Stock total:</span><span className="font-medium">{magasin.total_stock} unités</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Produits distincts:</span><span className="font-medium">{magasin.nombre_produits}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Valeur du stock:</span><span className="font-medium text-emerald-600">{magasin.valeur_stock.toLocaleString('fr-FR')} F</span></div>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${magasin.capacite_utilisation > 90 ? 'bg-red-500' : magasin.capacite_utilisation > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(magasin.capacite_utilisation, 100)}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-emerald-600" />Évolution du Chiffre d'Affaires</h3>
          </div>
          <div style={{ width: '100%', height: '350px', minHeight: '350px' }}>
            <CAChart data={donneesGraphique} periode={periode} height={320} />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-600" />Top 10 des Produits Vendus</h3>
            <div className="text-sm text-gray-500">Ce mois</div>
          </div>
          <div style={{ width: '100%', height: '350px', minHeight: '350px' }}>
            <ProduitsPlusVendusChart data={produitsPlusVendus} height={320} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><PieChart className="w-5 h-5 text-purple-600" />Répartition du Stock</h3>
          <div className="text-sm text-gray-500">Top 15 des produits en stock</div>
        </div>
        <div style={{ width: '100%', height: '400px', minHeight: '400px' }}>
          <RepartitionStockChart data={repartitionStock} height={370} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Chiffre d'Affaires" value={getChiffreAffaireActuel()} icon={DollarSign} color="bg-emerald-500" subtitle={getLabelPeriode()} trend={stats.evolutionMensuelle} isCurrency={true} />
        <StatCard title="Clients Servis" value={stats.clientsServis} icon={ShoppingCart} color="bg-blue-500" subtitle="Ce mois" />
        <StatCard title="Produits Vendus" value={stats.produitsVendus} icon={Package} color="bg-amber-500" subtitle="Ce mois" />
        <StatCard title="Stock Bas" value={stats.stockBas} icon={AlertTriangle} color="bg-orange-500" subtitle="À réapprovisionner" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Commandes en attente" value={stats.commandesEnAttente} icon={Truck} color="bg-blue-500" subtitle="À réceptionner" />
        <StatCard title="Inventaires en cours" value={stats.inventairesEnCours} icon={ClipboardList} color="bg-amber-500" subtitle="À finaliser" />
        <StatCard title="Produits expirés" value={stats.produitsExpires} icon={Package} color="bg-red-500" subtitle="À retirer" />
      </div>

      <VentesRecentees />
    </div>
  );
}
