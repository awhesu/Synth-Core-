# Syntherium vs EZGas Separation Doctrine

## Core Principle

**Syntherium is the truth layer. EZGas is a client.**

This document establishes the non-negotiable separation between Syntherium (the platform) and EZGas (a consumer application).

---

## What is Syntherium?

Syntherium is an **API-first infrastructure platform** that provides:

- Order management APIs
- Payment intent lifecycle
- Webhook processing and verification
- Financial settlement and ledger management
- Operational visibility tools

Syntherium is **provider-agnostic** and can serve multiple client applications.

---

## What is EZGas?

EZGas is a **client application** that:

- Provides the customer-facing mobile/web interface
- Consumes Syntherium APIs
- Handles user authentication and profiles
- Manages vendor-specific UI/UX
- Implements business logic specific to the EZGas brand

---

## The Doctrine

### 1. EZGas Must Never Decide "Paid" Based on Redirect

❌ **WRONG**: Marking an order as paid because the payment gateway redirected the user back to the app.

✅ **CORRECT**: Only marking an order as paid when Syntherium reports `paymentStatus: SETTLED`.

**Why?**: Payment redirects can be spoofed, interrupted, or fail silently. Only the settlement service, after verifying the webhook, knows the true payment state.

```
// EZGas client code - WRONG
if (redirectedFromPaymentGateway) {
  markOrderAsPaid(); // ❌ NEVER DO THIS
}

// EZGas client code - CORRECT
const status = await syntherium.get(`/orders/${orderId}/financial-status`);
if (status.isPaid && status.paymentStatus === 'SETTLED') {
  showPaidConfirmation(); // ✅ Trust the truth layer
}
```

### 2. Only SETTLED Means Paid

The payment intent status lifecycle:

```
PENDING → INITIATED → CONFIRMING → SETTLED
                                    ↑
                              ONLY HERE = PAID
```

- `PENDING`: Intent created, no payment started
- `INITIATED`: User started payment flow
- `CONFIRMING`: Webhook received, being processed
- `SETTLED`: **Money confirmed in escrow** ← This is the ONLY paid state
- `FAILED`: Payment failed
- `EXPIRED`: Payment window closed
- `REFUNDED`: Money returned

**Rule**: Do not show "Payment Successful" until `status === 'SETTLED'`.

### 3. No Manual Balance Edits

❌ **PROHIBITED**:
- Direct database edits to wallet balances
- Admin panels that modify ledger entries
- Scripts that "fix" financial discrepancies by editing records

✅ **REQUIRED**:
- All financial changes go through the settlement service
- Corrections create NEW ledger entries (never modify old ones)
- Audit trail is preserved for all changes

### 4. No Ledger Mutation

The ledger is **append-only**. This means:

- Entries are NEVER updated
- Entries are NEVER deleted
- Corrections create NEW entries
- Refunds create NEW entries
- The hash chain preserves integrity

If there's a mistake:
```
// Wrong entry exists:
Entry #42: CREDIT PLATFORM_ESCROW 10000 NGN (mistake)

// Correct it with a NEW entry:
Entry #43: DEBIT PLATFORM_ESCROW 10000 NGN (correction for #42)
Entry #44: CREDIT PLATFORM_ESCROW 5000 NGN (correct amount)
```

### 5. EZGas Does Not Access the Database Directly

❌ **WRONG**: EZGas backend connecting to the same PostgreSQL database.

✅ **CORRECT**: EZGas communicates only via Syntherium APIs.

This ensures:
- Single source of truth
- API versioning and deprecation control
- Security boundary
- Independent scaling

---

## Consequences of Violation

| Violation | Consequence |
|-----------|-------------|
| Marking paid on redirect | Revenue loss, fraud vulnerability |
| Manual balance edits | Audit failure, legal liability |
| Ledger mutation | Chain integrity broken, unrecoverable |
| Direct DB access | Data inconsistency, security breach |

---

## Compliance Checklist for EZGas Development

- [ ] Never trust payment redirects for paid status
- [ ] Always poll `/financial-status` for true payment state
- [ ] Never display "Payment Successful" until SETTLED
- [ ] All financial operations go through Syntherium APIs
- [ ] No direct database connections from EZGas
- [ ] Admin corrections use proper API endpoints

---

## Questions?

If you're unsure whether an implementation violates this doctrine, ask:

> "Am I trusting something other than Syntherium's SETTLED status for financial truth?"

If yes, redesign the implementation.
