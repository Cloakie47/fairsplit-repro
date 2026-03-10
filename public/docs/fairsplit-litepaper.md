# FairySplit Litepaper (Summary)

## Abstract
FairySplit is a USDC-first split payment app for friends, roommates, teams, and communities. It combines easy group expense coordination with optional confidential settlement flows.

## Problem
Most split apps are either convenient but hard to verify, or verifiable but not user-friendly. Users also need flexibility between transparent and privacy-sensitive payments.

## Solution
FairySplit provides:
- Bill creation with participant tracking
- Onchain settlement in USDC
- Optional confidential payment support
- Chain-aware activity logs with explorer links
- Reminder and request coordination features

## Core Features
- Create and manage splits with per-person USDC amounts
- Track paid/unpaid participant status
- Direct and confidential transfer flows
- Pending confidential balance claim support
- ENS/Basename-friendly recipient inputs (where supported)
- Mobile-friendly wallet-first UX

## Architecture
- Next.js App Router frontend
- Wallet integration via wagmi/viem/ethers
- BillSplitter smart contract for bill lifecycle and payment state
- StableTrust integration for confidential wallet operations

## Security and Reliability Notes
- Onchain settlement provides verifiable payment state
- Explicit chain labels and tx explorer links reduce ambiguity
- Fallback identity display avoids blocking UX when name resolution fails

## Current Network Scope
- Base Sepolia
- ARC Testnet

## Vision
FairySplit aims to become a trusted onchain coordination layer for USDC group payments, balancing usability, verifiability, and privacy.
