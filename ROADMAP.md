# Fairsplit Roadmap

## Where this is going

Fairsplit started as USDC-native bill splitting. The primitive underneath it is more useful than that: several parties, one shared pot, a fair rule for who owes what, settled without trusting an intermediary.

The next version applies that primitive before the meal instead of after the bill.

## The thesis

A restaurant needs a POS, a card terminal and a settlement account mainly to collect money from someone who has already eaten. Remove that and a merchant needs nothing but a printed QR and a phone.

That opens the sellers card rails never reached: street food, thattukada, home kitchens, festival stalls, beach shacks and pop-ups. They are cash-only because terminals and settlement accounts are out of reach, not by choice.

Pay-first only works if prepaying a stranger is safe. Escrow makes it safe: USDC is held, released on pickup or confirmation, auto-refunded on timeout. Web2 prepay cannot offer this because the merchant or the platform holds the funds and the buyer has no recourse.

Splitting becomes a property of the order. The group picks items, each share is known at order time, the kitchen sees one paid order.

## Pay-forward pools

Suspended meals have existed for a century and stay small for one reason: the merchant holds the money and nobody can verify a meal was ever served.

Onchain this becomes a public pooled balance at a named merchant. Anyone can fund it, the balance is visible, redemptions are logged, and the merchant cannot quietly keep it. Diaspora can fund a kitchen at home in USDC with no remittance friction.

This is the wedge. It brings the first merchants and the first attention.

## Phases

### Phase 1: Merchant-free order and escrow
- Merchant registry, no POS integration, QR per merchant or per table
- Menu as a signed structured object
- Order intent with USDC held in escrow
- Release on confirmation, auto-refund on timeout
- Group order with per-participant shares resolved at order time, reusing existing split settlement

### Phase 2: Pay-forward pools
- Public pooled balance per merchant
- Open funding from any wallet
- Redemption against the pool with an onchain log
- Public view of funded, redeemed and remaining

## FairEats

FairEats is the first build of Phase 1. One listed business, McFair, simulates a merchant storefront end to end.

- A Businesses page lists merchants. Clicking one opens that merchant's own storefront.
- Menu items carry a base price, size options and customisations, priced as they are selected.
- The cart holds quantity and the customisation summary for every line.
- Tables carry a table code. A customer locks in to an unoccupied table and occupied tables are visibly unavailable to everyone else. The occupant can release their own table, the merchant can release any of theirs, and a stale lock auto-releases on a timeout so a forgotten table does not stay occupied forever.
- Checkout offers pay alone or add participants. Adding participants settles the order through the existing Fairsplit split logic rather than a second settlement path. Paying alone leaves the same order splittable afterwards.
- Payment is USDC on Base.

Optional confidential payment uses Fairblock's Stabletrust SDK, and is offered on pay-alone orders only. Creating a split writes the order total onchain in plaintext, so the toggle is disabled once participants are added rather than promising a privacy it cannot deliver.

Confidentiality here encrypts amounts and balances. Sender and recipient addresses stay public. It is not anonymity, and the interface says "hide amount", never "anonymous". Participants in a split always see their own share, because shares are stored offchain.

Every order, table, menu and identity record stays offchain. Only the USDC settlement is onchain, and it carries no personal identifier.

This section targets Base only, built and tested on Base Sepolia. Other chains are out of scope for FairEats and unchanged elsewhere in the app.

## Agentic workflows

Deferred. No agents, no auctions and no automated merchant logic in this version. A public agent skill is worth publishing once real merchants are transacting, not before.

## Open risks

- On and off ramp. Merchants and diners hold rupees, not USDC. This is the thing most likely to kill the product, not the contracts.
- Merchant trust and first-run experience for sellers who have never used a wallet.
- Regulatory treatment of prepaid balances and pooled funds.

## What is already built

USDC-native expense splitting with a tiered fee structure, live on Arc Testnet, Base Sepolia, Tempo Testnet and Base Mainnet, with optional confidential settlement and Supabase persistence. The multi-party settlement logic carries directly into Phase 1.
