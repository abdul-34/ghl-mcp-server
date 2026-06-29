// AUTO-GENERATED from HighLevel OpenAPI specs. Do not edit by hand.
// Regenerate with: node scripts/generate-tools.mjs
import { apiTool } from './_runtime.js';
import { ToolDef } from '../types.js';

export const email_isvTools: ToolDef[] = [
  apiTool({"name":"email_isv_verify_email","description":"Email Verification","method":"POST","path":"/email/verify","version":"2021-07-28","pathParams":[],"queryParams":["locationId"],"bodyParams":["type","verify"],"inputSchema":{"type":"object","properties":{"locationId":{"type":"string","description":"Location Id, The email verification charges will be deducted from this location (if rebilling is enabled) / company wallet"},"type":{"type":"string","description":"Email Verification type","enum":["email","contact"]},"verify":{"type":"string","description":"Email Verification recepient (email address / contactId)"}},"required":["locationId","type","verify"],"additionalProperties":false}}),
];
