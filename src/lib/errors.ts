/**
 * Detects if an error indicates the user rejected/cancelled a transaction.
 * Handles various error formats from wagmi, viem, ethers, and wallet providers.
 */
export function isUserRejection(error: unknown): boolean {
  if (!error) return false;

  const err = error as Record<string, unknown>;
  const code = err.code ?? err.errorCode;
  if (code === 4001 || code === 5000 || code === "ACTION_REJECTED") {
    return true;
  }

  const messages: string[] = [];
  if (err.message && typeof err.message === "string") messages.push(err.message);
  if (err.shortMessage && typeof err.shortMessage === "string")
    messages.push(err.shortMessage);
  if (err.reason && typeof err.reason === "string") messages.push(err.reason);
  if (err.details && typeof err.details === "string") messages.push(err.details);

  const nested = err.cause as Record<string, unknown> | undefined;
  if (nested?.message && typeof nested.message === "string")
    messages.push(nested.message);
  if (nested?.code === 4001 || nested?.code === 5000) return true;

  const info = err.info as Record<string, unknown> | undefined;
  const infoError = info?.error as Record<string, unknown> | undefined;
  if (infoError?.message && typeof infoError.message === "string")
    messages.push(infoError.message);
  if (infoError?.code === 4001 || infoError?.code === 5000) return true;

  const full = messages.join(" ").toLowerCase();
  return /reject|cancel|denied|user\s*rejected|action_rejected|ethers-user-denied|request rejected/i.test(
    full
  );
}

/**
 * Returns a user-friendly error message for payment/transaction failures.
 * Parses common error patterns (revert, insufficient balance, gas, etc.).
 */
export function getUserFriendlyPaymentError(error: unknown): string {
  if (!error) return "Payment failed. Please try again.";
  if (isUserRejection(error)) return "Transaction cancelled.";

  const err = error as Record<string, unknown>;
  const msg = (
    (err.message as string) ??
    (err.shortMessage as string) ??
    String(error)
  ).toLowerCase();
  const code = err.code ?? err.errorCode;

  // Insufficient gas / low gas token balance
  if (
    /insufficient funds|insufficient balance for gas|cannot afford|not enough.*gas|gas required exceeds|exceeds balance|need more.*gas/i.test(
      msg
    ) ||
    code === "INSUFFICIENT_FUNDS"
  ) {
    return "Insufficient funds for gas. Add more native token (ETH/USD) to pay for transaction fees.";
  }

  // Low gas limit / intrinsic gas too low / out of gas
  if (
    /intrinsic gas too low|gas too low|out of gas|gas limit exceeded|exceeds block gas limit|transaction ran out of gas/i.test(
      msg
    )
  ) {
    return "Gas limit too low. Try again with a higher gas limit or retry the transaction.";
  }

  // Transaction execution reverted (CALL_EXCEPTION)
  if (code === "CALL_EXCEPTION" || msg.includes("execution reverted") || msg.includes("transaction execution reverted")) {
    if (/exceeds balance|insufficient.*balance|transfer amount exceeds/i.test(msg)) {
      return "Insufficient token balance.";
    }
    if (/allowance|approve/i.test(msg)) {
      return "Insufficient allowance. Approve the token first.";
    }
    return "Transaction failed. Check your balance and try again.";
  }

  // Recipient confidential account not initialized
  if (/recipient.*confidential|recipient.*no confidential|confidential account/i.test(msg)) {
    return "Initialize recipient confidential account first.";
  }

  // Network / timeout
  if (/network|timeout|fetch|connection refused/i.test(msg)) {
    return "Network error. Please try again.";
  }

  return "Payment failed. Please try again.";
}
