import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as synced from "@pulumi/synced-folder";

const config = new pulumi.Config();
const domain = config.require("domain");
const contentPath = "../docs/public";

// ---------------------------------------------------------------------------
// 1. Route 53 — lookup existing hosted zone
// ---------------------------------------------------------------------------
const zone = aws.route53.getZoneOutput({ name: domain });

// ---------------------------------------------------------------------------
// 2. ACM Certificate (must be in us-east-1 for CloudFront — set via stack config)
// ---------------------------------------------------------------------------
const certificate = new aws.acm.Certificate("certificate", {
  domainName: domain,
  subjectAlternativeNames: [`www.${domain}`],
  validationMethod: "DNS",
});

// ---------------------------------------------------------------------------
// 3. DNS validation records
// ---------------------------------------------------------------------------
const certValidationRecord = new aws.route53.Record("cert-validation", {
  zoneId: zone.zoneId,
  name: certificate.domainValidationOptions[0].resourceRecordName,
  type: certificate.domainValidationOptions[0].resourceRecordType,
  records: [certificate.domainValidationOptions[0].resourceRecordValue],
  ttl: 60,
  allowOverwrite: true,
});

const certValidationRecordWww = new aws.route53.Record("cert-validation-www", {
  zoneId: zone.zoneId,
  name: certificate.domainValidationOptions[1].resourceRecordName,
  type: certificate.domainValidationOptions[1].resourceRecordType,
  records: [certificate.domainValidationOptions[1].resourceRecordValue],
  ttl: 60,
  allowOverwrite: true,
});

// ---------------------------------------------------------------------------
// 4. Wait for certificate validation
// ---------------------------------------------------------------------------
const certificateValidation = new aws.acm.CertificateValidation(
  "certificate-validation",
  {
    certificateArn: certificate.arn,
    validationRecordFqdns: [
      certValidationRecord.fqdn,
      certValidationRecordWww.fqdn,
    ],
  }
);

// ---------------------------------------------------------------------------
// 5. S3 Bucket (private — CloudFront accesses via OAC)
// ---------------------------------------------------------------------------
const bucket = new aws.s3.BucketV2("website-bucket", {
  bucket: domain,
});

const ownershipControls = new aws.s3.BucketOwnershipControls(
  "ownership-controls",
  {
    bucket: bucket.id,
    rule: { objectOwnership: "BucketOwnerEnforced" },
  }
);

const publicAccessBlock = new aws.s3.BucketPublicAccessBlock(
  "public-access-block",
  {
    bucket: bucket.id,
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
  }
);

// ---------------------------------------------------------------------------
// 6. CloudFront Origin Access Control
// ---------------------------------------------------------------------------
const oac = new aws.cloudfront.OriginAccessControl("oac", {
  name: `${domain}-oac`,
  originAccessControlOriginType: "s3",
  signingBehavior: "always",
  signingProtocol: "sigv4",
});

// ---------------------------------------------------------------------------
// 7. CloudFront Function — www redirect + subdirectory index.html rewrite
// ---------------------------------------------------------------------------
const requestHandler = new aws.cloudfront.Function("request-handler", {
  name: "v-ibe-request-handler",
  runtime: "cloudfront-js-2.0",
  publish: true,
  code: `
function handler(event) {
  var request = event.request;
  var host = request.headers.host.value;

  // Redirect www to apex
  if (host === 'www.${domain}') {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: {
        location: { value: 'https://${domain}' + request.uri }
      }
    };
  }

  // Rewrite /path/ to /path/index.html (subdirectory index resolution)
  var uri = request.uri;
  if (uri.endsWith('/')) {
    request.uri += 'index.html';
  } else if (!uri.includes('.')) {
    request.uri += '/index.html';
  }

  return request;
}
`,
});

