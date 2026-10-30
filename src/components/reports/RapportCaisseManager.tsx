// src/components/reports/RapportCaisseManager.tsx
import { useState, useEffect, useMemo } from 'react';
import { 
  Banknote, Smartphone, CreditCard, FileText, Download, 
  TrendingUp, AlertCircle, Calendar, DollarSign, ShoppingBag 
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { localDb } from '../../lib/localDb';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Palette de couleurs cohérente avec le design
const COLORS = {
  emerald: '#10b981',
  blue: '#3b82f6',
  orange: '#f97316',
  purple: '#a855f7',
  gray: '#6b7280',
  red: '#ef4444',
};

export function RapportCaisseManager() {
  const { utilisateur } = useAuth();
  const [dateDebut, setDateDebut] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7); // Par défaut : 7 derniers jours
    return d.toISOString().split('T')[0];
  });
  const [dateFin, setDateFin] = useState(new Date().toISOString().split('T')[0]);
  const [ventes, setVentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    chargerRapport();
  }, [dateDebut, dateFin]);

  const chargerRapport = async () => {
    setLoading(true);
    try {
      const toutesVentes = await localDb.ventes.where('statut').equals('payee').toArray();
      const filtre = toutesVentes.filter(v => v.date_vente >= dateDebut && v.date_vente <= dateFin);
      setVentes(filtre);
    } catch (error) {
      console.error('Erreur chargement rapport:', error);
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════
  // CALCULS DES KPIs
  // ══════════════════════════════════════
  const totalVentes = ventes.reduce((sum, v) => sum + (v.montant_total || 0), 0);
  const totalEspece = ventes.filter(v => v.type_paiement === 'especes').reduce((sum, v) => sum + (v.montant_percu || 0), 0);
  const totalMobile = ventes.filter(v => v.type_paiement === 'mobile_money').reduce((sum, v) => sum + (v.montant_percu || 0), 0);
  const totalCarte = ventes.filter(v => v.type_paiement === 'carte').reduce((sum, v) => sum + (v.montant_percu || 0), 0);
  const totalCheque = ventes.filter(v => v.type_paiement === 'cheque').reduce((sum, v) => sum + (v.montant_percu || 0), 0);
  const nombreTransactions = ventes.length;
  const panierMoyen = nombreTransactions > 0 ? totalVentes / nombreTransactions : 0;

  // ═══════════════════════════════════════
  // DONNÉES POUR LES GRAPHIQUES
  // ═══════════════════════════════════════
  
  // 1. Répartition par mode de paiement (Camembert)
  const dataModesPaiement = useMemo(() => [
    { name: 'Espèces', value: totalEspece, color: COLORS.blue },
    { name: 'Mobile Money', value: totalMobile, color: COLORS.orange },
    { name: 'Carte', value: totalCarte, color: COLORS.purple },
    { name: 'Chèque', value: totalCheque, color: COLORS.gray },
  ].filter(d => d.value > 0), [totalEspece, totalMobile, totalCarte, totalCheque]);

  // 2. Évolution du CA par jour (Barres)
  const dataEvolutionCA = useMemo(() => {
    const parJour: Record<string, number> = {};
    ventes.forEach(v => {
      const jour = v.date_vente;
      parJour[jour] = (parJour[jour] || 0) + (v.montant_total || 0);
    });
    return Object.entries(parJour)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({
        date: new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        CA: total,
        transactions: ventes.filter(v => v.date_vente === date).length
      }));
  }, [ventes]);

  // ═══════════════════════════════════════
  // EXPORT PDF
  // ══════════════════════════════════════
  const exporterPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(16, 185, 129);
    doc.text('RAPPORT DE CAISSE', 105, 20, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Période : du ${dateDebut} au ${dateFin}`, 14, 35);
    doc.text(`Caissier : ${utilisateur?.nom_complet || 'Tous'}`, 14, 42);
    doc.text(`Chiffre d'affaires : ${totalVentes.toLocaleString('fr-FR')} F`, 14, 49);
    doc.text(`Nombre de transactions : ${nombreTransactions}`, 14, 56);

    (doc as any).autoTable({
      startY: 65,
      head: [['Date', 'N° Vente', 'Client', 'Mode', 'Total', 'Perçu', 'Monnaie']],
      body: ventes.map(v => [
        v.date_vente,
        v.numero_vente,
        'Comptoir',
        (v.type_paiement || 'especes').toUpperCase(),
        `${(v.montant_total || 0).toLocaleString('fr-FR')} F`,
        `${(v.montant_percu || 0).toLocaleString('fr-FR')} F`,
        `${(v.monnaie_rendue || 0).toLocaleString('fr-FR')} F`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: 255 },
      foot: [['', '', '', 'TOTAL', '', `${totalVentes.toLocaleString('fr-FR')} F`, '']],
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }
    });

    doc.save(`Rapport_Caisse_${dateDebut}_au_${dateFin}.pdf`);
  };

  // ═══════════════════════════════════════
  // COMPOSANTS UI
  // ═══════════════════════════════════════
  const KPICard = ({ title, value, icon: Icon, colorClass, bgClass, subtitle }: any) => (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className={`text-2xl font-bold ${colorClass}`}>{value.toLocaleString('fr-FR')} F</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${bgClass}`}>
          <Icon className={`w-6 h-6 ${colorClass}`} />
        </div>
      </div>
    </div>
  );

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: <span className="font-bold">{Number(entry.value).toLocaleString('fr-FR')} F</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* En-tête avec Filtres */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Rapports de Caisse</h2>
          <p className="text-gray-500 text-sm">Analyse détaillée des encaissements par période</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none" />
            <span className="text-gray-400">→</span>
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none" />
          </div>
          <button onClick={exporterPDF} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shadow-sm font-medium text-sm">
            <Download className="w-4 h-4" /> Exporter PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div></div>
      ) : ventes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune vente sur cette période</h3>
          <p className="text-gray-500">Modifiez les dates pour voir les données.</p>
        </div>
      ) : (
        <>
          {/* KPIs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <KPICard title="Chiffre d'Affaires" value={totalVentes} icon={TrendingUp} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
            <KPICard title="Espèces" value={totalEspece} icon={Banknote} colorClass="text-blue-600" bgClass="bg-blue-50" />
            <KPICard title="Mobile Money" value={totalMobile} icon={Smartphone} colorClass="text-orange-600" bgClass="bg-orange-50" />
            <KPICard title="Carte" value={totalCarte} icon={CreditCard} colorClass="text-purple-600" bgClass="bg-purple-50" />
            <KPICard title="Chèques" value={totalCheque} icon={FileText} colorClass="text-gray-600" bgClass="bg-gray-100" />
            <KPICard title="Panier Moyen" value={panierMoyen} icon={ShoppingBag} colorClass="text-indigo-600" bgClass="bg-indigo-50" subtitle={`${nombreTransactions} transactions`} />
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* GRAPHIQUES */}
          {/* ═══════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Graphique 1 : Répartition des modes de paiement */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    Répartition par mode de paiement
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Part de chaque moyen de paiement</p>
                </div>
              </div>
              
              {dataModesPaiement.length === 0 ? (
                <div className="text-center py-12 text-gray-400">Aucune donnée</div>
              ) : (
                <div className="flex items-center">
                  <ResponsiveContainer width="50%" height={250}>
                    <PieChart>
                      <Pie
                        data={dataModesPaiement}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {dataModesPaiement.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Légende personnalisée */}
                  <div className="w-1/2 space-y-2">
                    {dataModesPaiement.map((entry, index) => {
                      const pourcentage = totalVentes > 0 ? ((entry.value / totalVentes) * 100).toFixed(1) : 0;
                      return (
                        <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                            <span className="text-sm font-medium text-gray-700">{entry.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900">{pourcentage}%</p>
                            <p className="text-xs text-gray-500">{entry.value.toLocaleString('fr-FR')} F</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Graphique 2 : Évolution du CA par jour */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    Évolution du Chiffre d'Affaires
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Performance journalière</p>
                </div>
              </div>
              
              {dataEvolutionCA.length === 0 ? (
                <div className="text-center py-12 text-gray-400">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dataEvolutionCA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="CA" 
                      stroke={COLORS.emerald} 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorCA)" 
                      name="Chiffre d'Affaires"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Graphique 3 : Nombre de transactions par jour */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-emerald-600" />
                    Nombre de Transactions par Jour
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Fréquence d'activité de la caisse</p>
                </div>
              </div>
              
              {dataEvolutionCA.length === 0 ? (
                <div className="text-center py-12 text-gray-400">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dataEvolutionCA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="transactions" 
                      fill={COLORS.blue} 
                      radius={[6, 6, 0, 0]}
                      name="Transactions"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* TABLEAU DÉTAILLÉ */}
          {/* ═══════════════════════════════════════ */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Détail des transactions ({nombreTransactions})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Date</th>
                    <th className="px-6 py-3 font-semibold">N° Vente</th>
                    <th className="px-6 py-3 font-semibold">Client</th>
                    <th className="px-6 py-3 font-semibold">Mode</th>
                    <th className="px-6 py-3 font-semibold text-right">Total</th>
                    <th className="px-6 py-3 font-semibold text-right">Perçu</th>
                    <th className="px-6 py-3 font-semibold text-right">Monnaie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ventes.map((vente) => {
                    const getBadgeColor = (mode: string) => {
                      switch(mode) {
                        case 'especes': return 'bg-blue-100 text-blue-700';
                        case 'mobile_money': return 'bg-orange-100 text-orange-700';
                        case 'carte': return 'bg-purple-100 text-purple-700';
                        case 'cheque': return 'bg-gray-100 text-gray-700';
                        default: return 'bg-gray-100 text-gray-700';
                      }
                    };
                    return (
                      <tr key={vente.id} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="px-6 py-4 text-gray-900 font-medium">{vente.date_vente}</td>
                        <td className="px-6 py-4 text-gray-600 font-mono text-xs">{vente.numero_vente}</td>
                        <td className="px-6 py-4 text-gray-600">Comptoir</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${getBadgeColor(vente.type_paiement)}`}>
                            {vente.type_paiement?.replace('_', ' ') || 'Espèces'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-gray-900">{(vente.montant_total || 0).toLocaleString('fr-FR')} F</td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-600">{(vente.montant_percu || 0).toLocaleString('fr-FR')} F</td>
                        <td className="px-6 py-4 text-right text-gray-500">{(vente.monnaie_rendue || 0).toLocaleString('fr-FR')} F</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
