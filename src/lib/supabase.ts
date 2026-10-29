import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Split functions

export async function saveSplit({
  splitId,
  chainId,
  contractAddress,
  creatorAddress,
  name,
  description,
  totalAmount,
  splitType,
  participantCount,
}: {
  splitId: string
  chainId: number
  contractAddress: string
  creatorAddress: string
  name: string
  description?: string
  totalAmount: string
  splitType: number
  participantCount: number
}) {
  const { data, error } = await supabase
    .from('splits')
    .insert({
      split_id: splitId,
      chain_id: chainId,
      contract_address: contractAddress,
      contract_version: 'v2',
      creator_address: creatorAddress.toLowerCase(),
      name,
      description: description || '',
      total_amount: totalAmount,
      split_type: splitType,
      participant_count: participantCount,
      status: 'active',
    })
  if (error) throw error
  return data
}

export async function saveParticipants(
  splitId: string,
  chainId: number,
  participants: { address: string; customAmount?: string }[]
) {
  const rows = participants.map((p) => ({
    split_id: splitId,
    chain_id: chainId,
    wallet_address: p.address.toLowerCase(),
    custom_amount: p.customAmount || null,
    status: 'pending',
  }))

  const { data, error } = await supabase
    .from('participants')
    .insert(rows)
  if (error) throw error
  return data
}

export async function getSplitsByCreator(creatorAddress: string) {
  const { data, error } = await supabase
    .from('splits')
    .select('*')
    .eq('creator_address', creatorAddress.toLowerCase())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getSplitsByParticipant(walletAddress: string) {
  const { data, error } = await supabase
    .from('participants')
    .select('split_id, chain_id')
    .eq('wallet_address', walletAddress.toLowerCase())
  if (error) throw error
  return data
}

export async function getSplitMetadata(
  splitId: string,
  chainId: number
) {
  const { data, error } = await supabase
    .from('splits')
    .select('*')
    .eq('split_id', splitId)
    .eq('chain_id', chainId)
    .single()
  if (error) throw error
  return data
}

export async function getParticipantsForSplit(
  splitId: string,
  chainId: number
) {
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('split_id', splitId)
    .eq('chain_id', chainId)
  if (error) throw error
  return data
}

export async function updateParticipantStatus(
  splitId: string,
  chainId: number,
  walletAddress: string,
  status: 'paid'
) {
  const { error } = await supabase
    .from('participants')
    .update({
      status,
      paid_at: new Date().toISOString(),
    })
    .eq('split_id', splitId)
    .eq('chain_id', chainId)
    .eq('wallet_address', walletAddress.toLowerCase())
  if (error) throw error
}

export async function updateSplitStatus(
  splitId: string,
  chainId: number,
  status: 'settled' | 'cancelled'
) {
  const { error } = await supabase
    .from('splits')
    .update({ status })
    .eq('split_id', splitId)
    .eq('chain_id', chainId)
  if (error) throw error
}

// Friend functions

export async function saveFriend({
  ownerAddress,
  friendAddress,
  nickname,
  email,
}: {
  ownerAddress: string
  friendAddress: string
  nickname?: string
  email?: string
}) {
  const { data, error } = await supabase
    .from('friends')
    .upsert({
      owner_address: ownerAddress.toLowerCase(),
      friend_address: friendAddress.toLowerCase(),
      nickname: nickname || null,
      email: email || null,
    })
  if (error) throw error
  return data
}

export async function getFriends(ownerAddress: string) {
  const { data, error } = await supabase
    .from('friends')
    .select('*')
    .eq('owner_address', ownerAddress.toLowerCase())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function deleteFriend(
  ownerAddress: string,
  friendAddress: string
) {
  const { error } = await supabase
    .from('friends')
    .delete()
    .eq('owner_address', ownerAddress.toLowerCase())
    .eq('friend_address', friendAddress.toLowerCase())
  if (error) throw error
}

// User profile functions

export async function saveUserProfile({
  walletAddress,
  displayName,
  email,
  notificationOptIn,
}: {
  walletAddress: string
  displayName?: string
  email?: string
  notificationOptIn?: boolean
}) {
  const { data, error } = await supabase
    .from('users')
    .upsert({
      wallet_address: walletAddress.toLowerCase(),
      display_name: displayName || null,
      email: email || null,
      notification_opt_in: notificationOptIn || false,
    })
  if (error) throw error
  return data
}

export async function getUserProfile(walletAddress: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}
