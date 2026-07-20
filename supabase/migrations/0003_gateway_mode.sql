-- CRM MCP — per-link tool gateway
--
-- When gateway_mode is true, a link exposes only the account-discovery tools
-- and the three gateway meta-tools (search_ghl_tools / get_ghl_tool_schema /
-- invoke_ghl_tool) instead of the full ~700-tool list. The full registry stays
-- reachable behind the gateway; this keeps tool schemas out of the model's
-- context until it searches for the operation it needs. The link's
-- enabled_tools whitelist still scopes what the gateway can find/invoke.

alter table public.mcp_links
  add column if not exists gateway_mode boolean not null default false;
