import { describe, expect, it, vi } from 'vitest'
import { createUploadAttempt, runUploadAttempt } from './uploadAttempt'

describe('bulk upload retries', () => {
  it('does not commit incomplete uploads and reuses their draft on retry', async () => {
    const attempt = createUploadAttempt()
    const ops = { create: vi.fn().mockResolvedValue('draft-1'), upload: vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(undefined), commit: vi.fn().mockResolvedValue(undefined) }
    await expect(runUploadAttempt(attempt, ops)).rejects.toThrow('offline')
    expect(ops.commit).not.toHaveBeenCalled()
    expect(await runUploadAttempt(attempt, ops)).toBe('draft-1')
    expect(ops.create).toHaveBeenCalledTimes(1)
    expect(ops.commit).toHaveBeenCalledWith('draft-1')
  })
  it('retries the same commit without creating or overwriting cards after a lost response', async () => {
    const attempt = createUploadAttempt()
    const ops = { create: vi.fn().mockResolvedValue('draft-1'), upload: vi.fn().mockResolvedValue(undefined), commit: vi.fn().mockRejectedValueOnce(Error('response lost')).mockResolvedValue(undefined) }
    await expect(runUploadAttempt(attempt, ops)).rejects.toThrow()
    await runUploadAttempt(attempt, ops)
    expect(ops.create).toHaveBeenCalledTimes(1)
    expect(ops.upload).toHaveBeenCalledTimes(1)
    expect(ops.commit.mock.calls).toEqual([['draft-1'], ['draft-1']])
  })
  it('coalesces a second tap while a request is running', async () => {
    const attempt = createUploadAttempt()
    const ops = { create: vi.fn().mockResolvedValue('draft-1'), upload: vi.fn().mockResolvedValue(undefined), commit: vi.fn().mockResolvedValue(undefined) }
    const first = runUploadAttempt(attempt, ops)
    expect(runUploadAttempt(attempt, ops)).toBe(first)
    await first
    expect(ops.commit).toHaveBeenCalledTimes(1)
  })
  it('retains completed uploads while the user adds credits and retries the commit', async () => {
    const attempt = createUploadAttempt()
    const ops = { create: vi.fn().mockResolvedValue('draft-1'), upload: vi.fn().mockResolvedValue(undefined), commit: vi.fn().mockRejectedValueOnce(Object.assign(Error('Add credits'), { code: 'insufficient_credits' })).mockResolvedValue(undefined) }
    await expect(runUploadAttempt(attempt, ops)).rejects.toMatchObject({ code: 'insufficient_credits' })
    expect(attempt).toMatchObject({ id: 'draft-1', uploaded: true, pending: null })
    await runUploadAttempt(attempt, ops)
    expect(ops.create).toHaveBeenCalledTimes(1)
    expect(ops.upload).toHaveBeenCalledTimes(1)
    expect(ops.commit).toHaveBeenCalledTimes(2)
  })
})
