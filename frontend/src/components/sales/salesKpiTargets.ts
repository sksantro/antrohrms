export type SalesKpiPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface SalesKpiMetric {
  id: string;
  label: string;
  target: string;
  kind?: 'count' | 'report';
}

export interface SalesKpiPeriodConfig {
  id: SalesKpiPeriod;
  label: string;
  metrics: SalesKpiMetric[];
}

export const SALES_KPI_PERIODS: SalesKpiPeriodConfig[] = [
  {
    id: 'daily',
    label: 'Daily',
    metrics: [
      { id: 'new-company-leads', label: 'New Company Leads', target: '50' },
      { id: 'decision-maker-contacts', label: 'Decision Maker Contacts', target: '20' },
      { id: 'linkedin-outreach', label: 'LinkedIn Outreach Messages', target: '25' },
      { id: 'cold-calls', label: 'Cold Calls', target: '15' },
      { id: 'follow-ups', label: 'Follow-ups Completed', target: '10' },
      { id: 'interested-leads', label: 'Interested Leads', target: '2' },
      { id: 'daily-report', label: 'Daily Report', target: 'Required', kind: 'report' },
    ],
  },
  {
    id: 'weekly',
    label: 'Weekly',
    metrics: [
      { id: 'new-company-leads', label: 'New Company Leads', target: '250' },
      { id: 'decision-maker-contacts', label: 'Decision Maker Contacts', target: '100' },
      { id: 'cold-calls', label: 'Cold Calls', target: '75' },
      { id: 'linkedin-outreach', label: 'LinkedIn Outreach Messages', target: '100–125' },
      { id: 'interested-leads', label: 'Interested Leads', target: '10–15' },
      { id: 'meetings-booked', label: 'Meetings/Demo Calls Booked', target: '3–5' },
    ],
  },
  {
    id: 'monthly',
    label: 'Monthly',
    metrics: [
      { id: 'new-company-leads', label: 'New Company Leads', target: '1000' },
      { id: 'decision-maker-contacts', label: 'Decision Maker Contacts', target: '400' },
      { id: 'cold-calls', label: 'Cold Calls', target: '300' },
      { id: 'linkedin-outreach', label: 'LinkedIn Outreach Messages', target: '400–500' },
      { id: 'interested-leads', label: 'Interested Leads', target: '40–50' },
      { id: 'meetings-booked', label: 'Meetings Booked', target: '12–20' },
      {
        id: 'proposal-sent',
        label: 'Serious Opportunities moved to Proposal Sent',
        target: '2–4',
      },
    ],
  },
  {
    id: 'quarterly',
    label: 'Quarterly',
    metrics: [
      { id: 'new-company-leads', label: 'New Company Leads', target: '3000' },
      { id: 'decision-maker-contacts', label: 'Decision Maker Contacts', target: '1200' },
      { id: 'cold-calls', label: 'Cold Calls', target: '900' },
      { id: 'linkedin-outreach', label: 'LinkedIn Outreach Messages', target: '1200–1500' },
      { id: 'interested-leads', label: 'Interested Leads', target: '120–150' },
      { id: 'meetings-booked', label: 'Meetings Booked', target: '36–60' },
      {
        id: 'proposal-sent',
        label: 'Serious Opportunities moved to Proposal Sent',
        target: '6–12',
      },
    ],
  },
];
