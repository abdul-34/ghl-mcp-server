// Hand-written catalog for tools NOT emitted by generate-tools.mjs
// (workflow-builder, workflow public/insights, and the ported categories).
// Merged into TOOL_CATALOG so the dashboard link tool-picker can whitelist them.
// Keep in sync with src/tools/workflow-*.ts and src/tools/ported/*.
import type { ToolGroup } from "./tools-catalog";

export const MANUAL_TOOL_CATALOG: ToolGroup[] = [
  {
    "category": "Workflows",
    "tools": [
      "ghl_create_workflow",
      "crm_search_native_workflow_modules",
      "crm_get_native_workflow_module",
      "crm_search_workflow_modules",
      "crm_get_workflow_module",
      "ghl_list_workflows_full",
      "ghl_get_workflow_full",
      "ghl_update_workflow_actions",
      "ghl_delete_workflow",
      "ghl_publish_workflow",
      "ghl_clone_workflow",
      "ghl_get_workflows",
      "ghl_list_workflows",
      "ghl_get_workflow",
      "ghl_update_workflow_status",
      "ghl_trigger_workflow",
      "ghl_get_workflow_executions"
    ]
  },
  {
    "category": "Workflow Insights",
    "tools": [
      "audit_location_ads_setup",
      "summarize_email_campaign_performance",
      "find_uncontacted_form_leads",
      "summarize_calendar_availability"
    ]
  },
  {
    "category": "Reputation",
    "tools": [
      "get_reviews",
      "get_review",
      "reply_to_review",
      "update_review_reply",
      "delete_review_reply",
      "get_review_stats",
      "send_review_request",
      "get_review_requests",
      "get_connected_review_platforms",
      "connect_google_business",
      "disconnect_review_platform",
      "get_review_links",
      "update_review_links",
      "get_review_widget_settings",
      "update_review_widget_settings"
    ]
  },
  {
    "category": "Reporting",
    "tools": [
      "get_attribution_report",
      "get_call_reports",
      "get_appointment_reports",
      "get_pipeline_reports",
      "get_email_reports",
      "get_sms_reports",
      "get_funnel_reports",
      "get_ad_reports",
      "get_agent_reports",
      "get_dashboard_stats",
      "get_conversion_reports",
      "get_revenue_reports"
    ]
  },
  {
    "category": "Templates",
    "tools": [
      "get_sms_templates",
      "get_sms_template",
      "create_sms_template",
      "update_sms_template",
      "delete_sms_template",
      "get_voicemail_templates",
      "create_voicemail_template",
      "delete_voicemail_template",
      "get_social_templates",
      "create_social_template",
      "delete_social_template",
      "get_whatsapp_templates",
      "create_whatsapp_template",
      "delete_whatsapp_template",
      "get_snippets",
      "create_snippet",
      "update_snippet",
      "delete_snippet"
    ]
  },
  {
    "category": "Voice AI",
    "tools": [
      "list_voice_ai_agents",
      "create_voice_ai_agent",
      "get_voice_ai_agent",
      "update_voice_ai_agent",
      "delete_voice_ai_agent",
      "create_voice_ai_action",
      "get_voice_ai_action",
      "update_voice_ai_action",
      "delete_voice_ai_action",
      "list_voice_ai_call_logs",
      "get_voice_ai_call_log"
    ]
  },
  {
    "category": "Smart Lists",
    "tools": [
      "get_smart_lists",
      "get_smart_list",
      "create_smart_list",
      "update_smart_list",
      "delete_smart_list",
      "get_smart_list_contacts",
      "get_smart_list_count",
      "duplicate_smart_list"
    ]
  },
  {
    "category": "Webhooks",
    "tools": [
      "get_webhooks",
      "get_webhook",
      "create_webhook",
      "update_webhook",
      "delete_webhook",
      "get_webhook_events",
      "get_webhook_logs",
      "retry_webhook",
      "test_webhook"
    ]
  },
  {
    "category": "Workflow Triggers",
    "tools": [
      "get_triggers",
      "get_trigger",
      "create_trigger",
      "update_trigger",
      "delete_trigger",
      "enable_trigger",
      "disable_trigger",
      "get_trigger_types",
      "get_trigger_logs",
      "test_trigger",
      "duplicate_trigger"
    ]
  },
  {
    "category": "Notes",
    "tools": [
      "create_note",
      "search_notes",
      "get_note",
      "update_note",
      "delete_note",
      "update_note_attachments",
      "update_note_relations",
      "restore_note"
    ]
  },
  {
    "category": "Users",
    "tools": [
      "get_users",
      "get_user",
      "create_user",
      "update_user",
      "delete_user",
      "search_users",
      "filter_users_by_email"
    ]
  },
  {
    "category": "LC Phone (extended)",
    "tools": [
      "get_phone_numbers",
      "get_phone_number",
      "search_available_numbers",
      "purchase_phone_number",
      "update_phone_number",
      "release_phone_number",
      "get_call_forwarding_settings",
      "update_call_forwarding",
      "get_ivr_menus",
      "create_ivr_menu",
      "update_ivr_menu",
      "delete_ivr_menu",
      "get_voicemail_settings",
      "update_voicemail_settings",
      "get_voicemails",
      "delete_voicemail",
      "get_caller_ids",
      "add_caller_id",
      "verify_caller_id",
      "delete_caller_id"
    ]
  }
];
