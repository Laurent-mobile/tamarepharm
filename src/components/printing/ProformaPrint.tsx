//src/components/printing/ProformaPrint.tsx
import { useEffect, useRef } from 'react';
import { PDFGenerator } from '../services/pdfGenerator';
import { Printer, X, Archive } from 'lucide-react'; 

interface ProformaPrintProps {
  proforma: any;
  isVisible: boolean;
  onClose: () => void;
}

export function ProformaPrint({ proforma, isVisible, onClose }: ProformaPrintProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const imprimerPDF = async () => {
    if (!printRef.current) return;

    try {
      await PDFGenerator.generatePDF(
        printRef.current,
        {
          title: 'DEMANDE DE PRO-FORMA',
          subtitle: `N° ${proforma.numero_demande}`,
          type: 'proforma',
          signature: {
            nom: 'Responsable Pharmacie',
            poste: 'Pharmacien Responsable',
            date: new Date().toLocaleDateString('fr-FR')
          }
        },
        `proforma_${proforma.numero_demande}`
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
        {/* En-tête modal */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Impression Pro-Forma</h2>
          <div className="flex gap-3">
            <button
              onClick={imprimerPDF}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              <Printer className="w-4 h-4" />
              Imprimer PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Contenu à imprimer */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div ref={printRef} className="bg-white p-8 print:p-0">
            {/* En-tête document */}
            <div className="text-center mb-8 border-b-2 border-gray-300 pb-4">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">DEMANDE DE PRO-FORMA</h1>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div className="text-left">
                  <p><strong>N°:</strong> {proforma.numero_demande}</p>
                  <p><strong>Date:</strong> {new Date(proforma.date_demande).toLocaleDateString('fr-FR')}</p>
                </div>
                <div className="text-right">
                  <p><strong>Fournisseur:</strong> {proforma.fournisseurs?.nom}</p>
                  <p><strong>Date besoin:</strong> {proforma.date_besoin ? new Date(proforma.date_besoin).toLocaleDateString('fr-FR') : 'Non spécifiée'}</p>
                </div>
              </div>
            </div>

            {/* Produits demandés */}
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-4 border-b pb-2">Produits Demandés</h2>
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-2 text-left">Produit</th>
                    <th className="border border-gray-300 p-2 text-center">Code</th>
                    <th className="border border-gray-300 p-2 text-center">Quantité</th>
                    <th className="border border-gray-300 p-2 text-center">Prix Estimé</th>
                    <th className="border border-gray-300 p-2 text-center">Total Estimé</th>
                  </tr>
                </thead>
                <tbody>
                  {proforma.demandes_proforma_lignes?.map((ligne: any, index: number) => (
                    <tr key={ligne.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 p-2">{ligne.produits?.nom}</td>
                      <td className="border border-gray-300 p-2 text-center">{ligne.produits?.code_produit}</td>
                      <td className="border border-gray-300 p-2 text-center">{ligne.quantite_demandee}</td>
                      <td className="border border-gray-300 p-2 text-center">{ligne.prix_unitaire_estime ? `${ligne.prix_unitaire_estime} F` : 'N/A'}</td>
                      <td className="border border-gray-300 p-2 text-center">
                        {ligne.prix_unitaire_estime ? `${(ligne.quantite_demandee * ligne.prix_unitaire_estime).toLocaleString('fr-FR')} F` : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan={4} className="border border-gray-300 p-2 text-right">Total Estimé:</td>
                    <td className="border border-gray-300 p-2 text-center">
                      {Number(proforma.montant_estime).toLocaleString('fr-FR')} F
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Remarques */}
            {proforma.remarques && (
              <div className="mb-8">
                <h2 className="text-xl font-bold mb-2">Remarques</h2>
                <div className="border border-gray-300 p-4 rounded bg-gray-50">
                  {proforma.remarques}
                </div>
              </div>
            )}

            {/* Signature */}
            <div className="mt-12 flex justify-end">
              <div className="text-center border-t border-gray-300 pt-4 w-64">
                <p className="font-semibold">Cachet et Signature</p>
                <p className="text-sm text-gray-600 mt-4">Le Pharmacien Responsable</p>
                <p className="text-sm text-gray-600">Date: {new Date().toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
