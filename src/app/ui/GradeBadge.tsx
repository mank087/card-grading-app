"use client";

import Image from "next/image";

interface GradeBadgeProps {
  conditionGrade: number | string | null;
  aiConfidence: string | null;
}

export default function GradeBadge({ conditionGrade, aiConfidence }: GradeBadgeProps) {
  // Don't render if we don't have the necessary data
  if (!conditionGrade || !aiConfidence) {
    return null;
  }

  return (
    <div className="flex justify-center mt-6 mb-8">
      <div className="flex items-center bg-white border-2 border-gray-300 rounded-lg shadow-lg px-6 py-4 space-x-4">
        {/* DCM Logo */}
        <div className="flex-shrink-0">
          <Image
            src="/DCM-logo.png"
            alt="DCM Logo"
            width={50}
            height={50}
            className="object-contain"
          />
        </div>

        {/* Vertical divider */}
        <div className="h-12 w-px bg-gray-300"></div>

        {/* Grade Score */}
        <div className="flex flex-col items-center">
          {/* Condition Grade Number */}
          <div
            className="text-3xl font-bold leading-none"
            style={{ color: '#4E1861' }}
          >
            {conditionGrade}
          </div>

          {/* Horizontal line */}
          <div
            className="w-8 h-0.5 my-1"
            style={{ backgroundColor: '#4E1861' }}
          ></div>

          {/* AI Confidence Score */}
          <div
            className="text-lg font-semibold leading-none"
            style={{ color: '#4E1861' }}
          >
            {aiConfidence}
          </div>
        </div>
      </div>
    </div>
  );
}