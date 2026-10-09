import { Redirect } from 'expo-router';

export default function SpendingRedirect() {
  return <Redirect href={{ pathname: '/investment', params: { section: 'pause' } }} />;
}
