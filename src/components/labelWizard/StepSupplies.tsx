/**
 * Label Wizard — Step 6 (optional): supplies.
 *
 * Shown after the labels are downloaded, because that's the moment the user
 * discovers what they still need: cases to put the labels in, and a trimmer
 * to cut them straight. Recommendations are ordered by what they actually
 * chose in the wizard — Zion sizing or a one-touch holder puts the matching
 * magnetic cases first — and the paper cutter always anchors the bottom
 * since it applies to every path.
 *
 * Every link is an Amazon Associates link from lib/shopProducts (one source
 * of truth shared with /shop), with the disclosure the Associates agreement
 * requires wherever those links appear.
 */
'use client'

import React from 'react'
import Link from 'next/link'
import { productsForHolder, productUrl, type Product } from '@/lib/shopProducts'
import type { HolderType, SlabSizeId } from './wizardTypes'

interface StepSuppliesProps {
  holder: HolderType | null
  slabSize: SlabSizeId
  /** True once the user has generated a sheet — tunes the intro copy. */
  hasDownloaded?: boolean
}

function ProductCard({ product, featured }: { product: Product; featured?: boolean }) {
  return (
    <a
      href={productUrl(product)}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`group flex gap-3 rounded-xl border bg-white p-3 transition-all hover:shadow-md ${
        featured ? 'border-purple-300 ring-1 ring-purple-100' : 'border-gray-200 hover:border-purple-300'
      }`}
    >
      <div className="w-20 h-20 shrink-0 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
        {/* Plain <img>: these are self-hosted product shots at small sizes,
            and next/image's optimizer adds nothing at 80px. */}
        <img
          src={product.image}
          alt={product.name}
          className="max-h-[72px] w-auto object-contain group-hover:scale-105 transition-transform"
          loading="lazy"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-purple-700">
            {product.name}
          </p>
          {product.badge && (
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-semibold">
              {product.badge}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-1 leading-snug">{product.shortDescription}</p>
        <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-purple-600 group-hover:text-purple-800">
          View on Amazon
          <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </span>
      </div>
    </a>
  )
}

export function StepSupplies({ holder, slabSize, hasDownloaded }: StepSuppliesProps) {
  const products = productsForHolder(holder, slabSize)
  // The trimmer anchors the bottom on every path; cases sit above it.
  const cutter = products.find(p => p.id === 'paper-cutter')
  const cases = products.filter(p => p.id !== 'paper-cutter')

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">Everything else you&apos;ll need</h2>
      <p className="text-sm text-gray-500 mb-5">
        {hasDownloaded
          ? 'Your labels are ready — here’s what to put them in, and what to cut them with.'
          : 'Optional — the cases and tools that pair with the labels you just designed.'}
      </p>

      {slabSize === 'zion' && holder === 'slab' && (
        <div className="mb-4 px-3.5 py-2.5 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-800">
          You designed at Zion Mag Pro size — the Zion MagPro case below is the holder those labels are cut for.
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        {cases.map((p, i) => (
          <ProductCard key={p.id} product={p} featured={i === 0} />
        ))}
      </div>

      {cutter && (
        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Cut your labels cleanly
          </p>
          <ProductCard product={cutter} />
        </div>
      )}

      <p className="text-[11px] text-gray-400 mt-5 leading-relaxed">
        As an Amazon Associate, DCM Grading earns from qualifying purchases. These are affiliate links — they
        cost you nothing extra and help support the platform.{' '}
        <Link href="/shop" className="underline hover:text-purple-600">
          See all recommended products
        </Link>
        .
      </p>
    </div>
  )
}

export default StepSupplies
