export interface PDFField {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  fontSize?: number; // Optional font size for text fields
}

export interface PDFTemplate {
  fields: Record<string, PDFField>;
  version?: string;
  createdAt?: string;
}

export interface PDFFieldConfig {
  key: string;
  label: string;
  preview: string;
}

export interface PDFGenerationOptions {
  leave: {
    employeeName: string;
    workplace: string;
    function: string;
    days: number;
    startDate: string;
    endDate: string;
    leaveType: string;
    reason: string;
    signatureDate: string;
  };
  employee: {
    name: string;
    fullName: string;
  };
  workplaceName: string;
  managerName?: string;
}

