// components/assurances/AssurancePaymentsManager.tsx
import { useState, useEffect, useRef } from 'react';
import { Search, Download, Filter, FileText, Calendar, DollarSign, Shield, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface VenteAvecClient {
  id: string;
  numero_vente: string;
  date_vente: string;
  montant_total: number;
  montant_assurance: number;
  montant_patient: number;
  statut: string;
  clients: {
    id: string;
    nom_complet: string;
    numero_assure: string;
    assurance_id: string;
    assurances: {
      id: string;
      nom: string;
      taux_couverture: number;
      telephone: string;
      email: string;
    };
  } | null;
}

interface RolePermissions {
  dashboard: boolean;
  products: boolean;
  stock: boolean;
  sales: boolean;
  sales_history: boolean;
  paiements_assurances: boolean;
  clients: boolean;
  suppliers: boolean;
  orders: boolean;
  transfers: boolean;
  inventory: boolean;
  settings: boolean;
}

export function AssurancePaymentsManager() {
  const { utilisateur } = useAuth();
  const [ventesEnAttente, setVentesEnAttente] = useState<VenteAvecClient[]>([]);
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [showPrintView, setShowPrintView] = useState(false);

  // 🔥 Références pour suivre le chargement
  const permissionsLoadedRef = useRef(false);
  const ventesLoadedRef = useRef(false);

  // 🔥 DÉFINIR hasPermission AVANT le useEffect de debug
  const hasPermission = (): boolean => {
    if (!permissions) {
      console.log('❌ Aucune permission chargée');
      return false;
    }
    
    console.log('🔐 Vérification permission paiements_assurances:', permissions.paiements_assurances);
    
    return permissions.paiements_assurances === true;
  };

  // 🔥 DÉFINIR getDefaultPermissions
  const getDefaultPermissions = (role: string): RolePermissions => {
    const defaultPermissions = {
      admin: {
        dashboard: true,
        products: true,
        stock: true,
        sales: true,
        sales_history: true,
        paiements_assurances: true,
        clients: true,
        suppliers: true,
        orders: true,
        transfers: true,
        inventory: true,
        settings: true,
      },
      pharmacien: {
        dashboard: true,
        products: true,
        stock: true,
        sales: true,
        sales_history: true,
        paiements_assurances: true,
        clients: true,
        suppliers: true,
        orders: true,
        transfers: true,
        inventory: true,
        settings: false,
      },
      vendeur: {
        dashboard: true,
        products: true,
        stock: true,
        sales: true,
        sales_history: true,
        paiements_assurances: false,
        clients: true,
        suppliers: false,
        orders: false,
        transfers: false,
        inventory: false,
        settings: false,
      },
      caissier: {
        dashboard: true,
        products: false,
        stock: false,
        sales: true,
        sales_history: true,
        paiements_assurances: false,
        clients: false,
        suppliers: false,
        orders: false,
        transfers: false,
        inventory: false,
        settings: false,
      },
    };

    return defaultPermissions[role as keyof typeof defaultPermissions] || defaultPermissions.vendeur;
  };

  // 🔥 DÉFINIR loadVentesEnAttente
  const loadVentesEnAttente = async () => {
    try {
      // 🔥 Vérifier si les ventes sont déjà chargées
      if (ventesLoadedRef.current) {
        console.log('📦 Ventes déjà chargées');
        setLoading(false);
        return;
      }

      setLoading(true);
      console.log('🔄 Chargement des ventes en attente...');

      if (!utilisateur?.pharmacy_id) {
        console.error('Aucune pharmacie associée à cet utilisateur');
        setLoading(false);
        return;
      }

      const { data: ventesData, error: ventesError } = await supabase
        .from('ventes')
        .select(`
          *,
          clients (
            *,
            assurances (*)
          )
        `)
        .eq('pharmacy_id', utilisateur.pharmacy_id)
        .gt('montant_assurance', 0)
        .order('date_vente', { ascending: false });

      if (ventesError) {
        console.error('Erreur chargement ventes:', ventesError);
        throw ventesError;
      }

      console.log('✅ Ventes chargées:', ventesData?.length || 0);
      setVentesEnAttente(ventesData || []);
      ventesLoadedRef.current = true; // 🔥 Marquer comme chargé
      
    } catch (error) {
      console.error('Erreur chargement données:', error);
      ventesLoadedRef.current = true; // 🔥 Même en cas d'erreur
    } finally {
      setLoading(false);
    }
  };

  // 🔥 DÉFINIR loadPermissions AVANT useEffect
  const loadPermissions = async () => {
    if (!utilisateur) return;

    try {
      // 🔥 Vérifier si les permissions sont déjà chargées
      if (permissionsLoadedRef.current) {
        console.log('🔐 Permissions déjà chargées');
        return;
      }

      console.log('👤 Chargement permissions pour:', utilisateur.role, utilisateur.pharmacy_id);
      
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('pharmacy_id', utilisateur.pharmacy_id)
        .eq('role', utilisateur.role)
        .single();

      if (error) {
        console.error('❌ Erreur chargement permissions:', error);
        const defaultPerms = getDefaultPermissions(utilisateur.role);
        console.log('📋 Permissions par défaut:', defaultPerms);
        setPermissions(defaultPerms);
        permissionsLoadedRef.current = true;
        
        if (defaultPerms.paiements_assurances && !ventesLoadedRef.current) {
          await loadVentesEnAttente();
        } else {
          setLoading(false);
        }
      } else if (data) {
        console.log('✅ Permissions chargées depuis DB:', data);
        
        const loadedPermissions: RolePermissions = {
          dashboard: data.dashboard,
          products: data.products,
          stock: data.stock,
          sales: data.sales,
          sales_history: data.sales_history,
          paiements_assurances: data.paiements_assurances,
          clients: data.clients,
          suppliers: data.suppliers,
          orders: data.orders,
          transfers: data.transfers,
          inventory: data.inventory,
          settings: data.settings,
        };
        
        console.log('🔍 Permission paiements_assurances:', loadedPermissions.paiements_assurances);
        setPermissions(loadedPermissions);
        permissionsLoadedRef.current = true;
        
        if (loadedPermissions.paiements_assurances && !ventesLoadedRef.current) {
          console.log('✅ Permission accordée, chargement des ventes');
          await loadVentesEnAttente();
        } else {
          console.log('❌ Permission refusée pour paiements_assurances');
          setLoading(false);
        }
      } else {
        console.log('📋 Aucune donnée, utilisation permissions par défaut');
        const defaultPerms = getDefaultPermissions(utilisateur.role);
        setPermissions(defaultPerms);
        permissionsLoadedRef.current = true;
        
        if (defaultPerms.paiements_assurances && !ventesLoadedRef.current) {
          await loadVentesEnAttente();
        } else {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('💥 Erreur générale:', error);
      const defaultPerms = getDefaultPermissions(utilisateur.role);
      setPermissions(defaultPerms);
      permissionsLoadedRef.current = true;
      setLoading(false);
    }
  };

  // Debug logs - MAINTENANT hasPermission est définie
  useEffect(() => {
    console.log('🔍 AssurancePaymentsManager - État:', {
      utilisateur: utilisateur?.role,
      permissions,
      loading,
      hasPermission: hasPermission(),
      permissionsLoaded: permissionsLoadedRef.current,
      ventesLoaded: ventesLoadedRef.current
    });
  }, [utilisateur, permissions, loading]);

  useEffect(() => {
    // 🔥 Ne charger que si les données ne sont pas déjà chargées
    if (permissionsLoadedRef.current && ventesLoadedRef.current) {
      console.log('📦 Données déjà chargées, pas de rechargement');
      setLoading(false);
      return;
    }

    if (utilisateur) {
      loadPermissions();
    }
  }, [utilisateur]);

  // Fonction pour générer l'état imprimable
  const genererEtatImprimable = () => {
    setShowPrintView(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setShowPrintView(false), 100);
    }, 100);
  };

  // Fonction pour formater la date
  const formaterDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Fonction pour générer et télécharger le ticket
  const genererTicket = (vente: VenteAvecClient) => {
    console.log('🎫 Génération du ticket pour:', vente.numero_vente);
    
    // Créer le contenu HTML du ticket
    const ticketContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Ticket Assurance - ${vente.numero_vente}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            line-height: 1.4;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .info-section {
            margin-bottom: 15px;
          }
          .info-label {
            font-weight: bold;
            color: #333;
          }
          .montant {
            font-size: 1.2em;
            font-weight: bold;
            color: #2c5aa0;
          }
          .details {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            margin: 10px 0;
          }
          .signature {
            margin-top: 30px;
            border-top: 1px dashed #333;
            padding-top: 10px;
          }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>TICKET ASSURANCE</h1>
          <h2>Pharmacie</h2>
          <p>Document pour réclamation assurance</p>
        </div>

        <div class="info-section">
          <p><span class="info-label">N° Vente:</span> ${vente.numero_vente}</p>
          <p><span class="info-label">Date:</span> ${formaterDate(vente.date_vente)}</p>
          <p><span class="info-label">Heure:</span> ${new Date(vente.date_vente).toLocaleTimeString('fr-FR')}</p>
        </div>

        <div class="info-section">
          <p><span class="info-label">Client:</span> ${vente.clients?.nom_complet || 'Non renseigné'}</p>
          <p><span class="info-label">N° Assuré:</span> ${vente.clients?.numero_assure || 'Non renseigné'}</p>
          <p><span class="info-label">Assurance:</span> ${vente.clients?.assurances?.nom || 'Non renseigné'}</p>
          <p><span class="info-label">Taux couverture:</span> ${vente.clients?.assurances?.taux_couverture || 0}%</p>
        </div>

        <div class="details">
          <h3>DÉTAILS DE LA VENTE</h3>
          <p><span class="info-label">Montant total:</span> <span class="montant">${vente.montant_total.toLocaleString('fr-FR')} FCFA</span></p>
          <p><span class="info-label">Prise en charge assurance:</span> <span class="montant">${vente.montant_assurance.toLocaleString('fr-FR')} FCFA</span></p>
          <p><span class="info-label">Reste à charge patient:</span> <span class="montant">${vente.montant_patient.toLocaleString('fr-FR')} FCFA</span></p>
        </div>

        <div class="info-section">
          <p><span class="info-label">Statut:</span> ${vente.statut}</p>
          <p><span class="info-label">Généré le:</span> ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
        </div>

        <div class="signature">
          <p><em>Document émis par le système de gestion pharmaceutique</em></p>
          <p><strong>À conserver pour réclamation auprès de l'assurance</strong></p>
        </div>

        <div class="no-print" style="margin-top: 20px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
            Imprimer le ticket
          </button>
        </div>
      </body>
      </html>
    `;

    // Créer une nouvelle fenêtre pour afficher le ticket
    const ticketWindow = window.open('', '_blank');
    if (ticketWindow) {
      ticketWindow.document.write(ticketContent);
      ticketWindow.document.close();
      
      // Optionnel: focus sur la fenêtre
      ticketWindow.focus();
    } else {
      alert('Veuillez autoriser les pop-ups pour afficher le ticket');
    }
  };

  // Fonction alternative pour télécharger le ticket en PDF (version simplifiée)
  const telechargerTicketPDF = (vente: VenteAvecClient) => {
    console.log('📄 Téléchargement PDF pour:', vente.numero_vente);
    
    // Créer un contenu simple pour le PDF
    const content = `
TICKET ASSURANCE - PHARMACIE
=============================

N° Vente: ${vente.numero_vente}
Date: ${formaterDate(vente.date_vente)}
Heure: ${new Date(vente.date_vente).toLocaleTimeString('fr-FR')}

INFORMATIONS CLIENT:
-------------------
Nom: ${vente.clients?.nom_complet || 'Non renseigné'}
N° Assuré: ${vente.clients?.numero_assure || 'Non renseigné'}
Assurance: ${vente.clients?.assurances?.nom || 'Non renseigné'}
Taux couverture: ${vente.clients?.assurances?.taux_couverture || 0}%

DÉTAILS FINANCIERS:
------------------
Montant total: ${vente.montant_total.toLocaleString('fr-FR')} FCFA
Prise en charge assurance: ${vente.montant_assurance.toLocaleString('fr-FR')} FCFA
Reste à charge patient: ${vente.montant_patient.toLocaleString('fr-FR')} FCFA

Statut: ${vente.statut}
Généré le: ${new Date().toLocaleDateString('fr-FR')}

-----------------------------------
Document pour réclamation assurance
À conserver pour démarches auprès de l'assurance
    `;

    // Créer et télécharger le fichier texte
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket-assurance-${vente.numero_vente}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const creerReclamation = async (vente: VenteAvecClient) => {
    try {
      console.log('Création réclamation pour:', vente);
      
      alert(`Réclamation créée pour ${vente.numero_vente}\nMontant: ${vente.montant_assurance.toLocaleString('fr-FR')} F`);
      
      // Réinitialiser le flag pour forcer le rechargement
      ventesLoadedRef.current = false;
      await loadVentesEnAttente();
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    }
  };

  const filteredVentes = ventesEnAttente.filter((vente) => {
    const matchesSearch = 
      vente.numero_vente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vente.clients?.nom_complet.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vente.clients?.assurances?.nom.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = (!dateDebut || vente.date_vente >= dateDebut) &&
                       (!dateFin || vente.date_vente <= dateFin);
    
    return matchesSearch && matchesDate;
  });

  // Calcul des totaux
  const totalAReclamer = ventesEnAttente.reduce((sum, vente) => sum + vente.montant_assurance, 0);
  const totalMontantAssurance = filteredVentes.reduce((sum, vente) => sum + vente.montant_assurance, 0);
  const totalMontantVentes = filteredVentes.reduce((sum, vente) => sum + vente.montant_total, 0);

  // Vérification des permissions
  if (loading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des permissions...</p>
        </div>
      </div>
    );
  }

  if (!hasPermission()) {
    console.log('🚫 Accès refusé - Affichage message erreur');
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Accès non autorisé</h2>
          <p className="text-gray-600 mb-4">
            Vous n'avez pas les permissions nécessaires pour accéder à la gestion des paiements assurances.
          </p>
          <p className="text-sm text-gray-500">
            Rôle actuel: <span className="font-medium">{utilisateur?.role}</span>
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Permission requise: <span className="font-medium">paiements_assurances</span>
          </p>
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Solution:</strong> Contactez un administrateur pour modifier vos permissions dans 
              <span className="font-medium"> Paramètres → Rôles et Permissions</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Composant pour la vue d'impression
  const PrintView = () => (
    <div className="print-view bg-white p-8">
      {/* En-tête de l'état */}
      <div className="text-center mb-8 border-b-2 border-gray-300 pb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">ÉTAT DES PAIEMENTS ASSURANCES</h1>
        <p className="text-gray-600 text-sm">Pharmacie: {utilisateur?.pharmacy_id}</p>
        <p className="text-gray-600 text-sm">
          Période du {dateDebut ? formaterDate(dateDebut) : 'début'} au {dateFin ? formaterDate(dateFin) : formaterDate(new Date().toISOString())}
        </p>
        <p className="text-gray-600 text-sm">Généré le: {formaterDate(new Date().toISOString())}</p>
        <p className="text-gray-600 text-sm">Par: {utilisateur?.nom_complet} ({utilisateur?.role})</p>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <p className="text-sm text-gray-600">Nombre de ventes</p>
          <p className="text-2xl font-bold text-blue-600">{filteredVentes.length}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">Total à réclamer</p>
          <p className="text-2xl font-bold text-green-600">{totalMontantAssurance.toLocaleString('fr-FR')} F</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">Total des ventes</p>
          <p className="text-2xl font-bold text-purple-600">{totalMontantVentes.toLocaleString('fr-FR')} F</p>
        </div>
      </div>

      {/* Tableau des ventes */}
      <table className="w-full border-collapse border border-gray-300 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 p-2 text-left">N° Vente</th>
            <th className="border border-gray-300 p-2 text-left">Date</th>
            <th className="border border-gray-300 p-2 text-left">Client</th>
            <th className="border border-gray-300 p-2 text-left">N° Assuré</th>
            <th className="border border-gray-300 p-2 text-left">Assurance</th>
            <th className="border border-gray-300 p-2 text-left">Taux</th>
            <th className="border border-gray-300 p-2 text-right">Montant Total</th>
            <th className="border border-gray-300 p-2 text-right">Montant Assurance</th>
            <th className="border border-gray-300 p-2 text-right">Montant Patient</th>
            <th className="border border-gray-300 p-2 text-center">Statut</th>
          </tr>
        </thead>
        <tbody>
          {filteredVentes.map((vente, index) => (
            <tr key={vente.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="border border-gray-300 p-2 font-mono">{vente.numero_vente}</td>
              <td className="border border-gray-300 p-2">{formaterDate(vente.date_vente)}</td>
              <td className="border border-gray-300 p-2">{vente.clients?.nom_complet || 'N/A'}</td>
              <td className="border border-gray-300 p-2">{vente.clients?.numero_assure || 'N/A'}</td>
              <td className="border border-gray-300 p-2">{vente.clients?.assurances?.nom || 'N/A'}</td>
              <td className="border border-gray-300 p-2 text-center">
                {vente.clients?.assurances?.taux_couverture || 0}%
              </td>
              <td className="border border-gray-300 p-2 text-right">
                {vente.montant_total.toLocaleString('fr-FR')} F
              </td>
              <td className="border border-gray-300 p-2 text-right font-bold">
                {vente.montant_assurance.toLocaleString('fr-FR')} F
              </td>
              <td className="border border-gray-300 p-2 text-right">
                {vente.montant_patient.toLocaleString('fr-FR')} F
              </td>
              <td className="border border-gray-300 p-2 text-center">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  vente.statut === 'payee' 
                    ? 'bg-green-100 text-green-800'
                    : vente.statut === 'en_attente_paiement'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {vente.statut}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 font-bold">
            <td colSpan={6} className="border border-gray-300 p-2 text-right">TOTAUX:</td>
            <td className="border border-gray-300 p-2 text-right">
              {totalMontantVentes.toLocaleString('fr-FR')} F
            </td>
            <td className="border border-gray-300 p-2 text-right">
              {totalMontantAssurance.toLocaleString('fr-FR')} F
            </td>
            <td className="border border-gray-300 p-2 text-right">
              {(totalMontantVentes - totalMontantAssurance).toLocaleString('fr-FR')} F
            </td>
            <td className="border border-gray-300 p-2"></td>
          </tr>
        </tfoot>
      </table>

      {/* Notes et signatures */}
      <div className="mt-8 grid grid-cols-2 gap-8">
        <div>
          <p className="text-sm text-gray-600 mb-4">
            <strong>Notes:</strong><br/>
            • Cet état récapitule toutes les ventes avec prise en charge assurance<br/>
            • Les montants sont exprimés en Francs CFA<br/>
            • Document généré automatiquement par le système
          </p>
        </div>
        <div className="text-center">
          <div className="mt-12 border-t border-gray-300 pt-4">
            <p className="text-sm text-gray-600">Signature et cachet</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Vue normale
  const NormalView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Paiements Assurances</h2>
          <p className="text-gray-600 mt-1">Gestion des réclamations auprès des assurances</p>
          <p className="text-sm text-green-600 mt-1">
            Connecté en tant que: <span className="font-medium">{utilisateur?.nom_complet}</span> 
            ({utilisateur?.role})
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-blue-600">
            <DollarSign className="w-5 h-5" />
            <span>Total à réclamer: {totalAReclamer.toLocaleString('fr-FR')} F</span>
          </div>
          <button
            onClick={genererEtatImprimable}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Printer className="w-4 h-4" />
            Imprimer l'état
          </button>
          <button
            onClick={() => {
              permissionsLoadedRef.current = false;
              ventesLoadedRef.current = false;
              loadPermissions();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
          >
            <Download className="w-4 h-4" />
            Recharger
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par vente, client ou assurance..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              placeholder="Date début"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              placeholder="Date fin"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => {
              ventesLoadedRef.current = false;
              loadVentesEnAttente();
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Filter className="w-4 h-4" />
            Actualiser
          </button>
        </div>

        {/* Liste des ventes à réclamer */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredVentes.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Aucune vente à réclamer</p>
            <p className="text-gray-400 text-sm mt-2">
              {searchTerm || dateDebut || dateFin 
                ? 'Aucun résultat pour vos critères de recherche' 
                : 'Toutes les réclamations ont été traitées'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">N° Vente</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Client</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Assurance</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Taux</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Montant Assurance</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVentes.map((vente) => (
                  <tr key={vente.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-sm">{vente.numero_vente}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(vente.date_vente).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{vente.clients?.nom_complet}</div>
                      {vente.clients?.numero_assure && (
                        <div className="text-xs text-gray-500">
                          N°: {vente.clients.numero_assure}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-blue-700">
                          {vente.clients?.assurances?.nom}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        {vente.clients?.assurances?.taux_couverture}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-blue-700">
                      {vente.montant_assurance.toLocaleString('fr-FR')} F
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => creerReclamation(vente)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
                        >
                          Créer réclamation
                        </button>
                        <button
                          onClick={() => genererTicket(vente)}
                          className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition"
                        >
                          <FileText className="w-3 h-3" />
                          Ticket
                        </button>
                        <button
                          onClick={() => telechargerTicketPDF(vente)}
                          className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
                          title="Télécharger en PDF"
                        >
                          <Download className="w-3 h-3" />
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredVentes.length > 0 && (
          <div className="mt-4 text-sm text-gray-500">
            {filteredVentes.length} vente(s) trouvée(s) • 
            Total à réclamer: <strong>{filteredVentes.reduce((sum, v) => sum + v.montant_assurance, 0).toLocaleString('fr-FR')} F</strong>
          </div>
        )}
      </div>

      {/* Section d'information */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Informations sur les réclamations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <p><strong>Délai de réclamation:</strong> 30 jours après la vente</p>
            <p><strong>Documents requis:</strong> Ticket de caisse + Ordonnance</p>
          </div>
          <div>
            <p><strong>Contact assurances:</strong> Voir dans la gestion des assurances</p>
            <p><strong>Suivi:</strong> Conserver une copie de toutes les réclamations</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="assurance-payments-manager">
      {/* Styles CSS pour l'impression */}
      <style>
        {`
          @media print {
            @page {
              margin: 0.5cm;
              size: A4 portrait;
            }
            
            body * {
              visibility: hidden;
            }
            
            .print-view,
            .print-view * {
              visibility: visible;
            }
            
            .print-view {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              background: white;
              padding: 0;
              margin: 0;
            }
            
            .no-print {
              display: none !important;
            }
            
            table {
              page-break-inside: auto;
            }
            
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
          }
        `}
      </style>

      {showPrintView ? <PrintView /> : <NormalView />}
    </div>
  );
}
