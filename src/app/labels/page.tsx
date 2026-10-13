/**
 * /labels — server shell. The Label Wizard is client-only (auth + collection
 * load), so the guide copy is rendered here on the server, below it: it ships
 * in the initial HTML for search and answer engines, and the wizard's growing
 * steps push it further down the page. /labels/classic doesn't get it.
 */

import LabelsPageClient from './LabelsPageClient'
import LabelsGuide from '@/components/labelWizard/LabelsGuide'
import LabelsGuideFrame from '@/components/labelWizard/LabelsGuideFrame'

export default function LabelsPage() {
  return (
    <>
      <LabelsPageClient />
      <LabelsGuideFrame>
        <LabelsGuide />
      </LabelsGuideFrame>
    </>
  )
}
