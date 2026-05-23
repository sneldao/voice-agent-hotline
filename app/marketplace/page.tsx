import { permanentRedirect } from 'next/navigation';

// #28: /marketplace is a legacy duplicate of the main page. Redirect.
export default function MarketplaceRedirectPage() {
  permanentRedirect('/');
}
