// Tests for the NATIVE MULTI-PATH TRANSITION exemption in validateWorkflowGraph,
// and for the validation that must remain in force around it.
//
// Run with: npm test   (builds to dist/, then node --test tests/*.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateWorkflowGraph } from '../dist/catalog/workflow-validator.js';
import { lookupNativeModule } from '../dist/catalog/native-workflow-catalog.js';

// The live module list the server fetches at runtime. The static catalog does not
// carry every native key (find_opportunity / internal_update_opportunity live only
// in the live list), so the tests supply it the same way the tools do.
const KNOWN = new Set([
  'find_opportunity', 'internal_update_opportunity', 'internal_create_opportunity',
  'add_notes', 'add_contact_tag', 'remove_contact_tag', 'update_contact_field',
  'internal_notification', 'goto', 'transition', 'if_else', 'wait', 'find_contact',
  // trigger keys — confirmed live on WF-LEAD-003, absent from the static catalog
  'form_submission', 'survey_submission',
]);
const OPTS = { knownKeys: KNOWN };

const PIPELINE = 'k22HIIY9kfkHX8vJNnvw';
const STAGE = '713c6a5f-9db4-419c-8c7a-1705dcd3c7c8';

const issuesOf = (actions, triggers = []) => validateWorkflowGraph(actions, triggers, OPTS).issues;
const hasIssue = (issues, needle) => issues.some((i) => i.includes(needle));

/** A Find Opportunity multi-path block in the exact shape HighLevel stores. */
function findOpportunityGraph({ transitionAttributes = {}, mutate } = {}) {
  const graph = [
    {
      id: 'find-1', type: 'find_opportunity', name: 'Find opportunity', order: 0,
      cat: 'multi-path', workflowsActionType: 'INTERNAL',
      next: ['t-found', 't-notfound'],
      attributes: {
        sorting: 'latest', type: 'find_opportunity',
        __customInputFields__: [{ __customInputs__: {}, filterField: 'pipeline_id', value: 'eq', secondValue: PIPELINE }],
        __customInputs__: {}, cat: 'multi-path', convertToMultipath: true,
        transitions: [
          { id: 't-found', name: 'Opportunity Found', fields: [], meta: { __branchKey__: 'predefined_Opportunity Found' }, conditionType: 'pre-defined' },
          { id: 't-notfound', name: 'Opportunity Not Found', fields: [], meta: { __branchKey__: 'predefined_Opportunity Not Found' }, conditionType: 'pre-defined' },
        ],
        __name__: 'Find opportunity',
      },
    },
    { id: 't-found', type: 'transition', name: 'Opportunity Found', cat: 'transition', parent: 'find-1', parentKey: 'find-1', order: 1, attributes: { ...transitionAttributes }, next: 'upd-1' },
    { id: 't-notfound', type: 'transition', name: 'Opportunity Not Found', cat: 'transition', parent: 'find-1', parentKey: 'find-1', order: 1, attributes: { ...transitionAttributes }, next: 'crt-1' },
    {
      id: 'upd-1', type: 'internal_update_opportunity', name: 'Update opportunity', parent: 't-found', parentKey: 't-found', order: 0,
      workflowsActionType: 'INTERNAL', next: 'note-1',
      attributes: {
        allowBackward: true, type: 'internal_update_opportunity', __customInputs__: {},
        __customInputFields__: [
          { __customInputs__: { value: 'numerical' }, dataType: 'SINGLE_OPTIONS', filterField: 'pipelineId', value: PIPELINE, valueFieldType: 'select' },
          { __customInputs__: { value: 'numerical' }, dataType: 'SINGLE_OPTIONS', filterField: 'pipelineStageId', value: STAGE, valueFieldType: 'select' },
          { __customInputs__: { value: 'numerical' }, dataType: 'TEXT', filterField: 'name', value: '{{contact.name}}', valueFieldType: 'custom-input' },
        ],
      },
    },
    { id: 'note-1', type: 'add_notes', name: 'System Note', parent: 't-found', parentKey: 'upd-1', order: 1, next: null, attributes: { type: 'add_notes', title: 'Opportunity synchronisation complete', html: '<p>ok</p>', color: '#FEF0C7' } },
    {
      id: 'crt-1', type: 'internal_create_opportunity', name: 'Create opportunity', parent: 't-notfound', parentKey: 't-notfound', order: 0,
      workflowsActionType: 'INTERNAL', next: 'goto-1',
      attributes: {
        pipelineId: PIPELINE, type: 'internal_create_opportunity', __customInputs__: {},
        __customInputFields__: [
          { __customInputs__: {}, dataType: 'SINGLE_OPTIONS', filterField: 'pipelineStageId', value: STAGE, valueFieldType: 'select' },
          { __customInputs__: {}, dataType: 'TEXT', filterField: 'custom_fields.E1TbasVrB6qwJ95mg3L8', value: '{{contact.utm_channel}}', valueFieldType: 'string' },
        ],
      },
    },
    { id: 'goto-1', type: 'goto', name: 'Go to', parent: 't-notfound', parentKey: 'crt-1', attributes: { targetNodeId: 'note-1', type: 'goto' } },
  ];
  return typeof mutate === 'function' ? mutate(graph) ?? graph : graph;
}

