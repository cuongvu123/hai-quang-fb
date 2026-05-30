import type {
  FacebookPublisher, PublishInput, PublishResult, SchedulePublishInput,
} from '../publisher';

const GRAPH = 'https://graph.facebook.com/v21.0';

/**
 * Provider 1 — Facebook Graph API (chính thức).
 * Lưu ý: Graph API KHÔNG cho đăng vào Group qua app thường kể từ 2024+.
 * Provider này hướng tới đăng lên Page (mô hình Page liên kết cộng đồng),
 * hoặc dùng cho các tổ chức đã được Facebook cấp quyền group.
 */
export class GraphApiPublisher implements FacebookPublisher {
  readonly name = 'graph_api' as const;
  constructor(private accessToken: string) {}

  async uploadImage(imageUrl: string, targetId: string): Promise<string> {
    const res = await fetch(`${GRAPH}/${targetId}/photos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: imageUrl,
        published: false, // upload không công khai, lấy media_fbid để gắn vào post
        access_token: this.accessToken,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`uploadImage: ${JSON.stringify(data)}`);
    return data.id as string;
  }

  async publishPost(input: PublishInput): Promise<PublishResult> {
    return this.post(input);
  }

  async schedulePost(input: SchedulePublishInput): Promise<PublishResult> {
    // Graph API yêu cầu scheduled_publish_time cách hiện tại 10 phút–6 tháng.
    return this.post(input, input.scheduledAt);
  }

  private async post(
    input: PublishInput,
    scheduledAt?: number,
  ): Promise<PublishResult> {
    try {
      const body: Record<string, unknown> = {
        message: input.message,
        access_token: this.accessToken,
      };

      if (input.imageUrls?.length) {
        const mediaIds = await Promise.all(
          input.imageUrls.map((u) => this.uploadImage(u, input.targetId)),
        );
        body.attached_media = mediaIds.map((id) => ({ media_fbid: id }));
      }
      if (scheduledAt) {
        body.published = false;
        body.scheduled_publish_time = scheduledAt;
      }

      const res = await fetch(`${GRAPH}/${input.targetId}/feed`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: JSON.stringify(data), raw: data };
      }
      return { success: true, fbPostId: data.id, raw: data };
    } catch (e) {
      return { success: false, message: (e as Error).message };
    }
  }
}
