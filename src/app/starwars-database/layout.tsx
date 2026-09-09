import { publicPageMetadata } from '@/lib/seo/pageMetadata'

export const metadata = publicPageMetadata("/starwars-database", "Star Wars Card Database: Browse Cards and Sets", "Explore Star Wars trading cards and sets, review available card details and prices, and grade your own cards with DCM Optic.")

export default function Layout({ children }: { children: React.ReactNode }) { return children }