const byId = (graph, id) => graph.find((n) => n.id === id);

// ───────────────────────────────────────────────────────────────────────────
// 1. The native shape is accepted
// ───────────────────────────────────────────────────────────────────────────

test('1. a Find Opportunity multi-path graph with native transitions (attributes: {}) is accepted', () => {
  const issues = issuesOf(findOpportunityGraph());
  assert.deepEqual(issues, [], `expected no issues, got:\n${issues.join('\n')}`);
});

test('2. a native transition carrying the recognised branch attributes is accepted', () => {
  // The find_contact / wait branch shape, where the builder does populate
  // attributes.type. The exemption accepts it for the same reason it accepts
  // `attributes: {}`: the catalog rule is not applicable to a declared branch.
  const issues = issuesOf(findOpportunityGraph({
    transitionAttributes: { type: 'transition', description: 'Opportunity branch' },
  }));
  assert.deepEqual(issues, [], `expected no issues, got:\n${issues.join('\n')}`);
});

// ───────────────────────────────────────────────────────────────────────────
// 2. Nothing else lost validation
// ───────────────────────────────────────────────────────────────────────────

test('3. a malformed executable action is still rejected (add_notes missing required "html")', () => {
  const graph = findOpportunityGraph();
  delete byId(graph, 'note-1').attributes.html;
  const issues = issuesOf(graph);
  assert.ok(hasIssue(issues, 'missing required field "html"'), `expected the html rejection, got:\n${issues.join('\n')}`);
});

test('4. a malformed Wait action is still rejected by its own required-field validation', () => {
  // "wait" is a member of STRUCTURAL_TYPES *and* is catalog-backed with enforceable
  // required fields ("type", "startAfter"). The earlier blanket STRUCTURAL_TYPES
  // exemption silently removed this check; the narrow exemption must not.
  const mod = lookupNativeModule('wait', 'action') || lookupNativeModule('wait');
  const required = (mod?.inputs || []).filter((i) => i && i.required === true).map((i) => i.field || i.name);
  assert.deepEqual(required.sort(), ['startAfter', 'type'], 'catalog precondition: wait declares enforceable required fields');

  const graph = findOpportunityGraph();
  byId(graph, 'note-1').next = 'wait-1';
  graph.push({ id: 'wait-1', type: 'wait', name: 'Wait', parent: 't-found', parentKey: 'note-1', order: 2, next: null, attributes: {} });

  const issues = issuesOf(graph);
  assert.ok(hasIssue(issues, 'action[7] "wait": missing required field "type"'), `expected wait.type rejection, got:\n${issues.join('\n')}`);
  assert.ok(hasIssue(issues, 'missing required field "startAfter"'), `expected wait.startAfter rejection, got:\n${issues.join('\n')}`);
});

test('5. a catalog-backed non-transition node still requires its configuration (find_contact multi-path)', () => {
  // find_contact is the other native hybrid multi-path action. It is NOT exempt:
  // only the transition branch nodes are. A find_contact with no configuration is
  // rejected exactly as before.
  const graph = findOpportunityGraph();
  byId(graph, 'note-1').next = 'fc-1';
  graph.push({ id: 'fc-1', type: 'find_contact', name: 'Find contact', parent: 't-found', parentKey: 'note-1', order: 2, next: null, attributes: {} });

  const issues = issuesOf(graph);
  for (const field of ['fields', 'convertToMultipath', 'cat', 'isHybridAction', 'hybridActionType', 'transitions']) {
    assert.ok(hasIssue(issues, `"find_contact": missing required field "${field}"`), `expected find_contact.${field} rejection, got:\n${issues.join('\n')}`);
  }

  // Documented limitation, asserted so it cannot drift silently: if_else, condition,
  // branch, filter, fork, join, end and goto have NO native catalog entry, so rule (2)
  // never applied to them, before or after this change. There is nothing to re-enable.
  for (const t of ['if_else', 'condition', 'branch', 'filter', 'fork', 'join', 'end', 'goto']) {
    assert.equal(lookupNativeModule(t, 'action') || lookupNativeModule(t), undefined, `${t} is not catalog-backed`);
  }
});

test('6. an unknown module type is still rejected', () => {
  const graph = findOpportunityGraph();
  byId(graph, 'note-1').type = 'definitely_not_a_module';
  const issues = issuesOf(graph);
  assert.ok(hasIssue(issues, 'unknown module type'), `expected the unknown-type rejection, got:\n${issues.join('\n')}`);
});

test('7. an unresolved Go To target is still rejected', () => {
  const graph = findOpportunityGraph();
  byId(graph, 'goto-1').attributes.targetNodeId = 'no-such-node';
  const issues = issuesOf(graph);
  assert.ok(hasIssue(issues, 'goto.targetNodeId "no-such-node"'), `expected the goto rejection, got:\n${issues.join('\n')}`);
});

// ───────────────────────────────────────────────────────────────────────────
// 3. The transition itself is still validated — by graph integrity, not by the
//    inapplicable catalog rule
// ───────────────────────────────────────────────────────────────────────────

