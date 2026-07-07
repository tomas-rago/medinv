-- Tighten grants on the alerts SECURITY DEFINER functions (security advisor):
-- the trigger function is only ever invoked by the stock trigger (which runs
-- with the table owner's rights), so it needs no callable grant at all, and
-- the sweep RPC is for signed-in users only.
revoke execute on function _sync_low_stock_alert() from public, anon, authenticated;
revoke execute on function sweep_alerts() from public, anon;
