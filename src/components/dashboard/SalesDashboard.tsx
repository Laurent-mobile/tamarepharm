// components/dashboard/SalesDashboard.tsx
import { useState, useEffect } from 'react';
import { ShoppingCart, DollarSign, Users, Package, TrendingUp, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface SalesStats {
  totalVentes: number;
  chiffreAffaire: number;
  clientsServis: number;
  produitsVendus: number;
  evolutionMensuelle: number;
  ventesMoisCourant: number;
  ventesMoisPrecedent: number;
}

export function SalesDashboard() {
  const { utilisateur } = useAuth();
  const [stats, setStats] = useState<SalesStats>({
    totalVentes: 0,
    chiffreAffaire: 0,
    clientsServis: 0,
    produitsVendus: 0,
    evolutionMensuelle: 0,
    ventesMoisCourant: 0,
    ventesMoisPrecedent: 0
  });
  const [loading, setLoading] = useState(true);
  const [dateDebut, setDateDebut] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [dateFin, setDateFin] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (utilisateur) {
      loadSalesStats();
    }
  }, [utilisateur, dateDebut, dateFin]);

  const loadSalesStats = async () => {
    try {
      // Statistiques de base
      const { data: ventes, error } = await supabase
  .from('ventes')
  .select(`
    *,
    vente_lignes(*, produits(nom)),
    clients(*)
  `)
  .eq('pharmacy_id', utilisateur!.pharmacy_id)
  .gte('date_vente', dateDebut)
  .lte('date_vente', dateFin)
  .eq('statut', 'payee');

      if (error) throw error;

      // Calcul des statistiques
      const totalVentes = ventes?.length || 0;
      const chiffreAffaire = ventes?.reduce((sum, vente) => sum + Number(vente.montant_total), 0) || 0;
      const clientsServis = new Set(ventes?.filter(v => v.client_id).map(v => v.client_id)).size;
      const produitsVendus = ventes?.reduce((sum, vente) => 
        sum + (vente.vente_lignes?.reduce((ligneSum, ligne) => ligneSum + ligne.quantite, 0) || 0), 0) || 0;

      // Calcul évolution mensuelle
      const maintenant = new Date();
      const moisCourantDebut = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
      const moisPrecedentDebut = new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, 1);
      const moisPrecedentFin = new Date(maintenant.getFullYear(), maintenant.getMonth(), 0);

      const [ventesMoisCourant, ventesMoisPrecedent] = await Promise.all([
        getVentesPeriode(moisCourantDebut.toISOString().split('T')[0], maintenant.toISOString().split('T')[0]),
        getVentesPeriode(moisPrecedentDebut.toISOString().split('T')[0], moisPrecedentFin.toISOString().split('T')[0])
      ]);

      const evolutionMensuelle = ventesMoisPrecedent > 0 
        ? ((ventesMoisCourant - ventesMoisPrecedent) / ventesMoisPrecedent) * 100 
        : ventesMoisCourant > 0 ? 100 : 0;

      setStats({
        totalVentes,
        chiffreAffaire,
        clientsServis,
        produitsVendus,
        evolutionMensuelle,
        ventesMoisCourant,
        ventesMoisPrecedent
      });
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVentesPeriode = async (debut: string, fin: string) => {
    const { count, error } = await supabase
      .from('ventes')
      .select('*', { count: 'exact', head: true })
      .eq('pharmacy_id', utilisateur!.pharmacy_id)
      .eq('statut', 'payee')
      .gte('date_vente', debut)
      .lte('date_vente', fin);

    return error ? 0 : count || 0;
  };

  const StatCard = ({ title, value, icon: Icon, subtitle, trend }: any) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              trend >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              <TrendingUp className={`w-4 h-4 ${trend < 0 ? 'rotate-180' : ''}`} />
              <span>{Math.abs(trend).toFixed(1)}%</span>
            </div>
          )}
        </div>
        <div className="p-3 bg-emerald-50 rounded-lg">
          <Icon className="w-6 h-6 text-emerald-600" />
        </div>
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Tableau de Bord des Ventes</h2>
          <p className="text-gray-600 mt-1">Vue d'ensemble des performances commerciales</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-gray-500">à</span>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Ventes"
          value={stats.totalVentes}
          subtitle="Période sélectionnée"
          icon={ShoppingCart}
        />
        <StatCard
          title="Chiffre d'Affaire"
          value={`${stats.chiffreAffaire.toLocaleString('fr-FR')} F`}
          subtitle="Montant total"
          icon={DollarSign}
        />
        <StatCard
          title="Clients Servis"
          value={stats.clientsServis}
          subtitle="Clients uniques"
          icon={Users}
        />
        <StatCard
          title="Produits Vendus"
          value={stats.produitsVendus}
          subtitle="Quantité totale"
          trend={stats.evolutionMensuelle}
          icon={Package}
        />
      </div>

      {/* Dernières ventes */}
      <RecentSales />
    </div>
  );
}

