import { incompleteInspectionMessage } from './inspectionMessageText';

/** Read a terminal inspection outcome without consuming the caller's response. */
export async function readIncompleteInspectionMessage(response: Response): Promise<string | null> {
  try {
    return incompleteInspectionMessage(await response.clone().json());
  } catch { return null; }
}
