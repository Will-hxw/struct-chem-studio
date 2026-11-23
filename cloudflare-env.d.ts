declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    GMAIL_TOKEN_KEY?: string;
    GMAIL_CLIENT_ID?: string;
    GMAIL_CLIENT_SECRET?: string;
    GMAIL_SENDER?: string;
    GMAIL_REDIRECT_URI?: string;
    GMAIL_REFRESH_TOKEN?: string;
    OPENAI_API_KEY?: string;
    DEEPSEEK_API_KEY?: string;
  }
}
