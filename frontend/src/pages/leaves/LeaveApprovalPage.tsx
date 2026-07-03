import { LeaveRequestsPage } from './LeaveRequestsPage';

export function LeaveApprovalPage() {
  return <LeaveRequestsPage approvalMode />;
}

export function EscalatedLeaveRequestsPage() {
  return <LeaveRequestsPage escalatedOnly />;
}

export function SpecialApprovalLeavePage() {
  return <LeaveRequestsPage specialOnly />;
}
