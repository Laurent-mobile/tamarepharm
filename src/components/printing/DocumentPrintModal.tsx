import { useState, useEffect } from 'react';
import { Printer, FileText, Truck, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { repository } from '../../lib/repository';

interface DocumentPrintModalProps {
  vente: any;
  onClose: () => void;
}

export function DocumentPrintModal({ vente, onClose }: DocumentPrintModalProps) {
  const { utilisateur } = useAuth();
  const [lignes, setLignes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [printType, setPrintType] = useState<'ticket' | 'facture' | 'bl'>('ticket');

  // ✅ CORRECTION : Utilisation de useEffect au lieu de useState
  useEffect(() => {
    loadLignes();
  }, []);

    const loadLignes = async () => {
    try {
      // ✅ Si c'est une réimpression de proforma, on utilise directement les lignes normalisées
      if (vente.isProformaReprint && vente.lignes) {
        setLignes(vente.lignes);
        setLoading(false);
        return;
      }

      // ✅ Sinon, c'est une vente normale, on charge les lignes de vente depuis la base
      const lignesData = await repository.getVenteLignes(vente.id);
      const produits = await repository.getProduits(vente.pharmacy_id);
      const enriched = lignesData.map((ligne: any) => {
        const prod = produits.find((p: any) => p.id === ligne.produit_id);
        return { ...ligne, produits: prod };
      });
      setLignes(enriched);
    } catch (error) {
      console.error('Erreur chargement lignes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl no-print">
          <h3 className="text-xl font-bold text-gray-900">Impression des Documents</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-4 border-b flex gap-4 no-print">
          <button onClick={() => setPrintType('ticket')} className={`flex-1 py-3 rounded-lg border-2 flex items-center justify-center gap-2 transition ${printType === 'ticket' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50'}`}>
            <FileText className="w-5 h-5" /> Ticket de Caisse
          </button>
          <button onClick={() => setPrintType('facture')} className={`flex-1 py-3 rounded-lg border-2 flex items-center justify-center gap-2 transition ${printType === 'facture' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}>
            <FileText className="w-5 h-5" /> Facture A4
          </button>
          <button onClick={() => setPrintType('bl')} className={`flex-1 py-3 rounded-lg border-2 flex items-center justify-center gap-2 transition ${printType === 'bl' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-200 hover:bg-gray-50'}`}>
            <Truck className="w-5 h-5" /> Bon de Livraison (BL)
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-gray-100">
          <div className={`bg-white mx-auto shadow-lg p-8 ${printType === 'ticket' ? 'max-w-[300px]' : 'max-w-[210mm] min-h-[297mm]'}`}>
            
            {printType === 'ticket' && (
              <div className="font-mono text-xs space-y-2">
                <div className="text-center border-b border-dashed border-black pb-2 mb-2">
                  <h2 className="font-bold text-lg">PHARMACIE</h2>
                  <p>Ouagadougou, Burkina Faso</p>
                  <p>Tél: +226 25 30 00 00</p>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Ticket N°:</span><span>{vente.numero_vente}</span></div>
                  <div className="flex justify-between"><span>Date:</span><span>{new Date(vente.date_vente).toLocaleString('fr-FR')}</span></div>
                  <div className="flex justify-between"><span>Caissier:</span><span>{utilisateur?.nom_complet}</span></div>
                </div>
                <div className="border-t border-dashed border-black pt-2 mt-2">
                  {lignes.map((ligne: any, i: number) => (
                    <div key={i} className="flex justify-between py-1">
                      <span>{ligne.produits?.nom?.substring(0, 20)} x{ligne.quantite}</span>
                      <span>{(ligne.quantite * ligne.prix_unitaire).toLocaleString('fr-FR')}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-dashed border-black pt-2 mt-2 font-bold text-sm">
                  <div className="flex justify-between"><span>TOTAL:</span><span>{Number(vente.montant_total).toLocaleString('fr-FR')} F</span></div>
                </div>
                <div className="text-center mt-4 pt-2 border-t border-dashed border-black">
                  <p>Merci de votre confiance !</p>
                </div>
              </div>
            )}

            {printType === 'facture' && (
              <div className="text-sm">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">FACTURE</h1>
                    <p className="text-gray-600">N° {vente.numero_vente}</p>
                    <p className="text-gray-600">Date: {new Date(vente.date_vente).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-xl font-bold">PHARMACIE</h2>
                    <p>Ouagadougou, Burkina Faso</p>
                    <p>IFU: XXXXXXXXX | RCCM: XXXXXXXXX</p>
                  </div>
                </div>
                
                <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                  <p className="font-bold text-gray-700 mb-1">Facturé à :</p>
                  <p className="text-lg font-semibold">{vente.clients?.nom_complet || 'Client Comptoir'}</p>
                  <p>{vente.clients?.adresse || ''}</p>
                  <p>Tél: {vente.clients?.telephone || '-'}</p>
                </div>

                <table className="w-full mb-8 border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-300">
                      <th className="text-left py-2 px-3">Désignation</th>
                      <th className="text-right py-2 px-3">Qté</th>
                      <th className="text-right py-2 px-3">P.U. HT</th>
                      <th className="text-right py-2 px-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((ligne: any, i: number) => (
                      <tr key={i} className="border-b border-gray-200">
                        <td className="py-2 px-3">{ligne.produits?.nom}</td>
                        <td className="text-right py-2 px-3">{ligne.quantite}</td>
                        <td className="text-right py-2 px-3">{Number(ligne.prix_unitaire).toLocaleString('fr-FR')}</td>
                        <td className="text-right py-2 px-3 font-medium">{Number(ligne.montant_total).toLocaleString('fr-FR')} F</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm"><span>Total HT:</span><span>{Number(vente.montant_total).toLocaleString('fr-FR')} F</span></div>
                    <div className="flex justify-between text-sm"><span>TVA (18%):</span><span>Inclus</span></div>
                    <div className="flex justify-between text-xl font-bold border-t-2 border-black pt-2">
                      <span>NET À PAYER:</span>
                      <span>{Number(vente.montant_total).toLocaleString('fr-FR')} F</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {printType === 'bl' && (
              <div className="text-sm">
                <div className="flex justify-between items-start mb-8 border-b-2 border-black pb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">BON DE LIVRAISON</h1>
                    <p className="text-gray-600">N° {vente.numero_vente.replace('PC', 'BL').replace('V', 'BL')}</p>
                    <p className="text-gray-600">Date: {new Date(vente.date_vente).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-xl font-bold">PHARMACIE</h2>
                    <p>Ouagadougou, Burkina Faso</p>
                  </div>
                </div>
                
                <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-300">
                  <p className="font-bold text-gray-700 mb-1">Livré à :</p>
                  <p className="text-lg font-semibold">{vente.clients?.nom_complet || 'Client Comptoir'}</p>
                  <p>{vente.clients?.adresse || ''}</p>
                </div>

                <table className="w-full mb-8 border-collapse border border-gray-400">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="text-left py-2 px-3 border border-gray-400">Désignation</th>
                      <th className="text-center py-2 px-3 border border-gray-400">Qté</th>
                      <th className="text-left py-2 px-3 border border-gray-400">N° Lot</th>
                      <th className="text-left py-2 px-3 border border-gray-400">Date Péremption</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((ligne: any, i: number) => (
                      <tr key={i} className="border border-gray-400">
  <td className="py-3 px-3 border border-gray-400 font-medium">{ligne.produits?.nom}</td>
  <td className="text-center py-3 px-3 border border-gray-400 text-lg font-bold">{ligne.quantite}</td>
  
  {/* ✅ CORRIGÉ : vérifier ligne.lot ou ligne.lot_numero */}
  <td className="py-3 px-3 border border-gray-400 font-mono">
    {ligne.lot || ligne.lot_numero || 'N/A'}
  </td>
  
  {/* ✅ CORRIGÉ : lire depuis ligne.date_expiration */}
  <td className="py-3 px-3 border border-gray-400 font-mono text-red-600">
    {ligne.date_expiration ? new Date(ligne.date_expiration).toLocaleDateString('fr-FR') : 'N/A'}
  </td>
</tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-16 flex justify-between items-end">
                  <div className="w-1/3">
                    <p className="font-bold mb-8">Cachet et Signature du Livreur:</p>
                    <div className="border-b border-black h-16"></div>
                  </div>
                  <div className="w-1/3 text-right">
                    <p className="font-bold mb-8">Cachet et Signature du Réceptionnaire:</p>
                    <div className="border-b border-black h-16"></div>
                    <p className="text-xs text-gray-500 mt-2">Lu et approuvé, reçu conforme en quantité et qualité.</p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-4 no-print">
          <button onClick={onClose} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium">Fermer</button>
          <button onClick={handlePrint} className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold flex items-center gap-2">
            <Printer className="w-5 h-5" /> Imprimer ce document
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .fixed.inset-0.bg-black, .fixed.inset-0.bg-black * { visibility: visible; }
          .fixed.inset-0.bg-black { position: absolute; left: 0; top: 0; background: white !important; }
          .no-print { display: none !important; }
          .bg-white.mx-auto { box-shadow: none !important; margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
