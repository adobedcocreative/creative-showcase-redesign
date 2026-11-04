import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

async function loadHandler(send) {
  const context = vm.createContext({ process: { env: { TABLE_NAME: 'ads' } }, console, Buffer });
  const modules = {
    '@aws-sdk/client-dynamodb': { DynamoDBClient: class {} },
    '@aws-sdk/lib-dynamodb': {
      DynamoDBDocumentClient: { from: () => ({ send }) },
      ...Object.fromEntries(['PutCommand', 'ScanCommand', 'DeleteCommand', 'UpdateCommand'].map((name) => [name, class { constructor(input) { this.input = input; } }])),
    },
    '@aws-sdk/client-s3': { S3Client: class { async send() { return {}; } }, PutObjectCommand: class {}, DeleteObjectCommand: class {}, ListObjectsV2Command: class {} },
    '@aws-sdk/s3-request-presigner': { getSignedUrl: async () => '' },
  };
  const source = await readFile(new URL('./index.mjs', import.meta.url), 'utf8');
  const module = new vm.SourceTextModule(source, { context });
  await module.link((specifier) => {
    const exports = modules[specifier];
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    }, { context });
  });
  await module.evaluate();
  return module.namespace.handler;
}

const ad = { id: 'added-ad', title: 'Updated creative', brand: 'Brand', category: 'Retail', campaignTypes: ['Geo Targeting'], features: ['Mockup'], sizes: { '300x250': 'https://example.com/ad.png' } };
const event = (body = ad) => ({ httpMethod: 'PUT', path: '/ads/added-ad', body: JSON.stringify(body) });

test('editing without a token updates only mutable fields without an existence check', async () => {
  const handler = await loadHandler(async (command) => {
    assert.equal(command.input.Key.id, ad.id);
    assert.equal(command.input.ConditionExpression, undefined);
    assert.equal(command.input.ExpressionAttributeValues[':title'], ad.title);
    assert.equal(command.input.ExpressionAttributeValues[':sizes']['300x250'], ad.sizes['300x250']);
    assert.ok(!Object.values(command.input.ExpressionAttributeNames).includes('createdAt'));
    assert.ok(!Object.values(command.input.ExpressionAttributeNames).includes('date'));
    return { Attributes: { ...ad, createdAt: '2026-01-01', date: '2026-01-01' } };
  });
  const response = await handler(event());
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).createdAt, '2026-01-01');
  assert.ok(response.headers['Access-Control-Allow-Methods'].includes('PUT'));
});

test('editing accepts blank fields, no images, and a different body id', async () => {
  const handler = await loadHandler(async (command) => {
    assert.equal(command.input.Key.id, ad.id);
    assert.equal(command.input.ExpressionAttributeValues[':title'], '');
    assert.equal(Object.keys(command.input.ExpressionAttributeValues[':sizes']).length, 0);
    assert.equal(command.input.ExpressionAttributeValues[':campaignTypes'].length, 0);
    return { Attributes: { id: ad.id } };
  });
  assert.equal((await handler(event({ id: 'other-ad' }))).statusCode, 200);
  assert.equal((await handler(event({ title: '', brand: '', category: '', campaignTypes: [], features: [], sizes: {} }))).statusCode, 200);
});

test('creating accepts omitted fields and images', async () => {
  const handler = await loadHandler(async (command) => {
    assert.equal(command.input.Item.id, ad.id);
    assert.equal(command.input.Item.title, '');
    assert.equal(command.input.Item.features.length, 0);
    assert.equal(Object.keys(command.input.Item.sizes).length, 0);
    return {};
  });
  assert.equal((await handler({ ...event({ id: ad.id }), httpMethod: 'POST', path: '/ads' })).statusCode, 201);
});

test('image presigning accepts no files', async () => {
  const handler = await loadHandler(async () => ({}));
  const response = await handler({ httpMethod: 'POST', path: '/ads/presign', body: '{}' });
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).uploads.length, 0);
});

test('creating, image presigning, and deleting do not require a token', async () => {
  const handler = await loadHandler(async () => ({}));
  assert.equal((await handler({ ...event(), httpMethod: 'POST', path: '/ads' })).statusCode, 201);
  const response = await handler({
    httpMethod: 'POST',
    path: '/ads/presign',
    body: JSON.stringify({ adId: ad.id, files: [{ size: '300x250', contentType: 'image/png' }] }),
  });
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).uploads.length, 1);
  assert.equal((await handler({ ...event(), httpMethod: 'DELETE' })).statusCode, 200);
});