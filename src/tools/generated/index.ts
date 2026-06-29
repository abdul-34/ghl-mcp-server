// AUTO-GENERATED. Do not edit by hand. Run: node scripts/generate-tools.mjs
import { ToolDef } from '../types.js';
import { adsTools } from './ads.js';
import { affiliateTools } from './affiliate.js';
import { ai_agentTools } from './ai_agent.js';
import { associationsTools } from './associations.js';
import { blogsTools } from './blogs.js';
import { brand_boardsTools } from './brand_boards.js';
import { businessTools } from './business.js';
import { calendarsTools } from './calendars.js';
import { campaignsTools } from './campaigns.js';
import { chat_widgetTools } from './chat_widget.js';
import { companiesTools } from './companies.js';
import { contactsTools } from './contacts.js';
import { conversation_aiTools } from './conversation_ai.js';
import { conversationsTools } from './conversations.js';
import { coursesTools } from './courses.js';
import { custom_fieldsTools } from './custom_fields.js';
import { custom_menusTools } from './custom_menus.js';
import { email_isvTools } from './email_isv.js';
import { emailTools } from './email.js';
import { formsTools } from './forms.js';
import { funnelsTools } from './funnels.js';
import { invoicesTools } from './invoices.js';
import { knowledge_baseTools } from './knowledge_base.js';
import { linksTools } from './links.js';
import { locationsTools } from './locations.js';
import { mediaTools } from './media.js';
import { objectsTools } from './objects.js';
import { opportunitiesTools } from './opportunities.js';
import { paymentsTools } from './payments.js';
import { phoneTools } from './phone.js';
import { productsTools } from './products.js';
import { proposalsTools } from './proposals.js';
import { saasTools } from './saas.js';
import { snapshotsTools } from './snapshots.js';
import { socialTools } from './social.js';
import { storeTools } from './store.js';
import { surveysTools } from './surveys.js';

export const GENERATED_TOOLS: ToolDef[] = [
  ...adsTools,
  ...affiliateTools,
  ...ai_agentTools,
  ...associationsTools,
  ...blogsTools,
  ...brand_boardsTools,
  ...businessTools,
  ...calendarsTools,
  ...campaignsTools,
  ...chat_widgetTools,
  ...companiesTools,
  ...contactsTools,
  ...conversation_aiTools,
  ...conversationsTools,
  ...coursesTools,
  ...custom_fieldsTools,
  ...custom_menusTools,
  ...email_isvTools,
  ...emailTools,
  ...formsTools,
  ...funnelsTools,
  ...invoicesTools,
  ...knowledge_baseTools,
  ...linksTools,
  ...locationsTools,
  ...mediaTools,
  ...objectsTools,
  ...opportunitiesTools,
  ...paymentsTools,
  ...phoneTools,
  ...productsTools,
  ...proposalsTools,
  ...saasTools,
  ...snapshotsTools,
  ...socialTools,
  ...storeTools,
  ...surveysTools,
];

