import type { BaseEntity } from './common.types';

export interface Announcement extends BaseEntity {
  message: string;
  workplaceIds: string[]; // Dacă e gol, mesajul este pentru toate farmaciile
  createdBy: string;
  createdByName: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  isActive: boolean;
}

export interface AnnouncementFormData {
  message: string;
  workplaceIds: string[]; // Array cu ID-uri de farmacii, sau [] pentru mesaj global
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

