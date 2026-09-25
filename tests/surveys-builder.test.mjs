// Offline tests for the internal surveys builder: HTTP client contract and summary.
//
// Run with: npm test   (builds to dist/, then node --test tests/*.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { SurveysBuilderClient } from '../dist/crm/surveys-builder-client.js';
import { summarizeSurvey } from '../dist/tools/surveys-builder.js';

const LOC = 'loc123';

function mockFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const r = responses.shift();
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), { status: r.status });
  };
  return { impl, calls };
}

function tokenProvider() {
  const seen = [];
  const fn = async (force) => {
    seen.push(Boolean(force));
    return force ? 'eyJfresh.aaaaaaaaaaaa.bbbb' : 'eyJcached.aaaaaaaaaaaa.bbbb';
  };
  return { fn, seen };
}

const SURVEY = {
  _id: 's1',
  name: 'Feedback',
  locationId: LOC,
  formData: {
    form: { company: { name: 'X' } },
    slides: [
      {
        id: '1790264773205-0',
        slideName: 'Slide 1',
        slideData: [
          { uuid: 'u1', type: 'text', tag: 'full_name', label: 'Full Name', required: true, standard: true },
          { uuid: 'u2', type: 'radio', tag: 'cf1', label: 'Pick', custom: true, standard: false },
        ],
      },
    ],
  },
};

test('client sends exactly channel/source/version/token-id and no Authorization', async () => {
  const { impl, calls } = mockFetch([{ status: 200, body: { survey: SURVEY, traceId: 't' } }]);
  const tp = tokenProvider();
  const c = new SurveysBuilderClient({ locationId: LOC, getIdToken: tp.fn, fetchImpl: impl });
  const doc = await c.getSurvey('s1');
  assert.equal(doc._id, 's1', 'GET /surveys/{id} { survey } envelope is unwrapped');
  assert.equal(calls[0].url, 'https://services.leadconnectorhq.com/surveys/s1');
  assert.equal(calls[0].init.method, 'GET');
  const h = calls[0].init.headers;
  assert.equal(h.channel, 'APP');
  assert.equal(h.source, 'WEB_USER');
  assert.equal(h.version, '2021-07-28');
  assert.equal(h['token-id'], 'eyJcached.aaaaaaaaaaaa.bbbb');
  assert.equal(Object.keys(h).some((k) => k.toLowerCase() === 'authorization'), false);
});

test('client unwraps the { data } envelope used by update/delete responses', async () => {
  const { impl } = mockFetch([{ status: 201, body: { data: SURVEY, traceId: 't' } }]);
  const c = new SurveysBuilderClient({ locationId: LOC, getIdToken: tokenProvider().fn, fetchImpl: impl });
  assert.equal((await c.getSurvey('s1'))._id, 's1');
});

test('client retries once with a forced token refresh on 401', async () => {
  const { impl, calls } = mockFetch([
    { status: 401, body: { message: 'Unauthorized: E003' } },
    { status: 200, body: { survey: SURVEY } },
  ]);
  const tp = tokenProvider();
  const c = new SurveysBuilderClient({ locationId: LOC, getIdToken: tp.fn, fetchImpl: impl });
  await c.getSurvey('s1');
  assert.deepEqual(tp.seen, [false, true]);
  assert.equal(calls[1].init.headers['token-id'], 'eyJfresh.aaaaaaaaaaaa.bbbb');
});

test('client errors carry the status and never echo a JWT', async () => {
  const { impl } = mockFetch([
    { status: 401, body: 'bad eyJaaaaaaaaaaaaaa.bbbbbbbb.cccccc' },
    { status: 401, body: 'bad eyJaaaaaaaaaaaaaa.bbbbbbbb.cccccc' },
  ]);
  const c = new SurveysBuilderClient({ locationId: LOC, getIdToken: tokenProvider().fn, fetchImpl: impl });
  await assert.rejects(c.getSurvey('s1'), (err) => {
    assert.equal(err.status, 401);
    assert.match(err.message, /\*\*\*/);
    assert.doesNotMatch(err.message, /eyJaaaa/);
    return true;
  });
});

test('client rejects a response without a survey document', async () => {
  const { impl } = mockFetch([{ status: 200, body: { traceId: 't' } }]);
  const c = new SurveysBuilderClient({ locationId: LOC, getIdToken: tokenProvider().fn, fetchImpl: impl });
  await assert.rejects(c.getSurvey('s1'), /Unexpected surveys API response shape/);
});

test('summary lists slides and questions and flags API-only documents', () => {
  const s = summarizeSurvey(SURVEY);
  assert.equal(s.slideCount, 1);
  assert.equal(s.slides[0].id, '1790264773205-0');
  assert.deepEqual(
    s.slides[0].questions.map((q) => [q.uuid, q.tag, q.required, q.custom]),
    [['u1', 'full_name', true, false], ['u2', 'cf1', false, true]]
  );
  assert.equal(s.builderSaved, false, 'no fieldStyle/fieldCSS yet');
  const saved = summarizeSurvey({
    ...SURVEY,
    formData: { ...SURVEY.formData, form: { fieldStyle: {} }, fieldCSS: '.x{}' },
  });
  assert.equal(saved.builderSaved, true);
});
