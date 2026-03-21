import { permanentRedirect } from 'next/navigation';

export default function DemoRedirectPage() {
  permanentRedirect('/');
}
