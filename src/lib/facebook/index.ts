import type { FacebookPublisher } from './publisher';
import { GraphApiPublisher } from './providers/graph-api';
import { PlaywrightPublisher } from './providers/playwright';
import type { PublishProvider } from '@/types';

export interface FbConfig {
  provider: PublishProvider;
  graphAccessToken?: string;
  playwrightStorageState?: string;
}

/** Đổi cách đăng Facebook chỉ bằng đổi `provider` trong settings. */
export function createPublisher(cfg: FbConfig): FacebookPublisher {
  if (cfg.provider === 'playwright') {
    if (!cfg.playwrightStorageState) throw new Error('Thiếu Playwright storageState');
    return new PlaywrightPublisher(cfg.playwrightStorageState);
  }
  if (!cfg.graphAccessToken) throw new Error('Thiếu Facebook access token');
  return new GraphApiPublisher(cfg.graphAccessToken);
}

export type { FacebookPublisher } from './publisher';
