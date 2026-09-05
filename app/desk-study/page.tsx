import type { Metadata } from 'next';
import { DeskStudy } from '@/components/desk/DeskStudy';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Deco-futurist desk study',
  description: 'An interactive design study for Claflin: arrival, conversation, and paper-instruction review. Not a live brokerage service.',
  robots: { index: false, follow: false },
};

export default function DeskStudyPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <DeskStudy />;
}
