import { apiClient } from '@/shared/services/api/client';
import type { PDFTemplate } from '../types/pdf.types';

/**
 * PDF Service
 * Serviciu pentru gestionarea template-urilor PDF
 */
export const pdfService = {
  /**
   * Obține template-ul PDF salvat din backend
   */
  async getTemplate(): Promise<PDFTemplate | null> {
    try {
      const response = await apiClient.get<{ template: PDFTemplate }>('/api/pdf-template');
      return response.data?.template || null;
    } catch (error) {
      console.error('Eroare la încărcarea template-ului din backend:', error);
      // Fallback la localStorage
      return this.getTemplateFromLocalStorage();
    }
  },

  /**
   * Salvează template-ul PDF în backend
   */
  async saveTemplate(template: PDFTemplate): Promise<void> {
    try {
      await apiClient.post('/api/pdf-template', { template });
      // Salvează și în localStorage pentru backup
      localStorage.setItem('pdfFieldTemplate', JSON.stringify(template));
    } catch (error) {
      console.error('Eroare la salvarea template-ului în backend:', error);
      // Fallback la localStorage
      localStorage.setItem('pdfFieldTemplate', JSON.stringify(template));
    }
  },

  /**
   * Obține template-ul din localStorage (fallback)
   */
  getTemplateFromLocalStorage(): PDFTemplate | null {
    try {
      const templateStr = localStorage.getItem('pdfFieldTemplate');
      if (templateStr) {
        const template = JSON.parse(templateStr) as PDFTemplate;
        if (template.fields) {
          return template;
        }
      }
    } catch (error) {
      console.error('Eroare la încărcarea din localStorage:', error);
    }
    return null;
  },
};

