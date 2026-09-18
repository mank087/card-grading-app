/** Read a terminal inspection outcome without consuming the caller's response. */
export async function readIncompleteInspectionMessage(response: Response): Promise<string | null> {
  try {
    const data = await response.clone().json();
    if (data?.code !== 'INSPECTION_INCOMPLETE' || data?.inspection_incomplete !== true) return null;
    const message = 'Inspection incomplete. We could not finish a reliable grade.';
    if (data.credit_refund_status === 'not_charged') {
      return `${message} No grading credit was charged for this attempt. Contact support for help with this submission.`;
    }
    return data.credit_refunded === true
      ? `${message} Your grading credit was refunded. Contact support for help with this submission.`
      : `${message} We could not confirm a credit refund. Please contact support before submitting this card again.`;
  } catch { return null; }
}