test('8. a transition with a dangling "next" is still rejected', () => {
  const graph = findOpportunityGraph();
  byId(graph, 't-found').next = 'no-such-node';
  const issues = issuesOf(graph);
  assert.ok(hasIssue(issues, 'points to node id "no-such-node"'), `expected the dangling-next rejection, got:\n${issues.join('\n')}`);
});

test('9. a transition with a missing or mismatched parent relationship is rejected', () => {
  const missing = findOpportunityGraph();
  const t1 = byId(missing, 't-found');
  delete t1.parentKey;
  delete t1.parent;
  const missingIssues = issuesOf(missing);
  assert.ok(hasIssue(missingIssues, 'transition is missing "parentKey"'), 'expected the missing-parent rejection');
  // The predicate requires a matching parent link, so a transition without one gets
  // no exemption either — implementation and documentation agree literally.
  assert.ok(hasIssue(missingIssues, 'missing required field "attributes.type"'), 'expected the unlinked transition to lose the exemption');

  const mismatched = findOpportunityGraph();
  byId(mismatched, 't-found').parentKey = 'note-1'; // an existing node, but not the declaring action
  byId(mismatched, 't-found').parent = 'note-1';
  const issues = issuesOf(mismatched);
  assert.ok(hasIssue(issues, 'does not match the multi-path action "find-1"'), `expected the mismatched-parent rejection, got:\n${issues.join('\n')}`);
});

test('10. a transition id not declared by its parent multi-path action is rejected', () => {
  const graph = findOpportunityGraph();
  // The parent declares t-found / t-notfound. This third branch node declares an id
  // no multi-path action lists, so it gets no exemption and no integrity pass.
  graph.push({ id: 't-orphan', type: 'transition', name: 'Orphan branch', cat: 'transition', parent: 'find-1', parentKey: 'find-1', order: 1, attributes: {}, next: 'note-1' });
  const issues = issuesOf(graph);
  assert.ok(hasIssue(issues, 'transition id "t-orphan" is not declared as a branch by any multi-path action'), `expected the undeclared-transition rejection, got:\n${issues.join('\n')}`);

  // And the reverse asymmetry is still caught: a branch declared but not routed.
  const unrouted = findOpportunityGraph();
  byId(unrouted, 'find-1').next = ['t-found'];
  assert.ok(hasIssue(issuesOf(unrouted), 'is not routed in "next"'), 'expected the unrouted-branch rejection');
});

// ───────────────────────────────────────────────────────────────────────────
// 4. The real payload, before and after
// ───────────────────────────────────────────────────────────────────────────

const PAYLOAD = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/wf-lead-003-controlled-upsert.json', import.meta.url)), 'utf8')
);

test('11. the real WF-LEAD-003 controlled-upsert payload passes validation', () => {
  assert.equal(PAYLOAD.actions.length, 29, 'fixture precondition: 29 actions');
  assert.equal(PAYLOAD.triggers.length, 11, 'fixture precondition: 11 triggers');
  const { valid, issues } = validateWorkflowGraph(PAYLOAD.actions, PAYLOAD.triggers, OPTS);
  assert.deepEqual(issues, [], `expected no issues, got:\n${issues.join('\n')}`);
  assert.equal(valid, true);
});

test('12. the same payload fails the pre-fix rule with the confirmed attributes.type error', () => {
  // Faithful re-implementation of rule (2) exactly as it stood before this change:
  // a flat lookup of each required input key on the node's attributes object, applied
  // to every catalog-backed node including transitions. This characterises the defect
  // in-suite; the end-to-end regression is additionally proved by reverting the commit.
  const legacyRequiredFieldIssues = (actions) => {
    const out = [];
    actions.forEach((a, i) => {
      const mod = lookupNativeModule(a.type, 'action') || lookupNativeModule(a.type);
      if (!mod) return;
      const inputs = mod.inputs || [];
      const dynamic = inputs.some((inp) => inp && (inp.dynamicFieldsConfig || String(inp.fieldType || '').toLowerCase().includes('dynamic')));
      if (dynamic) return;
      const attrs = a.attributes && typeof a.attributes === 'object' ? a.attributes : {};
      for (const inp of inputs) {
        if (!inp || inp.required !== true) continue;
        const field = String(inp.field || inp.name || '').trim();
        if (!field) continue;
        const v = attrs[field];
        if (v === undefined || v === null || v === '') {
          out.push(`action[${i}] "${a.type}": missing required field "${field}".`);
        }
      }
    });
    return out;
  };

  const legacy = legacyRequiredFieldIssues(PAYLOAD.actions);
  const transitionErrors = legacy.filter((m) => m.includes('"transition"') && m.includes('missing required field "attributes.type"'));
  assert.equal(transitionErrors.length, 2, `expected both transitions rejected by the pre-fix rule, got:\n${legacy.join('\n')}`);

  // And those two errors are the ONLY thing the pre-fix rule objected to: the payload
  // was always otherwise valid, so the connector was the sole blocker.
  assert.deepEqual(legacy, transitionErrors, `pre-fix rule raised unrelated issues:\n${legacy.join('\n')}`);
});