// ---------------------------------------------------------------------------
// 8. CloudFront Distribution
// ---------------------------------------------------------------------------
const distribution = new aws.cloudfront.Distribution("distribution", {
  enabled: true,
  isIpv6Enabled: true,
  defaultRootObject: "index.html",
  aliases: [domain, `www.${domain}`],

  origins: [
    {
      domainName: bucket.bucketRegionalDomainName,
      originId: "s3Origin",
      originAccessControlId: oac.id,
    },
  ],

  defaultCacheBehavior: {
    targetOriginId: "s3Origin",
    viewerProtocolPolicy: "redirect-to-https",
    allowedMethods: ["GET", "HEAD", "OPTIONS"],
    cachedMethods: ["GET", "HEAD"],
    compress: true,
    forwardedValues: {
      queryString: false,
      cookies: { forward: "none" },
    },
    minTtl: 0,
    defaultTtl: 86400,
    maxTtl: 31536000,
    functionAssociations: [
      {
        eventType: "viewer-request",
        functionArn: requestHandler.arn,
      },
    ],
  },

  // S3 returns 403 for missing objects when using OAC, so map both 403 and 404
  customErrorResponses: [
    {
      errorCode: 403,
      responseCode: 404,
      responsePagePath: "/404.html",
      errorCachingMinTtl: 300,
    },
    {
      errorCode: 404,
      responseCode: 404,
      responsePagePath: "/404.html",
      errorCachingMinTtl: 300,
    },
  ],

  restrictions: {
    geoRestriction: { restrictionType: "none" },
  },

  viewerCertificate: {
    acmCertificateArn: certificateValidation.certificateArn,
    sslSupportMethod: "sni-only",
    minimumProtocolVersion: "TLSv1.2_2021",
  },
});

// ---------------------------------------------------------------------------
// 9. S3 Bucket Policy — allow CloudFront via OAC
// ---------------------------------------------------------------------------
const bucketPolicy = new aws.s3.BucketPolicy("bucket-policy", {
  bucket: bucket.id,
  policy: pulumi
    .all([bucket.arn, distribution.arn])
    .apply(([bucketArn, distArn]) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "AllowCloudFrontServicePrincipalReadOnly",
            Effect: "Allow",
            Principal: { Service: "cloudfront.amazonaws.com" },
            Action: "s3:GetObject",
            Resource: `${bucketArn}/*`,
            Condition: {
              StringEquals: { "AWS:SourceArn": distArn },
            },
          },
        ],
      })
    ),
});

// ---------------------------------------------------------------------------
// 10. Sync Hugo build output to S3
// ---------------------------------------------------------------------------
const syncedFolder = new synced.S3BucketFolder("synced-folder", {
  path: contentPath,
  bucketName: bucket.bucket,
  acl: "private",
});

// ---------------------------------------------------------------------------
// 11. Route 53 DNS records — A and AAAA for apex and www
// ---------------------------------------------------------------------------
const apexA = new aws.route53.Record("apex-a", {
  zoneId: zone.zoneId,
  name: domain,
  type: "A",
  aliases: [
    {
      name: distribution.domainName,
      zoneId: distribution.hostedZoneId,
      evaluateTargetHealth: false,
    },
  ],
});

const apexAAAA = new aws.route53.Record("apex-aaaa", {
  zoneId: zone.zoneId,
  name: domain,
  type: "AAAA",
  aliases: [
    {
      name: distribution.domainName,
      zoneId: distribution.hostedZoneId,
      evaluateTargetHealth: false,
    },
  ],
});

const wwwA = new aws.route53.Record("www-a", {
  zoneId: zone.zoneId,
  name: `www.${domain}`,
  type: "A",
  aliases: [
    {
      name: distribution.domainName,
      zoneId: distribution.hostedZoneId,
      evaluateTargetHealth: false,
    },
  ],
});

const wwwAAAA = new aws.route53.Record("www-aaaa", {
  zoneId: zone.zoneId,
  name: `www.${domain}`,
  type: "AAAA",
  aliases: [
    {
      name: distribution.domainName,
      zoneId: distribution.hostedZoneId,
      evaluateTargetHealth: false,
    },
  ],
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export const bucketName = bucket.bucket;
export const distributionId = distribution.id;
export const distributionDomainName = distribution.domainName;
export const websiteUrl = `https://${domain}`;
