/** Hợp đồng chung cho mọi cách đăng Facebook. Đổi provider không đổi caller. */
export interface PublishResult {
  success: boolean;
  fbPostId?: string;
  message?: string;
  raw?: unknown;
}

export interface PublishInput {
  message: string;
  imageUrls?: string[];
  /** đích đăng: group id hoặc page id (tuỳ provider) */
  targetId: string;
}

export interface SchedulePublishInput extends PublishInput {
  /** epoch seconds — Graph API hỗ trợ scheduled_publish_time cho Page */
  scheduledAt: number;
}

export interface FacebookPublisher {
  readonly name: 'graph_api' | 'playwright';
  publishPost(input: PublishInput): Promise<PublishResult>;
  schedulePost(input: SchedulePublishInput): Promise<PublishResult>;
  uploadImage(imageUrl: string, targetId: string): Promise<string>; // -> attachment/media id
}
