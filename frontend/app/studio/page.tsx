import type { Metadata } from 'next';
import StudioPage from '@/components/StudioPage';

export const metadata: Metadata = {
  title: 'Debate studio · CETLOE Debate AI',
  description: 'Live voice debate session with AI coaching.',
};

export default function StudioRoute() {
  return <StudioPage />;
}