export interface GeneratedCatalogEntry { category: string; tools: { name: string; description: string }[]; }
export const GENERATED_CATALOG: GeneratedCatalogEntry[] = [
  {
    "category": "Ad Manager",
    "tools": [
      {
        "name": "ads_fb_get_reporting",
        "description": "Get reporting data [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_fb_get_campaign_reporting",
        "description": "Get campaign reporting [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_fb_get_reporting_list",
        "description": "Get reporting list [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_fb_get_current_user",
        "description": "Get current Facebook user [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_fb_get_pages",
        "description": "Get Facebook pages [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_fb_get_instagram_accounts",
        "description": "Get Instagram accounts for page [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_fb_get_page_lead_forms",
        "description": "Get page lead forms [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_fb_create_page_lead_form",
        "description": "Create page lead form [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_get_ad_accounts",
        "description": "Get ad accounts [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_fb_get_ad_account",
        "description": "Get ad account details [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_fb_delete_ad_account",
        "description": "Delete ad account [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_get_conversation_forms",
        "description": "Get conversation forms [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_fb_create_conversation_form",
        "description": "Create conversation form [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_create_integration",
        "description": "Create Facebook integration [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_get_integration",
        "description": "Get Facebook integration [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_fb_delete_integration",
        "description": "Delete Facebook integration [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_search_targeting",
        "description": "Search targeting options"
      },
      {
        "name": "ads_fb_publish_campaign",
        "description": "Publish campaign [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_delete_page",
        "description": "Delete page connection [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_get_pixels",
        "description": "Get conversion pixels [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_fb_upsert_pixel",
        "description": "Upsert conversion pixel [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_get_custom_audiences",
        "description": "Get custom audiences [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_fb_delete_custom_audience",
        "description": "Delete custom audience [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_update_custom_audience",
        "description": "Update custom audience [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_get_custom_audience_by_id",
        "description": "Get custom audience by ID [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_fb_add_custom_audience_member",
        "description": "Add custom audience member [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_remove_custom_audience_member",
        "description": "Remove custom audience member [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_batch_update_audience_members",
        "description": "Batch update audience members [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_set_default_page",
        "description": "Set default page [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_get_lead_form",
        "description": "Get lead form by ID [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_fb_get_campaign",
        "description": "Get campaign with linked entities [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_fb_get_entity",
        "description": "Get entities [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_fb_upsert_campaign",
        "description": "Upsert campaign [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_upsert_adset",
        "description": "Upsert adset [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_upsert_ad",
        "description": "Upsert ad [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_pause_campaign",
        "description": "Pause campaign [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_resume_campaign",
        "description": "Resume campaign [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_duplicate_campaign",
        "description": "Duplicate campaign [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_delete_campaign",
        "description": "Delete campaign [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_pause_adset",
        "description": "Pause ad set [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_resume_adset",
        "description": "Resume ad set [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_duplicate_adset",
        "description": "Duplicate ad set [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_delete_adset",
        "description": "Delete ad set [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_pause_ad",
        "description": "Pause ad [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_resume_ad",
        "description": "Resume ad [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_duplicate_ad",
        "description": "Duplicate ad [scope: adPublishing.write]"
      },
      {
        "name": "ads_fb_delete_ad",
        "description": "Delete ad [scope: adPublishing.write]"
      },
      {
        "name": "ads_google_get_reporting",
        "description": "Get reporting data [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_get_reporting_list",
        "description": "Get reporting list [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_get_campaign_reporting",
        "description": "Get campaign reporting [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_get_conversions",
        "description": "Get conversions [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_upsert_conversion",
        "description": "Upsert conversion [scope: adPublishing.write]"
      },
      {
        "name": "ads_google_get_conversion_by_id",
        "description": "Get conversion by ID [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_delete_conversion",
        "description": "Delete conversion [scope: adPublishing.write]"
      },
      {
        "name": "ads_google_get_integration",
        "description": "Get Google integration [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_create_integration",
        "description": "Create Google integration [scope: adPublishing.write]"
      },
      {
        "name": "ads_google_get_current_user",
        "description": "Get current Google user [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_get_ad_accounts",
        "description": "Get Google ad accounts [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_get_ad_account_details",
        "description": "Get ad account details [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_delete_ad_account",
        "description": "Delete ad account [scope: adPublishing.write]"
      },
      {
        "name": "ads_google_publish_ad",
        "description": "Publish ad [scope: adPublishing.write]"
      },
      {
        "name": "ads_google_search_targeting",
        "description": "Search targeting options [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_get_keyword_ideas",
        "description": "Get keyword ideas [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_get_assets",
        "description": "Get assets [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_upsert_assets",
        "description": "Upsert assets [scope: adPublishing.write]"
      },
      {
        "name": "ads_google_get_entity",
        "description": "Get entities [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_get_target_interests",
        "description": "Get target interests [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_get_segments",
        "description": "Get segments [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_upsert_segment",
        "description": "Upsert segment [scope: adPublishing.write]"
      },
      {
        "name": "ads_google_delete_segment",
        "description": "Delete segment [scope: adPublishing.write]"
      },
      {
        "name": "ads_google_get_segment_by_id",
        "description": "Get segment by ID [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_create_offline_user_list_job",
        "description": "Create offline user list job [scope: adPublishing.write]"
      },
      {
        "name": "ads_google_upsert_audience",
        "description": "Upsert audience [scope: adPublishing.write]"
      },
      {
        "name": "ads_google_get_audiences",
        "description": "Get audiences [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_get_audience_by_id",
        "description": "Get audience by ID [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_upsert_campaign",
        "description": "Upsert Google campaign [scope: adPublishing.write]"
      },
      {
        "name": "ads_google_get_campaign_by_id",
        "description": "Get Google campaign by ID [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_google_get_conversion_goals",
        "description": "Get conversion goals [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_li_get_integration",
        "description": "Get LinkedIn integration [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_li_create_integration",
        "description": "Create LinkedIn integration [scope: adPublishing.write]"
      },
      {
        "name": "ads_li_get_ad_accounts",
        "description": "Get LinkedIn ad accounts [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_li_get_ad_account_details",
        "description": "Get ad account details [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_li_delete_ad_account",
        "description": "Delete ad account [scope: adPublishing.write]"
      },
      {
        "name": "ads_li_get_current_user",
        "description": "Get current LinkedIn user [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_li_get_campaign_group",
        "description": "Get ad campaign group [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_li_publish_campaign_group",
        "description": "Publish ad campaign group [scope: adPublishing.write]"
      },
      {
        "name": "ads_li_upsert_campaign_group",
        "description": "Upsert ad campaign group [scope: adPublishing.write]"
      },
      {
        "name": "ads_li_search_targeting",
        "description": "Search targeting options [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_li_get_lead_forms",
        "description": "Get lead forms [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_li_create_lead_form",
        "description": "Create lead form [scope: adPublishing.write]"
      },
      {
        "name": "ads_li_update_ad_status",
        "description": "Update ad status [scope: adPublishing.write]"
      },
      {
        "name": "ads_li_get_ad_analytics",
        "description": "Get ad analytics [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_li_get_reporting_list",
        "description": "Get reporting list [scope: adPublishing.readonly]"
      },
      {
        "name": "ads_li_get_campaign_group_reporting",
        "description": "Get campaign group reporting [scope: adPublishing.readonly]"
      }
    ]
  },
  {
    "category": "Affiliate Manager",
    "tools": [
      {
        "name": "affiliate_list_affiliates",
        "description": "List Affiliates [scope: affiliate-manager.readonly]"
      },
      {
        "name": "affiliate_get_affiliate",
        "description": "Get Affiliate [scope: affiliate-manager.readonly]"
      },
      {
        "name": "affiliate_list_payouts",
        "description": "List Payouts [scope: affiliate-manager.readonly]"
      },
      {
        "name": "affiliate_list_commissions",
        "description": "List Commissions [scope: affiliate-manager.readonly]"
      }
    ]
  },
  {
    "category": "AI Agent Studio",
    "tools": [
      {
        "name": "ai_agent_create_agent",
        "description": "Create Agent"
      },
      {
        "name": "ai_agent_get_agents",
        "description": "List Agents"
      },
      {
        "name": "ai_agent_update_agent_version",
        "description": "Update Agent"
      },
      {
        "name": "ai_agent_update_agent_metadata",
        "description": "Update Agent Metadata"
      },
      {
        "name": "ai_agent_delete_agent",
        "description": "Delete Agent"
      },
      {
        "name": "ai_agent_get_agent_by_id",
        "description": "Get Agent"
      },
      {
        "name": "ai_agent_promote_and_publish",
        "description": "Promote to Production"
      },
      {
        "name": "ai_agent_execute_agent",
        "description": "Execute Agent"
      },
      {
        "name": "ai_agent_get_agents_deprecated",
        "description": "List Agents (Deprecated)"
      },
      {
        "name": "ai_agent_get_agent_by_id_deprecated",
        "description": "Get Agent (Deprecated)"
      },
      {
        "name": "ai_agent_execute_agent_deprecated",
        "description": "Execute Agent (Deprecated)"
      }
    ]
  },
  {
    "category": "Associations",
    "tools": [
      {
        "name": "associations_create_relation",
        "description": "Create Relation for you associated entities. [scope: associations/relation.write]"
      },
      {
        "name": "associations_get_relations_by_record_id",
        "description": "Get all relations By record Id [scope: associations/relation.readonly]"
      },
      {
        "name": "associations_delete_relation",
        "description": "Delete Relation [scope: associations/relation.write]"
      },
      {
        "name": "associations_get_association_key_by_key_name",
        "description": "Get association key by key name [scope: associations.readonly]"
      },
      {
        "name": "associations_get_association_by_object_keys",
        "description": "Get association by object keys [scope: associations.readonly]"
      },
      {
        "name": "associations_update_association",
        "description": "Update Association By Id [scope: associations.write]"
      },
      {
        "name": "associations_delete_association",
        "description": "Delete Association [scope: associations.write]"
      },
      {
        "name": "associations_get_association_by_id",
        "description": "Get association by ID [scope: associations.readonly]"
      },
      {
        "name": "associations_create_association",
        "description": "Create Association [scope: associations.write]"
      },
      {
        "name": "associations_find_associations",
        "description": "Get all associations for a sub-account / location [scope: associations.readonly]"
      }
    ]
  },
  {
    "category": "Blogs",
    "tools": [
      {
        "name": "blogs_check_url_slug_exists",
        "description": "Check url slug"
      },
      {
        "name": "blogs_update_blog_post",
        "description": "Update Blog Post"
      },
      {
        "name": "blogs_create_blog_post",
        "description": "Create Blog Post"
      },
      {
        "name": "blogs_get_all_blog_authors_by_location",
        "description": "Get all authors"
      },
      {
        "name": "blogs_get_all_categories_by_location",
        "description": "Get all categories"
      },
      {
        "name": "blogs_get_blog_post",
        "description": "Get Blog posts by Blog ID"
      },
      {
        "name": "blogs_get_blogs",
        "description": "Get Blogs by Location ID"
      }
    ]
  },
  {
    "category": "Brand Boards",
    "tools": [
      {
        "name": "brand_boards_get_brand_boards_by_location",
        "description": "Get Brand Boards"
      },
      {
        "name": "brand_boards_get_brand_board_by_id",
        "description": "Get Brand Board"
      },
      {
        "name": "brand_boards_update_brand_board",
        "description": "Update a Brand Board"
      },
      {
        "name": "brand_boards_delete_brand_board",
        "description": "Delete a Brand Board"
      },
      {
        "name": "brand_boards_create_brand_board",
        "description": "Create a new brand board"
      }
    ]
  },
  {
    "category": "Business",
    "tools": [
      {
        "name": "business_update_business",
        "description": "Update Business [scope: businesses.write]"
      },
      {
        "name": "business_delete_business",
        "description": "Delete Business [scope: businesses.write]"
      },
      {
        "name": "business_get_business",
        "description": "Get Business [scope: businesses.readonly]"
      },
      {
        "name": "business_get_businesses_by_location",
        "description": "Get Businesses by Location [scope: businesses.readonly]"
      },
      {
        "name": "business_create_business",
        "description": "Create Business [scope: businesses.write]"
      }
    ]
  },
  {
    "category": "Calendars",
    "tools": [
      {
        "name": "calendars_get_groups",
        "description": "Get Groups [scope: calendars/groups.readonly]"
      },
      {
        "name": "calendars_create_calendar_group",
        "description": "Create Calendar Group [scope: calendars/groups.write]"
      },
      {
        "name": "calendars_validate_groups_slug",
        "description": "Validate group slug [scope: calendars/groups.write]"
      },
      {
        "name": "calendars_delete_group",
        "description": "Delete Group [scope: calendars/groups.write]"
      },
      {
        "name": "calendars_edit_group",
        "description": "Update Group [scope: calendars/groups.write]"
      },
      {
        "name": "calendars_disable_group",
        "description": "Disable Group [scope: calendars/groups.write]"
      },
      {
        "name": "calendars_create_appointment",
        "description": "Create appointment [scope: calendars/events.write]"
      },
      {
        "name": "calendars_edit_appointment",
        "description": "Update Appointment [scope: calendars/events.write]"
      },
      {
        "name": "calendars_get_appointment",
        "description": "Get Appointment [scope: calendars/events.readonly]"
      },
      {
        "name": "calendars_get_calendar_events",
        "description": "Get Calendar Events [scope: calendars/events.readonly]"
      },
      {
        "name": "calendars_get_blocked_slots",
        "description": "Get Blocked Slots [scope: calendars/events.readonly]"
      },
      {
        "name": "calendars_create_block_slot",
        "description": "Create Block Slot [scope: calendars/events.write]"
      },
      {
        "name": "calendars_edit_block_slot",
        "description": "Update Block Slot [scope: calendars/events.write]"
      },
      {
        "name": "calendars_get_slots",
        "description": "Get Free Slots [scope: calendars.readonly]"
      },
      {
        "name": "calendars_update_calendar",
        "description": "Update Calendar [scope: calendars.write]"
      },
      {
        "name": "calendars_get_calendar",
        "description": "Get Calendar [scope: calendars.readonly]"
      },
      {
        "name": "calendars_delete_calendar",
        "description": "Delete Calendar [scope: calendars.write]"
      },
      {
        "name": "calendars_delete_event",
        "description": "Delete Event [scope: calendars/events.write]"
      },
      {
        "name": "calendars_get_appointment_notes",
        "description": "Get Notes [scope: calendars/events.readonly]"
      },
      {
        "name": "calendars_create_appointment_note",
        "description": "Create Note [scope: calendars/events.write]"
      },
      {
        "name": "calendars_update_appointment_note",
        "description": "Update Note [scope: calendars/events.write]"
      },
      {
        "name": "calendars_delete_appointment_note",
        "description": "Delete Note [scope: calendars/events.write]"
      },
      {
        "name": "calendars_get_calendar_resource",
        "description": "Get Calendar Resource"
      },
      {
        "name": "calendars_update_calendar_resource",
        "description": "Update Calendar Resource"
      },
      {
        "name": "calendars_delete_calendar_resource",
        "description": "Delete Calendar Resource"
      },
      {
        "name": "calendars_fetch_calendar_resources",
        "description": "List Calendar Resources"
      },
      {
        "name": "calendars_create_calendar_resource",
        "description": "Create Calendar Resource"
      },
      {
        "name": "calendars_get_event_notification",
        "description": "Get notifications [scope: calendars/events.readonly]"
      },
      {
        "name": "calendars_create_event_notification",
        "description": "Create notification [scope: calendars/events.write]"
      },
      {
        "name": "calendars_find_event_notification",
        "description": "Get notification [scope: calendars/events.readonly]"
      },
      {
        "name": "calendars_update_event_notification",
        "description": "Update notification [scope: calendars/events.write]"
      },
      {
        "name": "calendars_delete_event_notification",
        "description": "Delete Notification [scope: calendars/events.write]"
      },
      {
        "name": "calendars_get_all_schedules",
        "description": "List user availability schedule [scope: calendars.readonly]"
      },
      {
        "name": "calendars_get_schedule_by_id",
        "description": "Get user availability schedule [scope: calendars.readonly]"
      },
      {
        "name": "calendars_update_schedule",
        "description": "Update user availability schedule [scope: calendars.write]"
      },
      {
        "name": "calendars_delete_schedule",
        "description": "Delete user availability schedule [scope: calendars.write]"
      },
      {
        "name": "calendars_create_schedule",
        "description": "Create user availability schedule [scope: calendars.write]"
      },
      {
        "name": "calendars_add_calendar_to_schedule",
        "description": "Apply user availability schedule to a calendar [scope: calendars.write]"
      },
      {
        "name": "calendars_remove_calendar_from_schedule",
        "description": "Remove user availability schedule from a calendar [scope: calendars.write]"
      },
      {
        "name": "calendars_get_calendars",
        "description": "Get Calendars [scope: calendars.readonly]"
      },
      {
        "name": "calendars_create_calendar",
        "description": "Create Calendar [scope: calendars.write]"
      }
    ]
  },
  {
    "category": "Campaigns",
    "tools": [
      {
        "name": "campaigns_get_campaigns",
        "description": "Get Campaigns [scope: campaigns.readonly]"
      }
    ]
  },
  {
    "category": "Chat Widget",
    "tools": [
      {
        "name": "chat_widget_list_chat_widget",
        "description": "List Chat Widgets"
      },
      {
        "name": "chat_widget_get_chat_widget",
        "description": "Get Chat Widget"
      },
      {
        "name": "chat_widget_update_chat_widget",
        "description": "Update Chat Widget"
      },
      {
        "name": "chat_widget_patch_chat_widget",
        "description": "Patch Chat Widget"
      },
      {
        "name": "chat_widget_get_widget",
        "description": "Get Widget Config"
      },
      {
        "name": "chat_widget_delete",
        "description": "Delete Chat Widget"
      },
      {
        "name": "chat_widget_clone_chat_widget",
        "description": "Clone Chat Widget"
      },
      {
        "name": "chat_widget_create_chat_widget",
        "description": "Create Chat Widget"
      }
    ]
  },
  {
    "category": "Companies",
    "tools": [
      {
        "name": "companies_get_company",
        "description": "Get Company"
      }
    ]
  },
  {
    "category": "Contacts",
    "tools": [
      {
        "name": "contacts_search_contacts_advanced",
        "description": "Search Contacts [scope: contacts.readonly]"
      },
      {
        "name": "contacts_get_duplicate_contact",
        "description": "Get Duplicate Contact [scope: contacts.readonly]"
      },
      {
        "name": "contacts_get_all_tasks",
        "description": "Get all Tasks [scope: contacts.readonly]"
      },
      {
        "name": "contacts_create_task",
        "description": "Create Task [scope: contacts.write]"
      },
      {
        "name": "contacts_get_task",
        "description": "Get Task [scope: contacts.readonly]"
      },
      {
        "name": "contacts_update_task",
        "description": "Update Task [scope: contacts.write]"
      },
      {
        "name": "contacts_delete_task",
        "description": "Delete Task [scope: contacts.write]"
      },
      {
        "name": "contacts_update_task_completed",
        "description": "Update Task Completed [scope: contacts.write]"
      },
      {
        "name": "contacts_get_appointments_for_contact",
        "description": "Get Appointments for Contact [scope: contacts.readonly]"
      },
      {
        "name": "contacts_add_tags",
        "description": "Add Tags [scope: contacts.write]"
      },
      {
        "name": "contacts_remove_tags",
        "description": "Remove Tags [scope: contacts.write]"
      },
      {
        "name": "contacts_get_all_notes",
        "description": "Get All Notes [scope: contacts.readonly]"
      },
      {
        "name": "contacts_create_note",
        "description": "Create Note [scope: contacts.write]"
      },
      {
        "name": "contacts_get_note",
        "description": "Get Note [scope: contacts.readonly]"
      },
      {
        "name": "contacts_update_note",
        "description": "Update Note [scope: contacts.write]"
      },
      {
        "name": "contacts_delete_note",
        "description": "Delete Note [scope: contacts.write]"
      },
      {
        "name": "contacts_create_association",
        "description": "Update Contacts Tags"
      },
      {
        "name": "contacts_add_remove_contact_from_business",
        "description": "Add/Remove Contacts From Business"
      },
      {
        "name": "contacts_get_contact",
        "description": "Get Contact [scope: contacts.readonly]"
      },
      {
        "name": "contacts_update_contact",
        "description": "Update Contact [scope: contacts.write]"
      },
      {
        "name": "contacts_delete_contact",
        "description": "Delete Contact [scope: contacts.write]"
      },
      {
        "name": "contacts_upsert_contact",
        "description": "Upsert Contact [scope: contacts.write]"
      },
      {
        "name": "contacts_get_contacts_by_business_id",
        "description": "Get Contacts By BusinessId [scope: contacts.readonly]"
      },
      {
        "name": "contacts_add_followers_contact",
        "description": "Add Followers [scope: contacts.write]"
      },
      {
        "name": "contacts_remove_followers_contact",
        "description": "Remove Followers [scope: contacts.write]"
      },
      {
        "name": "contacts_add_contact_to_campaign",
        "description": "Add Contact to Campaign [scope: contacts.write]"
      },
      {
        "name": "contacts_remove_contact_from_campaign",
        "description": "Remove Contact From Campaign [scope: contacts.write]"
      },
      {
        "name": "contacts_remove_contact_from_every_campaign",
        "description": "Remove Contact From Every Campaign [scope: contacts.write]"
      },
      {
        "name": "contacts_add_contact_to_workflow",
        "description": "Add Contact to Workflow [scope: contacts.write]"
      },
      {
        "name": "contacts_delete_contact_from_workflow",
        "description": "Delete Contact from Workflow [scope: contacts.write]"
      },
      {
        "name": "contacts_create_contact",
        "description": "Create Contact [scope: contacts.write]"
      },
      {
        "name": "contacts_get_contacts",
        "description": "Get Contacts [scope: contacts.readonly]"
      }
    ]
  },
  {
    "category": "Conversation AI",
    "tools": [
      {
        "name": "conversation_ai_create_action",
        "description": "Attach Action to Agent [scope: conversation-ai.write]"
      },
      {
        "name": "conversation_ai_list_actions",
        "description": "List Actions for an Agent [scope: conversation-ai.readonly]"
      },
      {
        "name": "conversation_ai_get_action_by_id",
        "description": "Get Action by ID [scope: conversation-ai.readonly]"
      },
      {
        "name": "conversation_ai_update_action",
        "description": "Update Action [scope: conversation-ai.write]"
      },
      {
        "name": "conversation_ai_delete_action",
        "description": "Remove Action from Agent [scope: conversation-ai.write]"
      },
      {
        "name": "conversation_ai_update_followup_settings",
        "description": "Update Followup Settings [scope: conversation-ai.write]"
      },
      {
        "name": "conversation_ai_create_agent",
        "description": "Create an Agent [scope: conversation-ai.write]"
      },
      {
        "name": "conversation_ai_search_agent",
        "description": "Search Agents [scope: conversation-ai.readonly]"
      },
      {
        "name": "conversation_ai_update_agent",
        "description": "Update Agent [scope: conversation-ai.write]"
      },
      {
        "name": "conversation_ai_get_agent",
        "description": "Get Agent [scope: conversation-ai.readonly]"
      },
      {
        "name": "conversation_ai_delete_agent",
        "description": "Delete Agent [scope: conversation-ai.write]"
      },
      {
        "name": "conversation_ai_get_generation_details",
        "description": "Get the generation details [scope: conversation-ai.readonly]"
      }
    ]
  },
  {
    "category": "Conversations",
    "tools": [
      {
        "name": "conversations_search_conversation",
        "description": "Search Conversations [scope: conversations.readonly]"
      },
      {
        "name": "conversations_get_conversation",
        "description": "Get Conversation [scope: conversations.readonly]"
      },
      {
        "name": "conversations_update_conversation",
        "description": "Update Conversation [scope: conversations.write]"
      },
      {
        "name": "conversations_delete_conversation",
        "description": "Delete Conversation [scope: conversations.write]"
      },
      {
        "name": "conversations_get_all_custom_subtypes",
        "description": "Get All Custom Subtypes"
      },
      {
        "name": "conversations_create_custom_subtype",
        "description": "Create Custom Subtype"
      },
      {
        "name": "conversations_update_custom_subtype",
        "description": "Update Custom Subtype"
      },
      {
        "name": "conversations_get_contact_unsubscription_status",
        "description": "Get Contact Unsubscription Status"
      },
      {
        "name": "conversations_user_subscription_change",
        "description": "User Subscription Change"
      },
      {
        "name": "conversations_get_email_by_id",
        "description": "Get email by Id"
      },
      {
        "name": "conversations_cancel_scheduled_email_message",
        "description": "Cancel a scheduled email message."
      },
      {
        "name": "conversations_export_messages_by_location",
        "description": "Export messages by location ID [scope: conversations/message.readonly]"
      },
      {
        "name": "conversations_get_message",
        "description": "Get message by message id [scope: conversations/message.readonly]"
      },
      {
        "name": "conversations_get_messages",
        "description": "Get messages by conversation id [scope: conversations/message.readonly]"
      },
      {
        "name": "conversations_send_a_new_message",
        "description": "Send a new message [scope: conversations/message.write]"
      },
      {
        "name": "conversations_add_an_inbound_message",
        "description": "Add an inbound message [scope: conversations/message.write]"
      },
      {
        "name": "conversations_add_an_outbound_message",
        "description": "Add an external outbound call [scope: conversations/message.write]"
      },
      {
        "name": "conversations_send_review_reply",
        "description": "Send a review reply to Google My Business [scope: conversations/message.write]"
      },
      {
        "name": "conversations_cancel_scheduled_message",
        "description": "Cancel a scheduled message. [scope: conversations/message.write]"
      },
      {
        "name": "conversations_upload_file_attachments",
        "description": "Upload file attachments [scope: conversations/message.write]"
      },
      {
        "name": "conversations_initiate_file_upload",
        "description": "Initiate file upload to GCS [scope: conversations/message.write]"
      },
      {
        "name": "conversations_complete_file_upload",
        "description": "Complete file upload [scope: conversations/message.write]"
      },
      {
        "name": "conversations_update_message_status",
        "description": "Update message status [scope: conversations/message.write]"
      },
      {
        "name": "conversations_add_message_attachments",
        "description": "Add message attachments [scope: conversations/message.write]"
      },
      {
        "name": "conversations_get_message_recording",
        "description": "Get Recording by Message ID [scope: conversations/message.readonly]"
      },
      {
        "name": "conversations_get_message_transcription",
        "description": "Get transcription by Message ID [scope: conversations/message.readonly]"
      },
      {
        "name": "conversations_download_message_transcription",
        "description": "Download transcription by Message ID [scope: conversations/message.readonly]"
      },
      {
        "name": "conversations_live_chat_agent_typing",
        "description": "Agent/Ai-Bot is typing a message indicator for live chat"
      },
      {
        "name": "conversations_create_conversation",
        "description": "Create Conversation [scope: conversations.write]"
      }
    ]
  },
  {
    "category": "Courses",
    "tools": [
      {
        "name": "courses_import_courses",
        "description": "Import Courses"
      }
    ]
  },
  {
    "category": "Custom Fields V2",
    "tools": [
      {
        "name": "custom_fields_get_custom_field_by_id",
        "description": "Get Custom Field / Folder By Id [scope: locations/customFields.readonly]"
      },
      {
        "name": "custom_fields_update_custom_field",
        "description": "Update Custom Field By Id [scope: locations/customFields.write]"
      },
      {
        "name": "custom_fields_delete_custom_field",
        "description": "Delete Custom Field By Id [scope: locations/customFields.write]"
      },
      {
        "name": "custom_fields_get_custom_fields_by_object_key",
        "description": "Get Custom Fields By Object Key [scope: locations/customFields.readonly]"
      },
      {
        "name": "custom_fields_create_custom_field_folder",
        "description": "Create Custom Field Folder [scope: locations/customFields.write]"
      },
      {
        "name": "custom_fields_update_custom_field_folder",
        "description": "Update Custom Field Folder Name [scope: locations/customFields.write]"
      },
      {
        "name": "custom_fields_delete_custom_field_folder",
        "description": "Delete Custom Field Folder [scope: locations/customFields.write]"
      },
      {
        "name": "custom_fields_create_custom_field",
        "description": "Create Custom Field [scope: locations/customFields.write]"
      }
    ]
  },
  {
    "category": "Custom Menus",
    "tools": [
      {
        "name": "custom_menus_get_custom_menu_by_id",
        "description": "Get Custom Menu Link"
      },
      {
        "name": "custom_menus_delete_custom_menu",
        "description": "Delete Custom Menu Link"
      },
      {
        "name": "custom_menus_update_custom_menu",
        "description": "Update Custom Menu Link"
      },
      {
        "name": "custom_menus_get_custom_menus",
        "description": "Get Custom Menu Links"
      },
      {
        "name": "custom_menus_create_custom_menu",
        "description": "Create Custom Menu Link"
      }
    ]
  },
  {
    "category": "Email ISV",
    "tools": [
      {
        "name": "email_isv_verify_email",
        "description": "Email Verification"
      }
    ]
  },
  {
    "category": "Email",
    "tools": [
      {
        "name": "email_fetch_campaigns",
        "description": "Get Campaigns"
      },
      {
        "name": "email_create_template",
        "description": "Create a new template"
      },
      {
        "name": "email_fetch_template",
        "description": "Fetch email templates"
      },
      {
        "name": "email_delete_template",
        "description": "Delete a template"
      },
      {
        "name": "email_update_template",
        "description": "Update a template"
      }
    ]
  },
  {
    "category": "Forms",
    "tools": [
      {
        "name": "forms_get_forms_submissions",
        "description": "Get Forms Submissions [scope: forms.readonly]"
      },
      {
        "name": "forms_upload_to_custom_fields",
        "description": "Upload files to custom fields [scope: forms.write]"
      },
      {
        "name": "forms_get_forms",
        "description": "Get Forms [scope: forms.readonly]"
      }
    ]
  },
  {
    "category": "Funnels",
    "tools": [
      {
        "name": "funnels_create_redirect",
        "description": "Create Redirect"
      },
      {
        "name": "funnels_update_redirect_by_id",
        "description": "Update Redirect By Id"
      },
      {
        "name": "funnels_delete_redirect_by_id",
        "description": "Delete Redirect By Id"
      },
      {
        "name": "funnels_fetch_redirects_list",
        "description": "Fetch List of Redirects"
      },
      {
        "name": "funnels_get_funnels",
        "description": "Fetch List of Funnels"
      },
      {
        "name": "funnels_get_pages_by_funnel_id",
        "description": "Fetch list of funnel pages"
      },
      {
        "name": "funnels_get_pages_count_by_funnel_id",
        "description": "Fetch count of funnel pages"
      }
    ]
  },
  {
    "category": "Invoice",
    "tools": [
      {
        "name": "invoices_create_invoice_template",
        "description": "Create template"
      },
      {
        "name": "invoices_list_invoice_templates",
        "description": "List templates"
      },
      {
        "name": "invoices_get_invoice_template",
        "description": "Get an template"
      },
      {
        "name": "invoices_update_invoice_template",
        "description": "Update template"
      },
      {
        "name": "invoices_delete_invoice_template",
        "description": "Delete template"
      },
      {
        "name": "invoices_update_invoice_template_late_fees_configuration",
        "description": "Update template late fees configuration"
      },
      {
        "name": "invoices_update_invoice_payment_methods_configuration",
        "description": "Update template late fees configuration"
      },
      {
        "name": "invoices_create_invoice_schedule",
        "description": "Create Invoice Schedule"
      },
      {
        "name": "invoices_list_invoice_schedules",
        "description": "List schedules"
      },
      {
        "name": "invoices_get_invoice_schedule",
        "description": "Get an schedule"
      },
      {
        "name": "invoices_update_invoice_schedule",
        "description": "Update schedule"
      },
      {
        "name": "invoices_delete_invoice_schedule",
        "description": "Delete schedule"
      },
      {
        "name": "invoices_update_and_schedule_invoice_schedule",
        "description": "Update scheduled recurring invoice"
      },
      {
        "name": "invoices_schedule_invoice_schedule",
        "description": "Schedule an schedule invoice"
      },
      {
        "name": "invoices_auto_payment_invoice_schedule",
        "description": "Manage Auto payment for an schedule invoice"
      },
      {
        "name": "invoices_cancel_invoice_schedule",
        "description": "Cancel an scheduled invoice"
      },
      {
        "name": "invoices_text2pay_invoice",
        "description": "Create & Send"
      },
      {
        "name": "invoices_generate_invoice_number",
        "description": "Generate Invoice Number"
      },
      {
        "name": "invoices_get_invoice_settings",
        "description": "Get Invoice Settings"
      },
      {
        "name": "invoices_get_invoice",
        "description": "Get invoice"
      },
      {
        "name": "invoices_update_invoice",
        "description": "Update invoice"
      },
      {
        "name": "invoices_delete_invoice",
        "description": "Delete invoice"
      },
      {
        "name": "invoices_update_invoice_late_fees_configuration",
        "description": "Update invoice late fees configuration"
      },
      {
        "name": "invoices_void_invoice",
        "description": "Void invoice"
      },
      {
        "name": "invoices_send_invoice",
        "description": "Send invoice"
      },
      {
        "name": "invoices_record_invoice",
        "description": "Record a manual payment for an invoice"
      },
      {
        "name": "invoices_update_invoice_last_visited_at",
        "description": "Update invoice last visited at"
      },
      {
        "name": "invoices_create_new_estimate",
        "description": "Create New Estimate"
      },
      {
        "name": "invoices_update_estimate",
        "description": "Update Estimate"
      },
      {
        "name": "invoices_delete_estimate",
        "description": "Delete Estimate"
      },
      {
        "name": "invoices_generate_estimate_number",
        "description": "Generate Estimate Number"
      },
      {
        "name": "invoices_send_estimate",
        "description": "Send Estimate"
      },
      {
        "name": "invoices_create_invoice_from_estimate",
        "description": "Create Invoice from Estimate"
      },
      {
        "name": "invoices_list_estimates",
        "description": "List Estimates"
      },
      {
        "name": "invoices_update_estimate_last_visited_at",
        "description": "Update estimate last visited at"
      },
      {
        "name": "invoices_list_estimate_templates",
        "description": "List Estimate Templates"
      },
      {
        "name": "invoices_create_estimate_template",
        "description": "Create Estimate Template"
      },
      {
        "name": "invoices_update_estimate_template",
        "description": "Update Estimate Template"
      },
      {
        "name": "invoices_delete_estimate_template",
        "description": "Delete Estimate Template"
      },
      {
        "name": "invoices_preview_estimate_template",
        "description": "Preview Estimate Template"
      },
      {
        "name": "invoices_create_invoice",
        "description": "Create Invoice"
      },
      {
        "name": "invoices_list_invoices",
        "description": "List invoices"
      }
    ]
  },
  {
    "category": "Knowledge Base",
    "tools": [
      {
        "name": "knowledge_base_list",
        "description": "Get all FAQs by knowledge base with pagination support"
      },
      {
        "name": "knowledge_base_create",
        "description": "Create a new FAQ inside knowledge base"
      },
      {
        "name": "knowledge_base_update",
        "description": "Update an existing knowledge base FAQ"
      },
      {
        "name": "knowledge_base_delete",
        "description": "Delete an existing knowledge base FAQ"
      },
      {
        "name": "knowledge_base_get_all_website_urls_data_by_knowledge_base",
        "description": "Get all trained page links by knowledge base"
      },
      {
        "name": "knowledge_base_discover_website",
        "description": "Start crawling and discover pages for training"
      },
      {
        "name": "knowledge_base_delete_trained_urls_for_knowledge_base",
        "description": "Delete trained pages"
      },
      {
        "name": "knowledge_base_get_crawling_status_for_latest_operation",
        "description": "Get crawling status for the latest operation"
      },
      {
        "name": "knowledge_base_train_discovered_urls",
        "description": "Train discovered website pages and ingest into the knowledge base"
      },
      {
        "name": "knowledge_base_get_knowledge_base_by_id",
        "description": "Get knowledge base by ID"
      },
      {
        "name": "knowledge_base_delete_knowledge_base",
        "description": "Delete a knowledge base"
      },
      {
        "name": "knowledge_base_update_knowledge_base",
        "description": "Update a knowledge base"
      },
      {
        "name": "knowledge_base_list_all_knowledge_bases_paginated",
        "description": "Get all knowledge bases for a location by location Id (paginated)"
      },
      {
        "name": "knowledge_base_create_knowledge_base",
        "description": "Create a new knowledge base (max 15 knowledge bases per location)"
      }
    ]
  },
  {
    "category": "Trigger Links",
    "tools": [
      {
        "name": "links_get_link_by_id",
        "description": "Get Link by ID"
      },
      {
        "name": "links_update_link",
        "description": "Update Link [scope: links.write]"
      },
      {
        "name": "links_delete_link",
        "description": "Delete Link [scope: links.write]"
      },
      {
        "name": "links_search_trigger_links",
        "description": "Search Trigger Links"
      },
      {
        "name": "links_get_links",
        "description": "Get Links [scope: links.readonly]"
      },
      {
        "name": "links_create_link",
        "description": "Create Link [scope: links.write]"
      }
    ]
  },
  {
    "category": "Sub-Account",
    "tools": [
      {
        "name": "locations_search_locations",
        "description": "Search"
      },
      {
        "name": "locations_get_location",
        "description": "Get Sub-Account (Formerly Location)"
      },
      {
        "name": "locations_put_location",
        "description": "Put Sub-Account (Formerly Location)"
      },
      {
        "name": "locations_delete_location",
        "description": "Delete Sub-Account (Formerly Location)"
      },
      {
        "name": "locations_get_location_tags",
        "description": "Get Tags [scope: locations/tags.readonly]"
      },
      {
        "name": "locations_create_tag",
        "description": "Create Tag [scope: locations/tags.write]"
      },
      {
        "name": "locations_get_tag_by_id",
        "description": "Get tag by id"
      },
      {
        "name": "locations_update_tag",
        "description": "Update tag"
      },
      {
        "name": "locations_delete_tag",
        "description": "Delete tag"
      },
      {
        "name": "locations_task_search",
        "description": "Task Search Filter [scope: locations/tasks.readonly]"
      },
      {
        "name": "locations_get_recurring_task_by_id",
        "description": "Get Recurring Task By Id"
      },
      {
        "name": "locations_update_recurring_task",
        "description": "Update Recurring Task"
      },
      {
        "name": "locations_delete_recurring_task",
        "description": "Delete Recurring Task"
      },
      {
        "name": "locations_create_recurring_task",
        "description": "Create Recurring Task"
      },
      {
        "name": "locations_get_custom_fields",
        "description": "Get Custom Fields [scope: locations/customFields.readonly]"
      },
      {
        "name": "locations_create_custom_field",
        "description": "Create Custom Field [scope: locations/customFields.write]"
      },
      {
        "name": "locations_get_custom_field",
        "description": "Get Custom Field"
      },
      {
        "name": "locations_update_custom_field",
        "description": "Update Custom Field"
      },
      {
        "name": "locations_delete_custom_field",
        "description": "Delete Custom Field"
      },
      {
        "name": "locations_upload_file_custom_fields",
        "description": "Uploads File to customFields [scope: locations/customFields.write]"
      },
      {
        "name": "locations_get_custom_values",
        "description": "Get Custom Values [scope: locations/customValues.readonly]"
      },
      {
        "name": "locations_create_custom_value",
        "description": "Create Custom Value [scope: locations/customValues.write]"
      },
      {
        "name": "locations_get_custom_value",
        "description": "Get Custom Value"
      },
      {
        "name": "locations_update_custom_value",
        "description": "Update Custom Value"
      },
      {
        "name": "locations_delete_custom_value",
        "description": "Delete Custom Value"
      },
      {
        "name": "locations_get_timezones",
        "description": "Fetch Timezones [scope: locations.readonly]"
      },
      {
        "name": "locations_get_all_or_email_sms_templates",
        "description": "GET all or email/sms templates [scope: locations/templates.readonly]"
      },
      {
        "name": "locations_delete_an_email_sms_template",
        "description": "DELETE an email/sms template"
      },
      {
        "name": "locations_create_location",
        "description": "Create Sub-Account (Formerly Location)"
      }
    ]
  },
  {
    "category": "Media Storage",
    "tools": [
      {
        "name": "media_fetch_media_content",
        "description": "Get List of Files/ Folders"
      },
      {
        "name": "media_upload_media_content",
        "description": "Upload File into Media Storage"
      },
      {
        "name": "media_delete_media_content",
        "description": "Delete File or Folder"
      },
      {
        "name": "media_update_media_object",
        "description": "Update File/ Folder"
      },
      {
        "name": "media_create_media_folder",
        "description": "Create Folder"
      },
      {
        "name": "media_bulk_update_media_objects",
        "description": "Bulk Update Files/ Folders"
      },
      {
        "name": "media_bulk_delete_media_objects",
        "description": "Bulk Delete / Trash Files or Folders"
      }
    ]
  },
  {
    "category": "Objects",
    "tools": [
      {
        "name": "objects_get_object_schema_by_key",
        "description": "Get Object Schema by key / id [scope: objects/schema.readonly]"
      },
      {
        "name": "objects_update_custom_object",
        "description": "Update Object Schema By Key / Id [scope: objects/schema.write]"
      },
      {
        "name": "objects_get_record_by_id",
        "description": "Get Record By Id"
      },
      {
        "name": "objects_update_object_record",
        "description": "Update Record"
      },
      {
        "name": "objects_delete_object_record",
        "description": "Delete Record"
      },
      {
        "name": "objects_create_object_record",
        "description": "Create Record [scope: objects/record.write]"
      },
      {
        "name": "objects_search_object_records",
        "description": "Search Object Records [scope: objects/record.readonly]"
      },
      {
        "name": "objects_get_object_by_location_id",
        "description": "Get all objects for a location [scope: objects/schema.readonly]"
      },
      {
        "name": "objects_create_custom_object_schema",
        "description": "Create Custom Object"
      }
    ]
  },
  {
    "category": "Opportunities",
    "tools": [
      {
        "name": "opportunities_get_lost_reason",
        "description": "Get lost reason [scope: opportunities.readonly]"
      },
      {
        "name": "opportunities_search_opportunity",
        "description": "Search Opportunity [scope: opportunities.readonly]"
      },
      {
        "name": "opportunities_search_opportunities_advanced",
        "description": "Search Opportunities [scope: opportunities.readonly]"
      },
      {
        "name": "opportunities_get_pipelines",
        "description": "Get Pipelines [scope: opportunities.readonly]"
      },
      {
        "name": "opportunities_get_opportunity",
        "description": "Get Opportunity [scope: opportunities.readonly]"
      },
      {
        "name": "opportunities_delete_opportunity",
        "description": "Delete Opportunity [scope: opportunities.write]"
      },
      {
        "name": "opportunities_update_opportunity",
        "description": "Update Opportunity [scope: opportunities.write]"
      },
      {
        "name": "opportunities_update_opportunity_status",
        "description": "Update Opportunity Status [scope: opportunities.write]"
      },
      {
        "name": "opportunities_upsert_opportunity",
        "description": "Upsert Opportunity [scope: opportunities.write]"
      },
      {
        "name": "opportunities_add_followers_opportunity",
        "description": "Add Followers [scope: opportunities.write]"
      },
      {
        "name": "opportunities_remove_followers_opportunity",
        "description": "Remove Followers [scope: opportunities.write]"
      },
      {
        "name": "opportunities_create_opportunity",
        "description": "Create Opportunity [scope: opportunities.write]"
      }
    ]
  },
  {
    "category": "Payments",
    "tools": [
      {
        "name": "payments_create_integration_provider",
        "description": "Create White-label Integration Provider"
      },
      {
        "name": "payments_list_integration_providers",
        "description": "List White-label Integration Providers"
      },
      {
        "name": "payments_list_orders",
        "description": "List Orders"
      },
      {
        "name": "payments_get_order_by_id",
        "description": "Get Order by ID"
      },
      {
        "name": "payments_record_order_payment",
        "description": "Record Order Payment"
      },
      {
        "name": "payments_create_order_fulfillment",
        "description": "Create order fulfillment"
      },
      {
        "name": "payments_list_order_fulfillment",
        "description": "List fulfillment"
      },
      {
        "name": "payments_list_order_notes",
        "description": "List Order Notes"
      },
      {
        "name": "payments_list_transactions",
        "description": "List Transactions"
      },
      {
        "name": "payments_get_transaction_by_id",
        "description": "Get Transaction by ID"
      },
      {
        "name": "payments_list_subscriptions",
        "description": "List Subscriptions"
      },
      {
        "name": "payments_get_subscription_by_id",
        "description": "Get Subscription by ID"
      },
      {
        "name": "payments_list_coupons",
        "description": "List Coupons"
      },
      {
        "name": "payments_create_coupon",
        "description": "Create Coupon"
      },
      {
        "name": "payments_update_coupon",
        "description": "Update Coupon"
      },
      {
        "name": "payments_delete_coupon",
        "description": "Delete Coupon"
      },
      {
        "name": "payments_get_coupon",
        "description": "Fetch Coupon"
      },
      {
        "name": "payments_create_integration",
        "description": "Create new integration"
      },
      {
        "name": "payments_delete_integration",
        "description": "Deleting an existing integration"
      },
      {
        "name": "payments_fetch_config",
        "description": "Fetch given provider config"
      },
      {
        "name": "payments_create_config",
        "description": "Create new provider config"
      },
      {
        "name": "payments_disconnect_config",
        "description": "Disconnect existing provider config"
      },
      {
        "name": "payments_custom_provider_marketplace_app_update_capabilities",
        "description": "Custom-provider marketplace app update capabilities"
      }
    ]
  },
  {
    "category": "LC Phone",
    "tools": [
      {
        "name": "phone_get_number_pool_list",
        "description": "List Number Pools"
      },
      {
        "name": "phone_available_numbers",
        "description": "List available phone numbers"
      },
      {
        "name": "phone_purchase_phone_number",
        "description": "Purchase a phone number"
      },
      {
        "name": "phone_active_numbers",
        "description": "List active numbers"
      }
    ]
  },
  {
    "category": "Products",
    "tools": [
      {
        "name": "products_bulk_update",
        "description": "Bulk Update Products"
      },
      {
        "name": "products_bulk_edit",
        "description": "Bulk Edit Products and Prices"
      },
      {
        "name": "products_create_price_for_product",
        "description": "Create Price for a Product"
      },
      {
        "name": "products_list_prices_for_product",
        "description": "List Prices for a Product"
      },
      {
        "name": "products_get_list_inventory",
        "description": "List Inventory"
      },
      {
        "name": "products_update_inventory",
        "description": "Update Inventory"
      },
      {
        "name": "products_get_price_by_id_for_product",
        "description": "Get Price by ID for a Product"
      },
      {
        "name": "products_update_price_by_id_for_product",
        "description": "Update Price by ID for a Product"
      },
      {
        "name": "products_delete_price_by_id_for_product",
        "description": "Delete Price by ID for a Product"
      },
      {
        "name": "products_get_product_store_stats",
        "description": "Fetch Product Store Stats"
      },
      {
        "name": "products_update_store_status",
        "description": "Action to include/exclude the product in store"
      },
      {
        "name": "products_update_display_priority",
        "description": "Update product display priorities in store"
      },
      {
        "name": "products_get_product_collection",
        "description": "Fetch Product Collections"
      },
      {
        "name": "products_create_product_collection",
        "description": "Create Product Collection"
      },
      {
        "name": "products_get_product_collection_id",
        "description": "Get Details about individual product collection"
      },
      {
        "name": "products_update_product_collection",
        "description": "Update Product Collection"
      },
      {
        "name": "products_delete_product_collection",
        "description": "Delete Product Collection"
      },
      {
        "name": "products_get_product_reviews",
        "description": "Fetch Product Reviews"
      },
      {
        "name": "products_get_reviews_count",
        "description": "Fetch Review Count as per status"
      },
      {
        "name": "products_update_product_review",
        "description": "Update Product Reviews"
      },
      {
        "name": "products_delete_product_review",
        "description": "Delete Product Review"
      },
      {
        "name": "products_bulk_update_product_review",
        "description": "Update Product Reviews"
      },
      {
        "name": "products_get_product_by_id",
        "description": "Get Product by ID"
      },
      {
        "name": "products_delete_product_by_id",
        "description": "Delete Product by ID"
      },
      {
        "name": "products_update_product_by_id",
        "description": "Update Product by ID"
      },
      {
        "name": "products_create_product",
        "description": "Create Product"
      },
      {
        "name": "products_list_invoices",
        "description": "List Products"
      }
    ]
  },
  {
    "category": "Proposals",
    "tools": [
      {
        "name": "proposals_list_documents_contracts",
        "description": "List documents"
      },
      {
        "name": "proposals_send_documents_contracts",
        "description": "Send document"
      },
      {
        "name": "proposals_list_documents_contracts_templates",
        "description": "List templates"
      },
      {
        "name": "proposals_send_documents_contracts_template",
        "description": "Send template"
      }
    ]
  },
  {
    "category": "SaaS",
    "tools": [
      {
        "name": "saas_locations_deprecated",
        "description": "Get locations by stripeId with companyId"
      },
      {
        "name": "saas_update_saas_subscription_deprecated",
        "description": "Update SaaS subscription"
      },
      {
        "name": "saas_bulk_disable_saas_deprecated",
        "description": "Disable SaaS for locations"
      },
      {
        "name": "saas_enable_saas_location_deprecated",
        "description": "Enable SaaS for Sub-Account (Formerly Location)"
      },
      {
        "name": "saas_pause_location_deprecated",
        "description": "Pause location"
      },
      {
        "name": "saas_update_rebilling_deprecated",
        "description": "Update Rebilling"
      },
      {
        "name": "saas_get_agency_plans_deprecated",
        "description": "Get Agency Plans"
      },
      {
        "name": "saas_get_location_subscription_deprecated",
        "description": "Get Location Subscription Details"
      },
      {
        "name": "saas_bulk_enable_saas_deprecated",
        "description": "Bulk Enable SaaS"
      },
      {
        "name": "saas_get_saas_locations_deprecated",
        "description": "Get SaaS Locations"
      },
      {
        "name": "saas_get_saas_plan_deprecated",
        "description": "Get SaaS Plan"
      },
      {
        "name": "saas_locations",
        "description": "Get locations by stripeId with companyId"
      },
      {
        "name": "saas_generate_payment_link",
        "description": "Update SaaS subscription"
      },
      {
        "name": "saas_bulk_disable_saas",
        "description": "Disable SaaS for locations"
      },
      {
        "name": "saas_enable_saas_location",
        "description": "Enable SaaS for Sub-Account (Formerly Location)"
      },
      {
        "name": "saas_pause_location",
        "description": "Pause location"
      },
      {
        "name": "saas_update_rebilling",
        "description": "Update Rebilling"
      },
      {
        "name": "saas_get_agency_plans",
        "description": "Get Agency Plans"
      },
      {
        "name": "saas_get_location_subscription",
        "description": "Get Location Subscription Details"
      },
      {
        "name": "saas_bulk_enable_saas",
        "description": "Bulk Enable SaaS"
      },
      {
        "name": "saas_get_saas_locations",
        "description": "Get SaaS Locations"
      },
      {
        "name": "saas_get_saas_plan",
        "description": "Get SaaS Plan"
      }
    ]
  },
  {
    "category": "Snapshots",
    "tools": [
      {
        "name": "snapshots_get_custom_snapshots",
        "description": "Get Snapshots"
      },
      {
        "name": "snapshots_create_snapshot_share_link",
        "description": "Create Snapshot Share Link"
      },
      {
        "name": "snapshots_get_snapshot_push",
        "description": "Get Snapshot Push between Dates"
      },
      {
        "name": "snapshots_get_latest_snapshot_push",
        "description": "Get Last Snapshot Push"
      }
    ]
  },
  {
    "category": "Social Planner",
    "tools": [
      {
        "name": "social_start_google_oauth",
        "description": "Starts OAuth For Google Account [scope: socialplanner/oauth.readonly]"
      },
      {
        "name": "social_get_google_locations",
        "description": "Get google business locations"
      },
      {
        "name": "social_set_google_locations",
        "description": "Set google business locations"
      },
      {
        "name": "social_get_posts",
        "description": "Get posts [scope: socialplanner/post.readonly]"
      },
      {
        "name": "social_create_post",
        "description": "Create post [scope: socialplanner/post.write]"
      },
      {
        "name": "social_get_post",
        "description": "Get post"
      },
      {
        "name": "social_edit_post",
        "description": "Edit post"
      },
      {
        "name": "social_delete_post",
        "description": "Delete Post"
      },
      {
        "name": "social_bulk_delete_social_planner_posts",
        "description": "Bulk Delete Social Planner Posts"
      },
      {
        "name": "social_get_account",
        "description": "Get Accounts [scope: socialplanner/account.readonly]"
      },
      {
        "name": "social_delete_account",
        "description": "Delete Account"
      },
      {
        "name": "social_start_facebook_oauth",
        "description": "Starts OAuth For Facebook Account"
      },
      {
        "name": "social_get_facebook_page_group",
        "description": "Get facebook pages"
      },
      {
        "name": "social_attach_facebook_page_group",
        "description": "Attach facebook pages"
      },
      {
        "name": "social_start_instagram_oauth",
        "description": "Starts OAuth For Instagram Account [scope: socialplanner/oauth.readonly]"
      },
      {
        "name": "social_get_instagram_page_group",
        "description": "Get Instagram Professional Accounts"
      },
      {
        "name": "social_attach_instagram_page_group",
        "description": "Attach Instagram Professional Accounts"
      },
      {
        "name": "social_start_linkedin_oauth",
        "description": "Starts OAuth For LinkedIn Account"
      },
      {
        "name": "social_get_linkedin_page_profile",
        "description": "Get Linkedin pages and profile"
      },
      {
        "name": "social_attach_linkedin_page_profile",
        "description": "Attach linkedin pages and profile"
      },
      {
        "name": "social_start_twitter_oauth",
        "description": "Starts OAuth For Twitter Account [scope: socialplanner/oauth.readonly]"
      },
      {
        "name": "social_get_twitter_profile",
        "description": "Get Twitter profile"
      },
      {
        "name": "social_attach_twitter_profile",
        "description": "Attach Twitter profile"
      },
      {
        "name": "social_upload_csv",
        "description": "Upload CSV [scope: socialplanner/csv.write]"
      },
      {
        "name": "social_get_upload_status",
        "description": "Get Upload Status"
      },
      {
        "name": "social_set_accounts",
        "description": "Set Accounts [scope: socialplanner/csv.write]"
      },
      {
        "name": "social_get_csv_post",
        "description": "Get CSV Post"
      },
      {
        "name": "social_start_csv_finalize",
        "description": "Start CSV Finalize"
      },
      {
        "name": "social_delete_csv",
        "description": "Delete CSV"
      },
      {
        "name": "social_delete_csv_post",
        "description": "Delete CSV Post"
      },
      {
        "name": "social_start_tiktok_oauth",
        "description": "Starts OAuth For Tiktok Account [scope: socialplanner/oauth.readonly]"
      },
      {
        "name": "social_get_tiktok_profile",
        "description": "Get Tiktok profile"
      },
      {
        "name": "social_attach_tiktok_profile",
        "description": "Attach Tiktok profile"
      },
      {
        "name": "social_start_tiktok_business_oauth",
        "description": "Starts OAuth For Tiktok Business Account [scope: socialplanner/oauth.readonly]"
      },
      {
        "name": "social_get_tiktok_business_profile",
        "description": "Get Tiktok Business profile"
      },
      {
        "name": "social_get_categories_location_id",
        "description": "Get categories by location id [scope: socialplanner/category.readonly]"
      },
      {
        "name": "social_get_categories_id",
        "description": "Get categories by id"
      },
      {
        "name": "social_get_tags_location_id",
        "description": "Get tags by location id"
      },
      {
        "name": "social_get_tags_by_ids",
        "description": "Get tags by ids"
      },
      {
        "name": "social_get_social_media_statistics",
        "description": "Get Social Media Statistics"
      }
    ]
  },
  {
    "category": "Store",
    "tools": [
      {
        "name": "store_create_shipping_zone",
        "description": "Create Shipping Zone"
      },
      {
        "name": "store_list_shipping_zones",
        "description": "List Shipping Zones"
      },
      {
        "name": "store_get_shipping_zones",
        "description": "Get Shipping Zone"
      },
      {
        "name": "store_update_shipping_zone",
        "description": "Update Shipping Zone"
      },
      {
        "name": "store_delete_shipping_zone",
        "description": "Delete shipping zone"
      },
      {
        "name": "store_get_available_shipping_zones",
        "description": "Get available shipping rates"
      },
      {
        "name": "store_create_shipping_rate",
        "description": "Create Shipping Rate"
      },
      {
        "name": "store_list_shipping_rates",
        "description": "List Shipping Rates"
      },
      {
        "name": "store_get_shipping_rates",
        "description": "Get Shipping Rate"
      },
      {
        "name": "store_update_shipping_rate",
        "description": "Update Shipping Rate"
      },
      {
        "name": "store_delete_shipping_rate",
        "description": "Delete shipping rate"
      },
      {
        "name": "store_create_shipping_carrier",
        "description": "Create Shipping Carrier"
      },
      {
        "name": "store_list_shipping_carriers",
        "description": "List Shipping Carriers"
      },
      {
        "name": "store_get_shipping_carriers",
        "description": "Get Shipping Carrier"
      },
      {
        "name": "store_update_shipping_carrier",
        "description": "Update Shipping Carrier"
      },
      {
        "name": "store_delete_shipping_carrier",
        "description": "Delete shipping carrier"
      },
      {
        "name": "store_create_store_setting",
        "description": "Create/Update Store Settings"
      },
      {
        "name": "store_get_store_settings",
        "description": "Get Store Settings"
      }
    ]
  },
  {
    "category": "Surveys",
    "tools": [
      {
        "name": "surveys_get_surveys_submissions",
        "description": "Get Surveys Submissions [scope: surveys.readonly]"
      },
      {
        "name": "surveys_get_surveys",
        "description": "Get Surveys [scope: surveys.readonly]"
      }
    ]
  }
];
