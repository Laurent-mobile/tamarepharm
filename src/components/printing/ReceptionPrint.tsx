// components/printing/ReceptionPrint.tsx - Version corrigée
import { useEffect, useRef } from 'react';
import { Printer, X, Archive, Truck, Package, Calendar } from 'lucide-react';
import { PDFGenerator } from '../services/pdfGenerator';

interface ReceptionPrintProps {
  reception: any;
  commande: any;
  isVisible: boolean;
  onClose: () => void;
  onArchive?: () => void;
}

export function ReceptionPrint({ reception, commande, isVisible, onClose, onArchive }: ReceptionPrintProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const imprimerPDF = async () => {
    if (!printRef.current) return;

    try {
      await PDFGenerator.generatePDF(
        printRef.current,
        {
          title: 'BON DE RÉCEPTION',
          subtitle: `N° ${reception.id.slice(-8).toUpperCase()}`,
          type: 'reception',
          signature: {
            nom: 'Responsable Réception',
            poste: 'Responsable des Stocks',
            date: new Date(reception.date_reception).toLocaleDateString('fr-FR')
          }
        },
        `reception_${commande.numero_commande}_${new Date().toISOString().slice(0, 10)}`
      );
    } catch (error) {
      console.error('Erreur impression:', error);
      alert('Erreur lors de l\'impression du PDF');
    }
  };

  if (!isVisible) return null;

  // DEBUG : Vérifier les données reçues
  console.log('🔍 Données réception dans ReceptionPrint:', {
    reception,
    commande,
    lignes: reception.reception_lignes,
    nombreLignes: reception.reception_lignes?.length
  });

  // Calcul des totaux
  const totalArticles = reception.reception_lignes?.length || 0;
  const totalQuantite = reception.reception_lignes?.reduce((sum: number, ligne: any) => sum + (ligne.quantite_recue || 0), 0) || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Impression Bon de Réception</h2>
          <div className="flex gap-3">
            <button
              onClick={imprimerPDF}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <Printer className="w-4 h-4" />
              Imprimer PDF
            </button>
            {onArchive && (
              <button
                onClick={onArchive}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Archive className="w-4 h-4" />
                Archiver
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div ref={printRef} className="bg-white p-8 print:p-0">
            {/* En-tête réception */}
            <div className="text-center mb-8 border-b-2 border-gray-300 pb-4">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">BON DE RÉCEPTION</h1>
              <div className="grid grid-cols-2 gap-8 text-sm text-gray-600">
                <div className="text-left">
                  <p><strong>N° Commande:</strong> {commande.numero_commande}</p>
                  <p><strong>Date Réception:</strong> {new Date(reception.date_reception).toLocaleDateString('fr-FR')}</p>
                  <p><strong>Type Réception:</strong> {reception.type_reception === 'totale' ? 'Complète' : 'Partielle'}</p>
                </div>
                <div className="text-right">
                  <p><strong>Fournisseur:</strong> {commande.fournisseurs?.nom}</p>
                  <p><strong>Réceptionné par:</strong> {reception.recu_par_details?.nom_complet || reception.utilisateurs?.nom_complet || 'Non spécifié'}</p>
                  <p><strong>Quantité totale:</strong> {totalQuantite} unités</p>
                </div>
              </div>
            </div>

            {/* Articles reçus */}
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-4 border-b pb-2">Articles Reçus</h2>
              
              {(!reception.reception_lignes || reception.reception_lignes.length === 0) ? (
                <div className="text-center py-8 bg-yellow-50 rounded-lg border border-yellow-200">
                  <Package className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                  <p className="text-yellow-700 font-medium">Aucun article trouvé pour cette réception</p>
                  <p className="text-yellow-600 text-sm mt-1">
                    Vérifiez que la réception contient des lignes de produits
                  </p>
                </div>
              ) : (
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-2 text-left">Produit</th>
                      <th className="border border-gray-300 p-2 text-center">Code</th>
                      <th className="border border-gray-300 p-2 text-center">Lot</th>
                      <th className="border border-gray-300 p-2 text-center">Date Expiration</th>
                      <th className="border border-gray-300 p-2 text-center">Quantité Reçue</th>
                      <th className="border border-gray-300 p-2 text-center">État</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reception.reception_lignes.map((ligne: any, index: number) => (
                      <tr key={ligne.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="border border-gray-300 p-2">
                          {ligne.produits?.nom || 'Produit inconnu'}
                        </td>
                        <td className="border border-gray-300 p-2 text-center">
                          {ligne.produits?.code_produit || 'N/A'}
                        </td>
                        <td className="border border-gray-300 p-2 text-center">
                          {ligne.lot || 'N/A'}
                        </td>
                        <td className="border border-gray-300 p-2 text-center">
                          {ligne.date_expiration ? new Date(ligne.date_expiration).toLocaleDateString('fr-FR') : 'N/A'}
                        </td>
                        <td className="border border-gray-300 p-2 text-center font-bold">
                          {ligne.quantite_recue || 0}
                        </td>
                        <td className="border border-gray-300 p-2 text-center">
                          <span className={`
                            px-2 py-1 rounded-full text-xs font-medium
                            ${ligne.etat_produit === 'conforme' ? 'bg-green-100 text-green-700' : ''}
                            ${ligne.etat_produit === 'non_conforme' ? 'bg-red-100 text-red-700' : ''}
                            ${ligne.etat_produit === 'endommage' ? 'bg-amber-100 text-amber-700' : ''}
                            ${!ligne.etat_produit ? 'bg-gray-100 text-gray-700' : ''}
                          `}>
                            {ligne.etat_produit === 'conforme' ? 'Conforme' : 
                             ligne.etat_produit === 'non_conforme' ? 'Non conforme' : 
                             ligne.etat_produit === 'endommage' ? 'Endommagé' : 'Non spécifié'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold">
                      <td colSpan={4} className="border border-gray-300 p-2 text-right">Total:</td>
                      <td className="border border-gray-300 p-2 text-center">{totalQuantite} unités</td>
                      <td className="border border-gray-300 p-2 text-center">{totalArticles} articles</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Informations contrôle qualité */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="font-bold mb-2">Contrôle Qualité</h3>
                <div className="border border-gray-300 p-3 rounded bg-gray-50 text-sm">
                  <p>✓ Emballage vérifié</p>
                  <p>✓ Quantité conforme</p>
                  <p>✓ Date de péremption respectée</p>
                  <p>✓ Produits conformes aux spécifications</p>
                </div>
              </div>
              <div>
                <h3 className="font-bold mb-2">Remarques</h3>
                <div className="border border-gray-300 p-3 rounded bg-gray-50 text-sm min-h-[120px]">
                  {reception.remarques || 'Aucune remarque particulière'}
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="mt-12 grid grid-cols-2 gap-8">
              <div className="text-center border-t border-gray-300 pt-4">
                <p className="font-semibold">Le Fournisseur</p>
                <p className="text-sm text-gray-600 mt-4">Cachet et Signature</p>
                <p className="text-sm text-gray-600">Date: ________________</p>
              </div>
              <div className="text-center border-t border-gray-300 pt-4">
                <p className="font-semibold">Le Responsable Réception</p>
                <p className="text-sm text-gray-600 mt-4">Cachet et Signature</p>
                <p className="text-sm text-gray-600">Date: {new Date().toLocaleDateString('fr-FR')}</p>
              </div>
            </div>

            {/* Informations stock */}
            <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-bold text-blue-900 mb-2">Informations Stock</h3>
              <div className="grid grid-cols-2 gap-4 text-sm text-blue-800">
                <div>
                  <p><strong>Date de mise en stock:</strong> {new Date().toLocaleDateString('fr-FR')}</p>
                  <p><strong>Emplacement:</strong> Stock principal</p>
                </div>
                <div>
                  <p><strong>Prochaine vérification:</strong> {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}</p>
                  <p><strong>Statut:</strong> Stock intégré</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
