// AUTO-GENERATED from HighLevel OpenAPI specs. Do not edit by hand.
// Regenerate with: node scripts/generate-tools.mjs
import { apiTool } from './_runtime.js';
import { ToolDef } from '../types.js';

export const companiesTools: ToolDef[] = [
  apiTool({"name":"companies_get_company","description":"Get Company","method":"GET","path":"/companies/{companyId}","version":"2021-07-28","pathParams":["companyId"],"queryParams":[],"bodyParams":[],"inputSchema":{"type":"object","properties":{"companyId":{"type":"string"},"locationId":{"type":"string","description":"CRM sub-account (location) ID to act on. Use list_accounts to discover it."}},"required":["companyId","locationId"],"additionalProperties":false}}),
];
