/**
 * SectionDefects — renders the defect findings of one subgrade section
 * (corners/edges/surface, one face) including zoom-inspection findings and
 * their magnified evidence photos.
 *
 * Zoom findings were previously displayed only for Surface sections; corner
 * and edge findings (where most zoom caps land) were dropped, leaving capped
 * scores next to write-ups that showed nothing.
 */

interface SectionDefect {
  type?: string;
  severity?: string;
  location?: string;
  size?: string;
  description?: string;
  source?: string;
  evidence_url?: string | null;
}

export default function SectionDefects({ defects, accent = 'blue' }: { defects?: SectionDefect[] | null; accent?: 'blue' | 'purple' }) {
  if (!defects || !Array.isArray(defects) || defects.length === 0) return null;
  const c = accent === 'purple'
    ? { title: 'text-purple-900', box: 'bg-purple-50 border-purple-200', head: 'text-purple-900', link: 'text-purple-600' }
    : { title: 'text-blue-900', box: 'bg-blue-50 border-blue-200', head: 'text-blue-900', link: 'text-blue-600' };
  return (
    <div className="mb-3 space-y-2">
      <div className={`text-xs font-semibold ${c.title} mb-1`}>Findings:</div>
      {defects.map((defect, idx) => (
        <div key={idx} className={`p-2 rounded border ${c.box}`}>
          <div className={`text-xs font-semibold ${c.head} mb-1`}>
            {defect.type || 'Defect'} {defect.severity && `(${defect.severity})`}
            {defect.source === 'zoom-inspection' && (
              <span className="ml-2 font-normal text-gray-500">found under magnification</span>
            )}
          </div>
          {defect.location && (
            <p className="text-xs text-gray-600 mb-1"><strong>Location:</strong> {defect.location}</p>
          )}
          {defect.description && (
            <p className="text-xs text-gray-700">{defect.description}</p>
          )}
          {defect.evidence_url && (
            <a href={defect.evidence_url} target="_blank" rel="noreferrer" className={`text-xs ${c.link} underline`}>
              View magnified evidence photo
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
