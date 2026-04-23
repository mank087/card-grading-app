import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import FloatingCardsBackground from '../ui/FloatingCardsBackground';

export const metadata: Metadata = {
  title: 'Recommended Products | DCM Grading',
  description: 'Recommended card grading accessories and supplies. Card scanner stands, graded card slabs, and more to enhance your DCM grading experience.',
  keywords: 'card grading supplies, graded card slab, card scanner stand, trading card accessories, card protection',
};

interface Product {
  name: string;
  description: string;
  image: string;
  link: string;
  badge?: string;
}

const products: Product[] = [
  {
    name: 'Card Scanner Stand',
    description: 'Hands-free phone stand designed for photographing trading cards. Provides consistent overhead positioning and stable framing for the sharpest, most accurate grading photos. Adjustable height and angle for any card size.',
    image: '/shop/card-scanner-stand.jpg',
    link: 'https://www.amazon.com/dp/B0G4D5J8GG?th=1&linkCode=ll2&tag=dcmgrading-20&linkId=fe14feb53605799758759b454abbe0df&language=en_US&ref_=as_li_ss_tl',
    badge: 'Best for Photos',
  },
  {
    name: 'Magnetic Graded Slabs',
    description: 'Premium magnetic closure graded card slabs. Showcase your DCM-graded cards with a professional display-quality case. Easy open/close design with crystal-clear viewing on both sides. Perfect for high-value cards.',
    image: '/shop/magnetic-graded-slabs.jpg',
    link: 'https://www.amazon.com/dp/B0GK6PSGKQ?th=1&linkCode=ll2&tag=dcmgrading-20&linkId=cda52cb06ef2d75f7bdc4dd4e477ad42&language=en_US&ref_=as_li_ss_tl',
    badge: 'Premium Display',
  },
  {
    name: 'Traditional Graded Slabs',
    description: 'Classic snap-fit graded card slabs in bulk. The standard case for displaying DCM-graded cards with custom labels. Fits standard trading cards with room for front and back labels. Great value at 100 per pack.',
    image: '/shop/traditional-graded-slab.jpg',
    link: 'https://www.amazon.com/100-Trading-Baseball-Protectors-Position/dp/B0C369YLLB?crid=2ZI7KJFMHLCLP&dib=eyJ2IjoiMSJ9.BlYcX8UM51mGfxY15gjq5ggscmZs8o6M6w-aovlZ7ChlCmWFH5XkbiWloO5e8s_aFtzEeSTIYzjFsYCkCWyhKbuvvja0zH1013jY5L9By0HQDJYMIyCL0Vi5s4JSTQ1N5ezUqgmRfeaOAFV1wUbPm-CAYdAbP5GAlcVZykkWkL33LQKEhtJhUaC4kDFP5O9urGD8zSwLMApCNEe6jAqLJJ-7MVznY3xTU70B9w_Rq5EuqK5JdcMW-URuPNENEg0Y-eNf13mTzYDd77TMfV7iwQ-lDUWJNnpY8alOHclgeYk.bFW5shkmpgcX7E_QOWiShCd9VOf7xdGuylQ5qpn0Z9c&dib_tag=se&keywords=graded%2Bcard%2Bslab&qid=1776355006&sprefix=graded%2Bcard%2Bslab%2Caps%2C159&sr=8-7&th=1&linkCode=ll2&tag=dcmgrading-20&linkId=ff7b9f5641325f4b0a51fad3b2f4ae4c&language=en_US&ref_=as_li_ss_tl',
    badge: 'Best Value',
  },
];

function ProductCard({ product }: { product: Product }) {
  return (
    <a
      href={product.link}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="group bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden hover:shadow-xl hover:border-purple-300 transition-all duration-300 flex flex-col"
    >
      {/* Image */}
      <div className="relative bg-gray-50 p-6 flex items-center justify-center" style={{ minHeight: '280px' }}>
        <Image
          src={product.image}
          alt={product.name}
          width={300}
          height={300}
          className="object-contain max-h-[260px] w-auto group-hover:scale-105 transition-transform duration-300"
        />
        {product.badge && (
          <span className="absolute top-4 left-4 px-3 py-1 bg-purple-600 text-white text-xs font-semibold rounded-full shadow-sm">
            {product.badge}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-6 flex-1 flex flex-col">
        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-purple-700 transition-colors">
          {product.name}
        </h3>
        <p className="text-gray-600 text-sm leading-relaxed flex-1">
          {product.description}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-purple-600 font-semibold text-sm group-hover:text-purple-800 transition-colors">
            Shop on Amazon
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </span>
        </div>
      </div>
    </a>
  );
}

export default function ShopPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white relative">
      <FloatingCardsBackground />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Recommended Products
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Enhance your card grading experience with these hand-picked accessories and supplies.
          </p>
        </div>

        {/* Tip Banner */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-6 mb-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-purple-900 mb-1">Pro Tip: Better Photos = Better Grades</h3>
              <p className="text-purple-700">
                Using a scanner stand for consistent, overhead photos can significantly improve your image quality scores.
                Higher confidence means tighter grade accuracy and more reliable results from DCM Optic.
              </p>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {products.map((product) => (
            <ProductCard key={product.name} product={product} />
          ))}
        </div>

        {/* Labels CTA */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Already have your slabs?
          </h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Design and print custom grading labels for your slabs, top loaders, and magnetic one-touch holders
            with our Label Studio.
          </p>
          <Link
            href="/labels"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors shadow-md"
          >
            Open Label Studio
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </main>
  );
}
