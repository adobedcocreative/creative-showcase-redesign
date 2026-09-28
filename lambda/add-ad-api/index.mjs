// Creative Showcase "Add Ad" API.
// Handles: GET /ads, POST /ads/presign, POST /ads, DELETE /ads/{id}
// Expects API Gateway HTTP API with Lambda proxy integration, payload format 2.0.

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

const TABLE_NAME = process.env.TABLE_NAME;
const BUCKET_NAME = process.env.BUCKET_NAME;
// Accept either name — the AWS team's convention is SITE_ORIGIN; the README uses
// ALLOWED_ORIGIN. Reading both avoids a mismatch breaking CORS.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || process.env.SITE_ORIGIN || '*';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}

const REQUIRED_FIELDS = ['id', 'title', 'brand', 'category', 'campaignTypes', 'features', 'sizes'];
const CONTENT_TYPE_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

async function listAds() {
  const out = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
  return json(200, out.Items || []);
}

async function createAd(body) {
  for (const f of REQUIRED_FIELDS) {
    const v = body[f];
    if (v == null || (Array.isArray(v) && !v.length) || v === '') {
      return json(400, { error: `Missing required field: ${f}` });
    }
  }
  const item = {
    id: body.id,
    title: body.title,
    brand: body.brand,
    category: body.category,
    campaignTypes: body.campaignTypes,
    features: body.features,
    date: body.date || new Date().toISOString().slice(0, 10),
    sizes: body.sizes,
    createdAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return json(201, item);
}

async function deleteAd(id) {
  if (!id) return json(400, { error: 'Missing ad id' });
  await ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { id } }));

  // Best-effort cleanup of the ad's images; a failure here shouldn't fail the delete.
  try {
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: `ads/${id}/` }));
    const objects = listed.Contents || [];
    await Promise.all(objects.map((o) => s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: o.Key }))));
  } catch (err) {
    console.error('S3 cleanup failed for ad', id, err);
  }

  return json(200, { deleted: id });
}

async function presign(body) {
  const { adId, files } = body;
  if (!adId || !Array.isArray(files) || !files.length) {
    return json(400, { error: 'Missing adId or files' });
  }

  const uploads = await Promise.all(files.map(async ({ size, contentType }) => {
    const ext = CONTENT_TYPE_EXT[contentType] || 'bin';
    const key = `ads/${adId}/${size}.${ext}`;
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, ContentType: contentType }),
      { expiresIn: 300 }
    );
    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    return { size, uploadUrl, publicUrl, key };
  }));

  return json(200, { uploads });
}

// Works across API Gateway HTTP API (v2) / Lambda Function URLs, which put the
// method at event.requestContext.http.method, and REST API (v1) proxy
// integration, which uses event.httpMethod.
function getMethod(event) {
  return event.requestContext?.http?.method || event.httpMethod || '';
}

// v2 uses event.rawPath (which includes the stage for a named stage, e.g.
// "/live/ads"); v1 uses event.path (stage already stripped). Normalize both to
// the route starting at "/ads" so matching is stage-agnostic.
function getRoute(event) {
  const raw = event.rawPath || event.path || '';
  const i = raw.indexOf('/ads');
  const route = i >= 0 ? raw.slice(i) : raw;
  // Drop a trailing slash so "/ads/" matches "/ads" (but keep "/ads/{id}").
  return route.length > 4 && route.endsWith('/') ? route.slice(0, -1) : route;
}

function parseBody(event) {
  let body = event.body || '{}';
  if (event.isBase64Encoded) body = Buffer.from(body, 'base64').toString('utf8');
  return JSON.parse(body);
}

export const handler = async (event) => {
  const method = getMethod(event);
  const route = getRoute(event);

  try {
    if (method === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    if (method === 'GET' && route === '/ads') return await listAds();
    if (method === 'POST' && route === '/ads/presign') return await presign(parseBody(event));
    if (method === 'POST' && route === '/ads') return await createAd(parseBody(event));
    if (method === 'DELETE' && route.startsWith('/ads/')) {
      // Prefer the REST API path parameter when present; fall back to the route.
      const id = event.pathParameters?.id || route.slice('/ads/'.length);
      return await deleteAd(decodeURIComponent(id));
    }
    return json(404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Internal server error' });
  }
};
