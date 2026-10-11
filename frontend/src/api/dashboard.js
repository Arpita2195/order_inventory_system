import { getCached } from './client';

export const getDashboardSummary = () => getCached('/dashboard/summary');
