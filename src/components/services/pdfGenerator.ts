//src/components/services/pdfGenerator.ts
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFOptions {
  title: string;
  subtitle?: string;
  type: 'proforma' | 'commande' | 'reception' | 'bon_livraison'; // Déjà présent
  signature?: {
    nom: string;
    poste: string;
    date: string;
  };
}

export class PDFGenerator {
  static async generatePDF(element: HTMLElement, options: PDFOptions, filename: string): Promise<void> {
    try {
      // Afficher un indicateur de chargement
      const loadingElement = this.createLoadingElement();
      document.body.appendChild(loadingElement);

      // Capturer l'élément
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // Créer le PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      // Ajouter l'image au PDF
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

      // Ajouter en-tête et pied de page
      this.addHeaderFooter(pdf, options);

      // Sauvegarder le PDF
      pdf.save(`${filename}.pdf`);

      // Supprimer l'indicateur de chargement
      document.body.removeChild(loadingElement);

    } catch (error) {
      console.error('Erreur génération PDF:', error);
      throw error;
    }
  }

  private static createLoadingElement(): HTMLElement {
    const div = document.createElement('div');
    div.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      ">
        <div style="
          background: white;
          padding: 2rem;
          border-radius: 8px;
          text-align: center;
        ">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p style="color: #374151; font-weight: 500;">Génération du PDF en cours...</p>
        </div>
      </div>
    `;
    return div;
  }

  private static addHeaderFooter(pdf: jsPDF, options: PDFOptions): void {
    const pageCount = pdf.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      
      // En-tête
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(options.title, 105, 15, { align: 'center' });
      
      if (options.subtitle) {
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.text(options.subtitle, 105, 22, { align: 'center' });
      }
      
      // Pied de page
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Page ${i} / ${pageCount}`, 105, 285, { align: 'center' });
      pdf.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 105, 290, { align: 'center' });
      
      // Signature sur la dernière page
      if (i === pageCount && options.signature) {
        this.addSignatureSection(pdf, options.signature);
      }
    }
  }

  private static addSignatureSection(pdf: jsPDF, signature: { nom: string; poste: string; date: string }): void {
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    
    // Ligne de signature
    pdf.line(pageWidth - 70, 250, pageWidth - 20, 250);
    
    // Informations signature
    pdf.text(`Nom: ${signature.nom}`, pageWidth - 70, 260);
    pdf.text(`Poste: ${signature.poste}`, pageWidth - 70, 265);
    pdf.text(`Date: ${signature.date}`, pageWidth - 70, 270);
    
    // Cachet
    pdf.setDrawColor(200, 0, 0);
    pdf.circle(pageWidth - 45, 245, 15);
    pdf.setFontSize(6);
    pdf.text('CACHET', pageWidth - 48, 245);
    pdf.text('ET SIGNATURE', pageWidth - 52, 249);
  }
}
