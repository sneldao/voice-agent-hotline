import { permanentRedirect } from 'next/navigation';

// #28: /profile is a duplicate of the Profile tab on the main page. Redirect.
export default function ProfileRedirectPage() {
  permanentRedirect('/');
}
