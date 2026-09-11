-- 2026-09-11: answer-engine fields for blog posts.
-- quick_answer: two or three sentences that answer the post's title question,
--               rendered in a summary box under the title.
-- faq:          [{ "question": "...", "answer": "..." }] rendered at the end of
--               the post and emitted as FAQPage structured data.
alter table public.blog_posts
  add column if not exists quick_answer text,
  add column if not exists faq jsonb not null default '[]'::jsonb;
