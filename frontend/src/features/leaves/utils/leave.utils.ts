/**
 * Convert YYYY-MM-DD to UTC midnight Date
 */
export const toUtcMidnight = (yyyyMmDd: string | null | undefined): Date | null => {
  if (!yyyyMmDd) return null;
  const parts = String(yyyyMmDd).split('-').map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  const [y, m, d] = parts;
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
};

/**
 * Calculate days inclusive (start and end dates included)
 */
export const calcDaysInclusive = (start: string, end: string): number => {
  const s = toUtcMidnight(start);
  const e = toUtcMidnight(end);
  if (!s || !e) return 0;
  const diffMs = e.getTime() - s.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  // Calcul inclusiv: de la 22 până în 24 = 3 zile (22, 23, 24)
  return diffDays + 1;
};

/**
 * Format leave type for display
 */
export const formatLeaveType = (type: string): string => {
  const typeMap: Record<string, string> = {
    odihna: 'Concediu de odihnă',
    medical: 'Concediu medical',
    fara_plata: 'Concediu fără plată',
    eveniment: 'Concediu pentru eveniment',
    concediu: 'Concediu de odihnă',
    neplatit: 'Concediu neplătit',
    maternitate: 'Concediu de maternitate',
    paternitate: 'Concediu de paternitate',
  };
  return typeMap[type] || type;
};

/**
 * Format leave status for display
 */
export const formatLeaveStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    'În așteptare': 'În așteptare',
    'Aprobată': 'Aprobată',
    'Respinsă': 'Respinsă',
    pending: 'În așteptare',
    approved: 'Aprobată',
    rejected: 'Respinsă',
  };
  return statusMap[status] || status;
};

/**
 * Get status color for UI
 */
export const getStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    'În așteptare': 'yellow',
    pending: 'yellow',
    'Aprobată': 'green',
    approved: 'green',
    'Respinsă': 'red',
    rejected: 'red',
  };
  return colorMap[status] || 'gray';
};

