# Creative Showcase — Add Ad API

Backs the "Add Creative" feature in the Creative Showcase static site
(replaces the old localStorage-only persistence). One Lambda function
handles five routes, including updates to existing API-backed creatives.

## Runtime

- Node.js 20.x, handler `index.handler`, ES module (`"type": "module"` in package.json).
- Dependencies in `package.json` — bundle them into the deployment package (or
  a Lambda layer); they are not part of the default Node runtime.

## Routes (API Gateway HTTP API, Lambda proxy integration, payload format 2.0)

| Method | Path           | Purpose                                      |
|--------|----------------|-----------------------------------------------|
| GET    | /ads           | List all API-backed ads                      |
| POST   | /ads/presign   | Get pre-signed S3 PUT URLs for ad images     |
| POST   | /ads           | Create an ad record                          |
| PUT    | /ads/{id}      | Update an existing API-backed ad             |
| DELETE | /ads/{id}      | Delete an ad record (+ best-effort S3 cleanup)|

Enable CORS on the API for the site's origin, methods `GET, POST, PUT, DELETE,
OPTIONS`, headers `Content-Type`. The Lambda also returns CORS headers itself
as a fallback in case a REST API (v1) is used instead of HTTP API.

## Environment variables

| Name             | Example                          | Notes                              |
|------------------|-----------------------------------|-------------------------------------|
| `TABLE_NAME`     | `creative-showcase-ads`           | DynamoDB table name                |
| `BUCKET_NAME`    | `creative-showcase-ad-images`     | S3 bucket for ad creative images   |
| `ALLOWED_ORIGIN` | `https://your-showcase-site.com`  | Defaults to `*` if unset           |

## IAM permissions (execution role)

- DynamoDB, on `TABLE_NAME`: `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Scan`
- S3, on `BUCKET_NAME`: `PutObject`, `DeleteObject`, `ListBucket`

## Deploying editing support

1. Deploy the updated Lambda handler and its existing dependencies.
2. Add `PUT /ads/{id}` to API Gateway, using the same Lambda integration as the existing routes, and deploy the stage if auto-deploy is disabled.
3. Add `PUT` to API Gateway CORS and allow the `Content-Type` header.
4. Add `dynamodb:UpdateItem` for the existing table to the Lambda execution role.
5. Deploy the updated static site. Configure API Gateway write routes with no authorizer or API key requirement if either was previously enabled.

No new table, bucket, or S3 permissions are needed. No admin token or
authorization header is required. Anyone who can reach the API can create,
edit, upload images, and delete creatives.

Creative fields are not validated: blank details and empty image maps are
accepted. Omitted fields default to empty strings, arrays, or an image map.
Updates use the route ID, preserve existing `createdAt` and `date`, and set
`updatedAt`. Updating an unknown ID creates a record. DynamoDB still requires
a nonempty record ID, supplied automatically by the form for new creatives.
Existing image URLs are retained unless replaced or
removed in the form. Replacement uploads use `ads/{id}/revisions/{timestamp}/`
so a failed update cannot overwrite the currently published images. Old or
unreferenced images remain until the creative is deleted.

Run the isolated backend tests with `npm test`; they use mocked AWS clients
and do not need credentials or change live AWS resources.

## DynamoDB table

- Partition key: `id` (String)
- On-demand billing is sufficient for this workload.
- Items look like:
  ```json
  {
    "id": "3f2504e0-...",
    "title": "Summer Promo 2026",
    "brand": "Acme Corp",
    "category": "Retail",
    "campaignTypes": ["Creative Optimization", "Site Retargeting"],
    "features": ["Single Product", "Count Down"],
    "date": "2026-09-16",
    "sizes": {
      "300x250": "https://creative-showcase-ad-images.s3.amazonaws.com/ads/3f2504e0-.../300x250.png"
    },
    "createdAt": "2026-09-16T18:02:11.000Z"
  }
  ```

## S3 bucket

- The browser uploads images **directly to S3** using the pre-signed URLs
  returned by `POST /ads/presign` (the Lambda never sees image bytes).
- Bucket CORS policy must allow `PUT` from the site's origin, e.g.:
  ```json
  [
    {
      "AllowedOrigins": ["https://your-showcase-site.com"],
      "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["Content-Type"]
    }
  ]
  ```
- **Assumption:** uploaded objects need to be publicly readable so `<img>`
  tags in the gallery can load them directly (`https://{bucket}.s3.amazonaws.com/{key}`).
  This matches the site's current behavior (ads are non-sensitive marketing
  creative). If that's not acceptable, the alternative is serving images
  through CloudFront or generating signed GET URLs on every `GET /ads` call —
  flag it if you'd rather go that route, it changes `listAds()`.

## Request/response shapes

**POST /ads/presign**
```json
// request
{ "adId": "3f2504e0-...", "files": [{ "size": "300x250", "contentType": "image/png" }] }

// response
{ "uploads": [{ "size": "300x250", "uploadUrl": "https://...presigned...", "publicUrl": "https://.../ads/3f2504e0-.../300x250.png", "key": "ads/3f2504e0-.../300x250.png" }] }
```

**POST /ads** — body is the full ad object (see DynamoDB item shape above,
minus `createdAt` which the Lambda adds).

**DELETE /ads/{id}** — no body.

## Frontend wiring

Once deployed, give the app's base invoke URL (e.g.
`https://abc123.execute-api.us-east-1.amazonaws.com`) to be set as `API_BASE`
in `js/add-ad.js` (currently a placeholder at the top of the file).
