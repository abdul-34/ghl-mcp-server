// AUTO-GENERATED. Do not edit by hand. Run: node scripts/generate-tools.mjs
export interface ToolGroup { category: string; tools: string[]; }
export const TOOL_CATALOG: ToolGroup[] = [
  {
    "category": "Ad Manager",
    "tools": [
      "ads_fb_get_reporting",
      "ads_fb_get_campaign_reporting",
      "ads_fb_get_reporting_list",
      "ads_fb_get_current_user",
      "ads_fb_get_pages",
      "ads_fb_get_instagram_accounts",
      "ads_fb_get_page_lead_forms",
      "ads_fb_create_page_lead_form",
      "ads_fb_get_ad_accounts",
      "ads_fb_get_ad_account",
      "ads_fb_delete_ad_account",
      "ads_fb_get_conversation_forms",
      "ads_fb_create_conversation_form",
      "ads_fb_create_integration",
      "ads_fb_get_integration",
      "ads_fb_delete_integration",
      "ads_fb_search_targeting",
      "ads_fb_publish_campaign",
      "ads_fb_delete_page",
      "ads_fb_get_pixels",
      "ads_fb_upsert_pixel",
      "ads_fb_get_custom_audiences",
      "ads_fb_delete_custom_audience",
      "ads_fb_update_custom_audience",
      "ads_fb_get_custom_audience_by_id",
      "ads_fb_add_custom_audience_member",
      "ads_fb_remove_custom_audience_member",
      "ads_fb_batch_update_audience_members",
      "ads_fb_set_default_page",
      "ads_fb_get_lead_form",
      "ads_fb_get_campaign",
      "ads_fb_get_entity",
      "ads_fb_upsert_campaign",
      "ads_fb_upsert_adset",
      "ads_fb_upsert_ad",
      "ads_fb_pause_campaign",
      "ads_fb_resume_campaign",
      "ads_fb_duplicate_campaign",
      "ads_fb_delete_campaign",
      "ads_fb_pause_adset",
      "ads_fb_resume_adset",
      "ads_fb_duplicate_adset",
      "ads_fb_delete_adset",
      "ads_fb_pause_ad",
      "ads_fb_resume_ad",
      "ads_fb_duplicate_ad",
      "ads_fb_delete_ad",
      "ads_google_get_reporting",
      "ads_google_get_reporting_list",
      "ads_google_get_campaign_reporting",
      "ads_google_get_conversions",
      "ads_google_upsert_conversion",
      "ads_google_get_conversion_by_id",
      "ads_google_delete_conversion",
      "ads_google_get_integration",
      "ads_google_create_integration",
      "ads_google_get_current_user",
      "ads_google_get_ad_accounts",
      "ads_google_get_ad_account_details",
      "ads_google_delete_ad_account",
      "ads_google_publish_ad",
      "ads_google_search_targeting",
      "ads_google_get_keyword_ideas",
      "ads_google_get_assets",
      "ads_google_upsert_assets",
      "ads_google_get_entity",
      "ads_google_get_target_interests",
      "ads_google_get_segments",
      "ads_google_upsert_segment",
      "ads_google_delete_segment",
      "ads_google_get_segment_by_id",
      "ads_google_create_offline_user_list_job",
      "ads_google_upsert_audience",
      "ads_google_get_audiences",
      "ads_google_get_audience_by_id",
      "ads_google_upsert_campaign",
      "ads_google_get_campaign_by_id",
      "ads_google_get_conversion_goals",
      "ads_li_get_integration",
      "ads_li_create_integration",
      "ads_li_get_ad_accounts",
      "ads_li_get_ad_account_details",
      "ads_li_delete_ad_account",
      "ads_li_get_current_user",
      "ads_li_get_campaign_group",
      "ads_li_publish_campaign_group",
      "ads_li_upsert_campaign_group",
      "ads_li_search_targeting",
      "ads_li_get_lead_forms",
      "ads_li_create_lead_form",
      "ads_li_update_ad_status",
      "ads_li_get_ad_analytics",
      "ads_li_get_reporting_list",
      "ads_li_get_campaign_group_reporting"
    ]
  },
  {
    "category": "Affiliate Manager",
    "tools": [
      "affiliate_list_affiliates",
      "affiliate_get_affiliate",
      "affiliate_list_payouts",
      "affiliate_list_commissions"
    ]
  },
  {
    "category": "AI Agent Studio",
    "tools": [
      "ai_agent_create_agent",
      "ai_agent_get_agents",
      "ai_agent_update_agent_version",
      "ai_agent_update_agent_metadata",
      "ai_agent_delete_agent",
      "ai_agent_get_agent_by_id",
      "ai_agent_promote_and_publish",
      "ai_agent_execute_agent",
      "ai_agent_get_agents_deprecated",
      "ai_agent_get_agent_by_id_deprecated",
      "ai_agent_execute_agent_deprecated"
    ]
  },
  {
    "category": "Associations",
    "tools": [
      "associations_create_relation",
      "associations_get_relations_by_record_id",
      "associations_delete_relation",
      "associations_get_association_key_by_key_name",
      "associations_get_association_by_object_keys",
      "associations_update_association",
      "associations_delete_association",
      "associations_get_association_by_id",
      "associations_create_association",
      "associations_find_associations"
    ]
  },
  {
    "category": "Blogs",
    "tools": [
      "blogs_check_url_slug_exists",
      "blogs_update_blog_post",
      "blogs_create_blog_post",
      "blogs_get_all_blog_authors_by_location",
      "blogs_get_all_categories_by_location",
      "blogs_get_blog_post",
      "blogs_get_blogs"
    ]
  },
  {
    "category": "Brand Boards",
    "tools": [
      "brand_boards_get_brand_boards_by_location",
      "brand_boards_get_brand_board_by_id",
      "brand_boards_update_brand_board",
      "brand_boards_delete_brand_board",
      "brand_boards_create_brand_board"
    ]
  },
  {
    "category": "Business",
    "tools": [
      "business_update_business",
      "business_delete_business",
      "business_get_business",
      "business_get_businesses_by_location",
      "business_create_business"
    ]
  },
  {
    "category": "Calendars",
    "tools": [
      "calendars_get_groups",
      "calendars_create_calendar_group",
      "calendars_validate_groups_slug",
      "calendars_delete_group",
      "calendars_edit_group",
      "calendars_disable_group",
      "calendars_create_appointment",
      "calendars_edit_appointment",
      "calendars_get_appointment",
      "calendars_get_calendar_events",
      "calendars_get_blocked_slots",
      "calendars_create_block_slot",
      "calendars_edit_block_slot",
      "calendars_get_slots",
      "calendars_update_calendar",
      "calendars_get_calendar",
      "calendars_delete_calendar",
      "calendars_delete_event",
      "calendars_get_appointment_notes",
      "calendars_create_appointment_note",
      "calendars_update_appointment_note",
      "calendars_delete_appointment_note",
      "calendars_get_calendar_resource",
      "calendars_update_calendar_resource",
      "calendars_delete_calendar_resource",
      "calendars_fetch_calendar_resources",
      "calendars_create_calendar_resource",
      "calendars_get_event_notification",
      "calendars_create_event_notification",
      "calendars_find_event_notification",
      "calendars_update_event_notification",
      "calendars_delete_event_notification",
      "calendars_get_all_schedules",
      "calendars_get_schedule_by_id",
      "calendars_update_schedule",
      "calendars_delete_schedule",
      "calendars_create_schedule",
      "calendars_add_calendar_to_schedule",
      "calendars_remove_calendar_from_schedule",
      "calendars_get_calendars",
      "calendars_create_calendar"
    ]
  },
  {
    "category": "Campaigns",
    "tools": [
      "campaigns_get_campaigns"
    ]
  },
  {
    "category": "Chat Widget",
    "tools": [
      "chat_widget_list_chat_widget",
      "chat_widget_get_chat_widget",
      "chat_widget_update_chat_widget",
      "chat_widget_patch_chat_widget",
      "chat_widget_get_widget",
      "chat_widget_delete",
      "chat_widget_clone_chat_widget",
      "chat_widget_create_chat_widget"
    ]
  },
  {
    "category": "Companies",
    "tools": [
      "companies_get_company"
    ]
  },
  {
    "category": "Contacts",
    "tools": [
      "contacts_search_contacts_advanced",
      "contacts_get_duplicate_contact",
      "contacts_get_all_tasks",
      "contacts_create_task",
      "contacts_get_task",
      "contacts_update_task",
      "contacts_delete_task",
      "contacts_update_task_completed",
      "contacts_get_appointments_for_contact",
      "contacts_add_tags",
      "contacts_remove_tags",
      "contacts_get_all_notes",
      "contacts_create_note",
      "contacts_get_note",
      "contacts_update_note",
      "contacts_delete_note",
      "contacts_create_association",
      "contacts_add_remove_contact_from_business",
      "contacts_get_contact",
      "contacts_update_contact",
      "contacts_delete_contact",
      "contacts_upsert_contact",
      "contacts_get_contacts_by_business_id",
      "contacts_add_followers_contact",
      "contacts_remove_followers_contact",
      "contacts_add_contact_to_campaign",
      "contacts_remove_contact_from_campaign",
      "contacts_remove_contact_from_every_campaign",
      "contacts_add_contact_to_workflow",
      "contacts_delete_contact_from_workflow",
      "contacts_create_contact",
      "contacts_get_contacts"
    ]
  },
  {
    "category": "Conversation AI",
    "tools": [
      "conversation_ai_create_action",
      "conversation_ai_list_actions",
      "conversation_ai_get_action_by_id",
      "conversation_ai_update_action",
      "conversation_ai_delete_action",
      "conversation_ai_update_followup_settings",
      "conversation_ai_create_agent",
      "conversation_ai_search_agent",
      "conversation_ai_update_agent",
      "conversation_ai_get_agent",
      "conversation_ai_delete_agent",
      "conversation_ai_get_generation_details"
    ]
  },
  {
    "category": "Conversations",
    "tools": [
      "conversations_search_conversation",
      "conversations_get_conversation",
      "conversations_update_conversation",
      "conversations_delete_conversation",
      "conversations_get_all_custom_subtypes",
      "conversations_create_custom_subtype",
      "conversations_update_custom_subtype",
      "conversations_get_contact_unsubscription_status",
      "conversations_user_subscription_change",
      "conversations_get_email_by_id",
      "conversations_cancel_scheduled_email_message",
      "conversations_export_messages_by_location",
      "conversations_get_message",
      "conversations_get_messages",
      "conversations_send_a_new_message",
      "conversations_add_an_inbound_message",
      "conversations_add_an_outbound_message",
      "conversations_send_review_reply",
      "conversations_cancel_scheduled_message",
      "conversations_upload_file_attachments",
      "conversations_initiate_file_upload",
      "conversations_complete_file_upload",
      "conversations_update_message_status",
      "conversations_add_message_attachments",
      "conversations_get_message_recording",
      "conversations_get_message_transcription",
      "conversations_download_message_transcription",
      "conversations_live_chat_agent_typing",
      "conversations_create_conversation"
    ]
  },
  {
    "category": "Courses",
    "tools": [
      "courses_import_courses"
    ]
  },
  {
    "category": "Custom Fields V2",
    "tools": [
      "custom_fields_get_custom_field_by_id",
      "custom_fields_update_custom_field",
      "custom_fields_delete_custom_field",
      "custom_fields_get_custom_fields_by_object_key",
      "custom_fields_create_custom_field_folder",
      "custom_fields_update_custom_field_folder",
      "custom_fields_delete_custom_field_folder",
      "custom_fields_create_custom_field"
    ]
  },
  {
    "category": "Custom Menus",
    "tools": [
      "custom_menus_get_custom_menu_by_id",
      "custom_menus_delete_custom_menu",
      "custom_menus_update_custom_menu",
      "custom_menus_get_custom_menus",
      "custom_menus_create_custom_menu"
    ]
  },
  {
    "category": "Email ISV",
    "tools": [
      "email_isv_verify_email"
    ]
  },
  {
    "category": "Email",
    "tools": [
      "email_fetch_campaigns",
      "email_create_template",
      "email_fetch_template",
      "email_delete_template",
      "email_update_template"
    ]
  },
  {
    "category": "Forms",
    "tools": [
      "forms_get_forms_submissions",
      "forms_upload_to_custom_fields",
      "forms_get_forms"
    ]
  },
  {
    "category": "Funnels",
    "tools": [
      "funnels_create_redirect",
      "funnels_update_redirect_by_id",
      "funnels_delete_redirect_by_id",
      "funnels_fetch_redirects_list",
      "funnels_get_funnels",
      "funnels_get_pages_by_funnel_id",
      "funnels_get_pages_count_by_funnel_id"
    ]
  },
  {
    "category": "Invoice",
    "tools": [
      "invoices_create_invoice_template",
      "invoices_list_invoice_templates",
      "invoices_get_invoice_template",
      "invoices_update_invoice_template",
      "invoices_delete_invoice_template",
      "invoices_update_invoice_template_late_fees_configuration",
      "invoices_update_invoice_payment_methods_configuration",
      "invoices_create_invoice_schedule",
      "invoices_list_invoice_schedules",
      "invoices_get_invoice_schedule",
      "invoices_update_invoice_schedule",
      "invoices_delete_invoice_schedule",
      "invoices_update_and_schedule_invoice_schedule",
      "invoices_schedule_invoice_schedule",
      "invoices_auto_payment_invoice_schedule",
      "invoices_cancel_invoice_schedule",
      "invoices_text2pay_invoice",
      "invoices_generate_invoice_number",
      "invoices_get_invoice_settings",
      "invoices_get_invoice",
      "invoices_update_invoice",
      "invoices_delete_invoice",
      "invoices_update_invoice_late_fees_configuration",
      "invoices_void_invoice",
      "invoices_send_invoice",
      "invoices_record_invoice",
      "invoices_update_invoice_last_visited_at",
      "invoices_create_new_estimate",
      "invoices_update_estimate",
      "invoices_delete_estimate",
      "invoices_generate_estimate_number",
      "invoices_send_estimate",
      "invoices_create_invoice_from_estimate",
      "invoices_list_estimates",
      "invoices_update_estimate_last_visited_at",
      "invoices_list_estimate_templates",
      "invoices_create_estimate_template",
      "invoices_update_estimate_template",
      "invoices_delete_estimate_template",
      "invoices_preview_estimate_template",
      "invoices_create_invoice",
      "invoices_list_invoices"
    ]
  },
  {
    "category": "Knowledge Base",
    "tools": [
      "knowledge_base_list",
      "knowledge_base_create",
      "knowledge_base_update",
      "knowledge_base_delete",
      "knowledge_base_get_all_website_urls_data_by_knowledge_base",
      "knowledge_base_discover_website",
      "knowledge_base_delete_trained_urls_for_knowledge_base",
      "knowledge_base_get_crawling_status_for_latest_operation",
      "knowledge_base_train_discovered_urls",
      "knowledge_base_get_knowledge_base_by_id",
      "knowledge_base_delete_knowledge_base",
      "knowledge_base_update_knowledge_base",
      "knowledge_base_list_all_knowledge_bases_paginated",
      "knowledge_base_create_knowledge_base"
    ]
  },
  {
    "category": "Trigger Links",
    "tools": [
      "links_get_link_by_id",
      "links_update_link",
      "links_delete_link",
      "links_search_trigger_links",
      "links_get_links",
      "links_create_link"
    ]
  },
  {
    "category": "Sub-Account",
    "tools": [
      "locations_search_locations",
      "locations_get_location",
      "locations_put_location",
      "locations_delete_location",
      "locations_get_location_tags",
      "locations_create_tag",
      "locations_get_tag_by_id",
      "locations_update_tag",
      "locations_delete_tag",
      "locations_task_search",
      "locations_get_recurring_task_by_id",
      "locations_update_recurring_task",
      "locations_delete_recurring_task",
      "locations_create_recurring_task",
      "locations_get_custom_fields",
      "locations_create_custom_field",
      "locations_get_custom_field",
      "locations_update_custom_field",
      "locations_delete_custom_field",
      "locations_upload_file_custom_fields",
      "locations_get_custom_values",
      "locations_create_custom_value",
      "locations_get_custom_value",
      "locations_update_custom_value",
      "locations_delete_custom_value",
      "locations_get_timezones",
      "locations_get_all_or_email_sms_templates",
      "locations_delete_an_email_sms_template",
      "locations_create_location"
    ]
  },
  {
    "category": "Media Storage",
    "tools": [
      "media_fetch_media_content",
      "media_upload_media_content",
      "media_delete_media_content",
      "media_update_media_object",
      "media_create_media_folder",
      "media_bulk_update_media_objects",
      "media_bulk_delete_media_objects"
    ]
  },
  {
    "category": "Objects",
    "tools": [
      "objects_get_object_schema_by_key",
      "objects_update_custom_object",
      "objects_get_record_by_id",
      "objects_update_object_record",
      "objects_delete_object_record",
      "objects_create_object_record",
      "objects_search_object_records",
      "objects_get_object_by_location_id",
      "objects_create_custom_object_schema"
    ]
  },
  {
    "category": "Opportunities",
    "tools": [
      "opportunities_get_lost_reason",
      "opportunities_search_opportunity",
      "opportunities_search_opportunities_advanced",
      "opportunities_get_pipelines",
      "opportunities_get_opportunity",
      "opportunities_delete_opportunity",
      "opportunities_update_opportunity",
      "opportunities_update_opportunity_status",
      "opportunities_upsert_opportunity",
      "opportunities_add_followers_opportunity",
      "opportunities_remove_followers_opportunity",
      "opportunities_create_opportunity"
    ]
  },
  {
    "category": "Payments",
    "tools": [
      "payments_create_integration_provider",
      "payments_list_integration_providers",
      "payments_list_orders",
      "payments_get_order_by_id",
      "payments_record_order_payment",
      "payments_create_order_fulfillment",
      "payments_list_order_fulfillment",
      "payments_list_order_notes",
      "payments_list_transactions",
      "payments_get_transaction_by_id",
      "payments_list_subscriptions",
      "payments_get_subscription_by_id",
      "payments_list_coupons",
      "payments_create_coupon",
      "payments_update_coupon",
      "payments_delete_coupon",
      "payments_get_coupon",
      "payments_create_integration",
      "payments_delete_integration",
      "payments_fetch_config",
      "payments_create_config",
      "payments_disconnect_config",
      "payments_custom_provider_marketplace_app_update_capabilities"
    ]
  },
  {
    "category": "LC Phone",
    "tools": [
      "phone_get_number_pool_list",
      "phone_available_numbers",
      "phone_purchase_phone_number",
      "phone_active_numbers"
    ]
  },
  {
    "category": "Products",
    "tools": [
      "products_bulk_update",
      "products_bulk_edit",
      "products_create_price_for_product",
      "products_list_prices_for_product",
      "products_get_list_inventory",
      "products_update_inventory",
      "products_get_price_by_id_for_product",
      "products_update_price_by_id_for_product",
      "products_delete_price_by_id_for_product",
      "products_get_product_store_stats",
      "products_update_store_status",
      "products_update_display_priority",
      "products_get_product_collection",
      "products_create_product_collection",
      "products_get_product_collection_id",
      "products_update_product_collection",
      "products_delete_product_collection",
      "products_get_product_reviews",
      "products_get_reviews_count",
      "products_update_product_review",
      "products_delete_product_review",
      "products_bulk_update_product_review",
      "products_get_product_by_id",
      "products_delete_product_by_id",
      "products_update_product_by_id",
      "products_create_product",
      "products_list_invoices"
    ]
  },
  {
    "category": "Proposals",
    "tools": [
      "proposals_list_documents_contracts",
      "proposals_send_documents_contracts",
      "proposals_list_documents_contracts_templates",
      "proposals_send_documents_contracts_template"
    ]
  },
  {
    "category": "SaaS",
    "tools": [
      "saas_locations_deprecated",
      "saas_update_saas_subscription_deprecated",
      "saas_bulk_disable_saas_deprecated",
      "saas_enable_saas_location_deprecated",
      "saas_pause_location_deprecated",
      "saas_update_rebilling_deprecated",
      "saas_get_agency_plans_deprecated",
      "saas_get_location_subscription_deprecated",
      "saas_bulk_enable_saas_deprecated",
      "saas_get_saas_locations_deprecated",
      "saas_get_saas_plan_deprecated",
      "saas_locations",
      "saas_generate_payment_link",
      "saas_bulk_disable_saas",
      "saas_enable_saas_location",
      "saas_pause_location",
      "saas_update_rebilling",
      "saas_get_agency_plans",
      "saas_get_location_subscription",
      "saas_bulk_enable_saas",
      "saas_get_saas_locations",
      "saas_get_saas_plan"
    ]
  },
  {
    "category": "Snapshots",
    "tools": [
      "snapshots_get_custom_snapshots",
      "snapshots_create_snapshot_share_link",
      "snapshots_get_snapshot_push",
      "snapshots_get_latest_snapshot_push"
    ]
  },
  {
    "category": "Social Planner",
    "tools": [
      "social_start_google_oauth",
      "social_get_google_locations",
      "social_set_google_locations",
      "social_get_posts",
      "social_create_post",
      "social_get_post",
      "social_edit_post",
      "social_delete_post",
      "social_bulk_delete_social_planner_posts",
      "social_get_account",
      "social_delete_account",
      "social_start_facebook_oauth",
      "social_get_facebook_page_group",
      "social_attach_facebook_page_group",
      "social_start_instagram_oauth",
      "social_get_instagram_page_group",
      "social_attach_instagram_page_group",
      "social_start_linkedin_oauth",
      "social_get_linkedin_page_profile",
      "social_attach_linkedin_page_profile",
      "social_start_twitter_oauth",
      "social_get_twitter_profile",
      "social_attach_twitter_profile",
      "social_upload_csv",
      "social_get_upload_status",
      "social_set_accounts",
      "social_get_csv_post",
      "social_start_csv_finalize",
      "social_delete_csv",
      "social_delete_csv_post",
      "social_start_tiktok_oauth",
      "social_get_tiktok_profile",
      "social_attach_tiktok_profile",
      "social_start_tiktok_business_oauth",
      "social_get_tiktok_business_profile",
      "social_get_categories_location_id",
      "social_get_categories_id",
      "social_get_tags_location_id",
      "social_get_tags_by_ids",
      "social_get_social_media_statistics"
    ]
  },
  {
    "category": "Store",
    "tools": [
      "store_create_shipping_zone",
      "store_list_shipping_zones",
      "store_get_shipping_zones",
      "store_update_shipping_zone",
      "store_delete_shipping_zone",
      "store_get_available_shipping_zones",
      "store_create_shipping_rate",
      "store_list_shipping_rates",
      "store_get_shipping_rates",
      "store_update_shipping_rate",
      "store_delete_shipping_rate",
      "store_create_shipping_carrier",
      "store_list_shipping_carriers",
      "store_get_shipping_carriers",
      "store_update_shipping_carrier",
      "store_delete_shipping_carrier",
      "store_create_store_setting",
      "store_get_store_settings"
    ]
  },
  {
    "category": "Surveys",
    "tools": [
      "surveys_get_surveys_submissions",
      "surveys_get_surveys"
    ]
  }
];
export const ALL_TOOL_NAMES: string[] = TOOL_CATALOG.flatMap((g) => g.tools);
