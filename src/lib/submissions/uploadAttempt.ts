/** One in-memory intake attempt. Retries reuse the draft and never re-upload after commit may have started. */
export interface UploadAttempt {
  id: string | null
  uploaded: boolean
  pending: Promise<string> | null
}
export function createUploadAttempt(): UploadAttempt { return { id: null, uploaded: false, pending: null } }
export function runUploadAttempt(attempt: UploadAttempt, operations: {
  create: () => Promise<string>
  upload: (id: string) => Promise<void>
  commit: (id: string) => Promise<void>
}): Promise<string> {
  if (attempt.pending) return attempt.pending
  const run = async () => {
    if (!attempt.id) attempt.id = await operations.create()
    if (!attempt.uploaded) { await operations.upload(attempt.id); attempt.uploaded = true }
    await operations.commit(attempt.id)
    return attempt.id
  }
  attempt.pending = run().finally(() => { attempt.pending = null })
  return attempt.pending
}
