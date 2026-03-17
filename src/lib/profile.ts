/**
 * Lightweight user profile — stored off-chain.
 * Created on first wallet connect. Optional displayName and email.
 *
 * Storage: localStorage (demo). For production, use Supabase, Firebase, or IPFS.
 * See docs/ARCHITECTURE.md for storage options.
 */

export type Profile = {
  walletAddress: string;
  displayName?: string;
  email?: string;
  emailRemindersOptIn?: boolean;
};

const STORAGE_KEY = "fairysplit_profiles";

function getProfiles(): Record<string, Profile> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setProfiles(profiles: Record<string, Profile>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  window.dispatchEvent(new Event("fairysplit-profile-updated"));
}

export function getProfile(walletAddress: string): Profile | null {
  const profiles = getProfiles();
  return profiles[walletAddress.toLowerCase()] ?? null;
}

export function setProfile(profile: Profile) {
  const profiles = getProfiles();
  profiles[profile.walletAddress.toLowerCase()] = profile;
  setProfiles(profiles);
}

export function createOrUpdateProfile(
  walletAddress: string,
  updates: Partial<Omit<Profile, "walletAddress">>
): Profile {
  const existing = getProfile(walletAddress);
  const profile: Profile = {
    walletAddress: walletAddress.toLowerCase(),
    ...existing,
    ...updates,
  };
  setProfile(profile);
  return profile;
}

export function clearProfile(walletAddress: string): void {
  const profiles = getProfiles();
  delete profiles[walletAddress.toLowerCase()];
  setProfiles(profiles);
}
