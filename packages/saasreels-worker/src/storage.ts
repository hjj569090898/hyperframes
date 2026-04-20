import { readFile } from "node:fs/promises";
import { AwsClient } from "aws4fetch";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicDomain?: string;
};

export class R2Storage {
  private client: AwsClient;
  private bucket: string;
  private endpoint: string;
  private publicDomain?: string;

  constructor(config: R2Config) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: "auto",
    });
    this.bucket = config.bucket;
    this.endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
    this.publicDomain = config.publicDomain;
  }

  async uploadVideo(filePath: string, key: string): Promise<string> {
    const body = await readFile(filePath);
    const url = `${this.endpoint}/${this.bucket}/${key}`;

    const res = await this.client.fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
      },
      body,
    });

    if (!res.ok) {
      throw new Error(`Failed to upload to R2: ${res.statusText} (${res.status})`);
    }

    return this.publicDomain ? `${this.publicDomain}/${key}` : url;
  }
}
