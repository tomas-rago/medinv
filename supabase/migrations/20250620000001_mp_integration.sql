-- ============================================================
-- Mercado Pago integration
-- Adds subscription tracking columns to organizations and
-- a mp_plan_id reference column to plans.
-- ============================================================

alter table public.plans
  add column if not exists mp_plan_id text;

alter table public.organizations
  add column if not exists mp_subscription_id  text,
  add column if not exists subscription_status text not null default 'active'
    check (subscription_status in ('active', 'past_due', 'cancelled', 'pending')),
  add column if not exists billing_cycle        text not null default 'monthly'
    check (billing_cycle in ('monthly', 'annual')),
  add column if not exists current_period_end   timestamptz;
