/** Reject malformed, negative and unsafe page numbers before database offsets. */
export function blogPageNumber(value?: string): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1
  const page = Number(value)
  return Number.isSafeInteger(page) && page <= 100000 ? page : 1
}

export function blogPagePath(basePath: string, page: number): string {
  return page > 1 ? `${basePath}?page=${page}` : basePath
}
