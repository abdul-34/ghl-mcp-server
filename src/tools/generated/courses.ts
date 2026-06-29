// AUTO-GENERATED from HighLevel OpenAPI specs. Do not edit by hand.
// Regenerate with: node scripts/generate-tools.mjs
import { apiTool } from './_runtime.js';
import { ToolDef } from '../types.js';

export const coursesTools: ToolDef[] = [
  apiTool({"name":"courses_import_courses","description":"Import Courses","method":"POST","path":"/courses/courses-exporter/public/import","version":"2021-07-28","pathParams":[],"queryParams":[],"bodyParams":["locationId","userId","products"],"inputSchema":{"type":"object","properties":{"locationId":{"type":"string"},"userId":{"type":"string"},"products":{"type":"array","items":{"type":"object","additionalProperties":true}}},"required":["locationId","products"],"additionalProperties":false}}),
];