// Composant pour afficher les ventes récentes
function RecentSales() {
  const { utilisateur } = useAuth();
  const [ventesRecentes, setVentesRecentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (utilisateur) {
      loadRecentSales();
    }
  }, [utilisateur]);

  const loadRecentSales = async () => {
    try {
      const { data, error } = await supabase
        .from('ventes')
        .select(`
          *,
          clients(nom_complet),
          vente_lignes(*, produits(nom))
        `)
        .eq('pharmacy_id', utilisateur!.pharmacy_id)
        .eq('statut', 'payee')
        .order('date_vente', { ascending: false })
        .limit(10);

      if (error) throw error;
      setVentesRecentes(data || []);
    } catch (error) {
      console.error('Erreur chargement ventes récentes:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTicket = async (vente: any) => {
    try {
      const ticketWindow = window.open('', '_blank');
      if (!ticketWindow) {
        alert('Veuillez autoriser les pop-ups pour générer le ticket');
        return;
      }

      const ticketContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ticket de Caisse - ${vente.numero_vente}</title>
            <style>
                body { 
                    font-family: 'Courier New', monospace; 
                    font-size: 12px; 
                    max-width: 300px; 
                    margin: 0 auto; 
                    padding: 10px;
                }
                .header { text-align: center; margin-bottom: 15px; }
                .pharmacy-name { font-weight: bold; font-size: 14px; }
                .ticket-info { margin: 10px 0; }
                .items { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; }
                .item { display: flex; justify-content: space-between; margin: 5px 0; }
                .total { font-weight: bold; font-size: 14px; text-align: right; margin-top: 10px; }
                .footer { text-align: center; margin-top: 15px; font-size: 10px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="pharmacy-name">PHARMACIE BURKINA</div>
                <div>Ouagadougou, Burkina Faso</div>
                <div>+226 25 30 00 00</div>
            </div>
            
            <div class="ticket-info">
                <div>Ticket: ${vente.numero_vente}</div>
                <div>Date: ${new Date(vente.date_vente).toLocaleString('fr-FR')}</div>
                <div>Client: ${vente.clients?.nom_complet || 'Non enregistré'}</div>
                <div>Caissier: ${utilisateur?.nom_complet}</div>
            </div>
            
            <div class="items">
                ${vente.vente_lignes?.map((ligne: any) => `
                    <div class="item">
                        <div>${ligne.produits.nom}</div>
                        <div>${ligne.quantite} x ${ligne.prix_unitaire}F</div>
                    </div>
                    <div class="item" style="font-size: 10px;">
                        <div>Sous-total</div>
                        <div>${(ligne.quantite * ligne.prix_unitaire).toLocaleString('fr-FR')} F</div>
                    </div>
                `).join('')}
            </div>
            
            <div class="total">
                TOTAL: ${Number(vente.montant_total).toLocaleString('fr-FR')} F
            </div>
            
            <div class="footer">
                <div>Merci de votre visite !</div>
                <div>*** ${new Date().toLocaleDateString('fr-FR')} ***</div>
            </div>
        </body>
        </html>
      `;

      ticketWindow.document.write(ticketContent);
      ticketWindow.document.close();
      
      // Attendre que le contenu soit chargé avant d'imprimer
      setTimeout(() => {
        ticketWindow.print();
      }, 500);
    } catch (error) {
      console.error('Erreur génération ticket:', error);
      alert('Erreur lors de la génération du ticket');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Ventes Récentes</h3>
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900">Ventes Récentes</h3>
        <span className="text-sm text-gray-500">10 dernières ventes</span>
      </div>

      <div className="space-y-4">
        {ventesRecentes.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucune vente récente</p>
        ) : (
          ventesRecentes.map((vente) => (
            <div key={vente.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-100 p-2 rounded-lg">
                    <ShoppingCart className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-bold">{vente.numero_vente}</p>
                    <p className="text-sm text-gray-600">
                      {vente.clients?.nom_complet || 'Client non enregistré'} • 
                      {new Date(vente.date_vente).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <p className="font-bold text-lg">{Number(vente.montant_total).toLocaleString('fr-FR')} F</p>
                <p className="text-sm text-gray-600">
                  {vente.vente_lignes?.length || 0} produit(s)
                </p>
              </div>

              <div className="ml-4">
                <button
                  onClick={() => generateTicket(vente)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                >
                  Ticket
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
