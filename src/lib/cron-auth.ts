import { NextRequest } from 'next/server';

/** Bảo vệ cron endpoint bằng CRON_SECRET (header Authorization: Bearer ...). */
export function assertCron(req: NextRequest): void {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    throw new Response('Unauthorized', { status: 401 });
  }
}

/** Tenant đang phục vụ. Bản single-tenant lấy từ env; SaaS thì lặp tất cả tenants. */
export function defaultTenantId(): string {
  return process.env.DEFAULT_TENANT_ID!;
}
