import { createContext, useContext } from 'react';
import type { Profile } from './domain';
export const ProfileContext = createContext<Profile | null>(null);

export function useProfile() {
  const profile = useContext(ProfileContext);
  if (!profile) throw new Error('User profile is required inside the authenticated application');
  return profile;
}
