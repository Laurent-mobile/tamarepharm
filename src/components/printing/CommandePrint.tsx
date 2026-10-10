//src/components/printing/CommandePrint.tsx
import { useEffect, useRef } from 'react';
import { PDFGenerator } from '../services/pdfGenerator';
import { Printer, X, Archive } from 'lucide-react';

interface CommandePrintProps {
  commande: any;
  isVisible: boolean;
  onClose: () => void;
}

export function CommandePrint({ commande, isVisible, onClose }: CommandePrintProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const imprimerPDF = async () => {
    if (!printRef.current) return;

    try {
      await PDFGenerator.generatePDF(
        printRef.current,
        {
          title: 'BON DE COMMANDE',
          subtitle: `N° ${commande.numero_commande}`,
          type: 'commande',
          signature: {
            nom: 'Responsable Achats',
            poste: 'Responsable des Achats',
            date: new Date(commande.date_commande).toLocaleDateString('fr-FR')
          }
        },
        `commande_${commande.numero_commande}`
      );
    } catch (error) {
      console.error('Erreur impression:', error);
      alert('Erreur lors de l\'impression du PDF');
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Impression Commande</h2>
          <div className="flex gap-3">
            <button
              onClick={imprimerPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Printer className="w-4 h-4" />
              Imprimer PDF
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div ref={printRef} className="bg-white p-8 print:p-0">
            {/* En-tête commande */}
            <div className="text-center mb-8 border-b-2 border-gray-300 pb-4">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">BON DE COMMANDE</h1>
              <div className="grid grid-cols-2 gap-8 text-sm text-gray-600">
                <div className="text-left">
                  <p><strong>N° Commande:</strong> {commande.numero_commande}</p>
                  <p><strong>Date Commande:</strong> {new Date(commande.date_commande).toLocaleDateString('fr-FR')}</p>
                  <p><strong>Bon Commande N°:</strong> {commande.bon_commande_numero || 'Non spécifié'}</p>
                </div>
                <div className="text-right">
                  <p><strong>Fournisseur:</strong> {commande.fournisseurs?.nom}</p>
                  <p><strong>Date Livraison Prévue:</strong> {commande.date_livraison_prevue ? new Date(commande.date_livraison_prevue).toLocaleDateString('fr-FR') : 'Non spécifiée'}</p>
                  <p><strong>Statut:</strong> {commande.statut}</p>
                </div>
              </div>
            </div>

            {/* Articles commandés */}
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-4 border-b pb-2">Articles Commandés</h2>
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-2 text-left">Produit</th>
                    <th className="border border-gray-300 p-2 text-center">Code</th>
                    <th className="border border-gray-300 p-2 text-center">Quantité</th>
                    <th className="border border-gray-300 p-2 text-center">Prix Unitaire</th>
                    <th className="border border-gray-300 p-2 text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {commande.commande_fournisseur_lignes?.map((ligne: any, index: number) => (
                    <tr key={ligne.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 p-2">{ligne.produits?.nom}</td>
                      <td className="border border-gray-300 p-2 text-center">{ligne.produits?.code_produit}</td>
                      <td className="border border-gray-300 p-2 text-center">{ligne.quantite_commandee}</td>
                      <td className="border border-gray-300 p-2 text-center">{ligne.prix_unitaire} F</td>
                      <td className="border border-gray-300 p-2 text-center">
                        {(ligne.quantite_commandee * ligne.prix_unitaire).toLocaleString('fr-FR')} F
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan={4} className="border border-gray-300 p-2 text-right">Total Commande:</td>
                    <td className="border border-gray-300 p-2 text-center">
                      {Number(commande.montant_total).toLocaleString('fr-FR')} F
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Informations livraison */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="font-bold mb-2">Conditions de Livraison</h3>
                <div className="border border-gray-300 p-3 rounded bg-gray-50 text-sm">
                  <p>• Livraison à l'adresse de la pharmacie</p>
                  <p>• Produits conformes aux spécifications</p>
                  <p>• Respect des dates de péremption</p>
                </div>
              </div>
              <div>
                <h3 className="font-bold mb-2">Conditions de Paiement</h3>
                <div className="border border-gray-300 p-3 rounded bg-gray-50 text-sm">
                  <p>• Paiement à 30 jours fin de mois</p>
                  <p>• Facture obligatoire</p>
                  <p>• Bon de livraison requis</p>
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
                <p className="font-semibold">Le Responsable des Achats</p>
                <p className="text-sm text-gray-600 mt-4">Cachet et Signature</p>
                <p className="text-sm text-gray-600">Date: {new Date().toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
