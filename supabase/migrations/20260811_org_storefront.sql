-- Phase 2A: org-branded public storefront (subdomain + /storefront/{slug}).
-- One jsonb blob for the editable content; columns only where queried.

alter table organizations add column if not exists storefront_enabled boolean not null default false;
alter table organizations add column if not exists storefront jsonb;

comment on column organizations.storefront is
  'Storefront content, admin-managed: { tagline, description, address, phone, public_email, website, hours, socials{instagram,facebook,tiktok,youtube,x}, photos[storage paths], slab{pattern, colors[]} }';
