export type ServicePriority = 'low';

export interface SalesServiceItem {
  name: string;
  priority?: ServicePriority;
}

export interface SalesServiceLine {
  id: string;
  title: string;
  services: SalesServiceItem[];
}

export const SALES_SERVICE_LINES: SalesServiceLine[] = [
  {
    id: 'antro-workforce',
    title: 'Antro Workforce Services',
    services: [
      { name: 'Workforce Hiring & Recruitment' },
      { name: 'Pre-Verified Workforce Readiness' },
      { name: 'Workforce Trust & Risk Intelligence' },
      { name: 'GCC & Enterprise Workforce Support' },
      { name: 'Technology Solutions' },
      { name: 'Workforce Management Support', priority: 'low' },
    ],
  },
  {
    id: 'wodena-technology',
    title: 'Wodena Technology Services',
    services: [
      { name: 'Interior quotation software' },
      { name: 'Interior project management software' },
      { name: 'Lead and CRM management software' },
      { name: 'Site execution tracking software' },
      { name: 'Vendor and material management software' },
      { name: 'Expense and payment tracking software' },
      { name: 'Client approval and handover workflow' },
      { name: 'Custom software for interior/construction businesses' },
    ],
  },
  {
    id: 'igolo-interior',
    title: 'Igolo Interior Services',
    services: [
      { name: 'Interior design' },
      { name: 'Full home interior execution' },
      { name: 'Modular kitchen' },
      { name: 'Wardrobe work' },
      { name: 'False ceiling work' },
      { name: 'Electrical work' },
      { name: 'Carpentry work' },
      { name: 'Painting and finishing work' },
      { name: 'Room-wise interior packages' },
      { name: 'BOQ and procurement support' },
      { name: 'Site execution management' },
      { name: 'Vendor and labour coordination' },
      { name: 'Final handover and support' },
    ],
  },
];
