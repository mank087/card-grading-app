import Link from 'next/link'

export const relatedGuides = [
  ['Grade your first card', '/grade-your-first-card'],
  ['How AI card grading works', '/ai-card-grading'],
  ['AI grading accuracy', '/ai-card-grading-accuracy'],
  ['Grading standard', '/grading-standard'],
  ['Grading rubric', '/grading-rubric'],
  ['Reports and labels', '/reports-and-labels'],
  ['Compare grading companies', '/card-grading-companies'],
  ['PSA alternative', '/psa-alternative'],
  ['Grading costs', '/cheapest-card-grading'],
  ['Grading turnaround', '/fastest-card-grading'],
  ['Population report', '/pop'],
  ['Pokémon grading', '/pokemon-grading'],
  ['Sports grading', '/sports-grading'],
  ['All card types', '/card-grading'],
] as const

export function RelatedGuides() {
  return <section className="dcm-section dcm-container dcm-related-guides" aria-labelledby="related-guides-heading">
    <h2 id="related-guides-heading">Explore grading guides and options</h2>
    <div>{relatedGuides.map(([title, href]) => <Link key={href} href={href}>{title}<span aria-hidden="true"> →</span></Link>)}</div>
  </section>
}
