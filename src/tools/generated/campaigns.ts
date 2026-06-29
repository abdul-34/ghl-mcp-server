// AUTO-GENERATED from HighLevel OpenAPI specs. Do not edit by hand.
// Regenerate with: node scripts/generate-tools.mjs
import { apiTool } from './_runtime.js';
import { ToolDef } from '../types.js';

export const campaignsTools: ToolDef[] = [
  apiTool({"name":"campaigns_get_campaigns","description":"Get Campaigns [scope: campaigns.readonly]","method":"GET","path":"/campaigns/","version":"2021-07-28","pathParams":[],"queryParams":["locationId","status"],"bodyParams":[],"inputSchema":{"type":"object","properties":{"locationId":{"type":"string"},"status":{"type":"string"}},"required":["locationId"],"additionalProperties":false}}),
];
