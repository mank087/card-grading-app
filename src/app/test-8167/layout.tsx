import { privatePageMetadata } from '@/lib/seo/pageMetadata'

export const metadata = privatePageMetadata("Internal Test")

export default function Layout({ children }: { children: React.ReactNode }) { return children }
