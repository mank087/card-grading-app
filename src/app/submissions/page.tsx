import { redirect } from 'next/navigation'

/**
 * /submissions has no index page — bulk grading is entered from the upload
 * page ("Submit more than one card"), and a finished submission sends the user
 * to /collection rather than to a submissions list. The bare path was
 * therefore a 404 that people could still reach by trimming a URL back from
 * /submissions/<id>, or by typing it.
 *
 * Send them to the upload page, which is where a submission actually starts.
 *
 * This lives here rather than in next.config.ts on purpose: a route file is
 * self-contained and cannot affect host matching or /api, which is the class
 * of change that broke mobile auth and the Stripe webhooks on Sept 1.
 *
 * redirect() issues a TEMPORARY (307) redirect, which is what we want — if
 * /submissions ever becomes a real history page, no search engine or browser
 * is holding a permanent cache entry pointing it at /upload.
 */
export default function SubmissionsIndexPage() {
  redirect('/upload')
}
