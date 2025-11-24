import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  SetMetadata,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { NewsService } from './news.service';

@Controller('blog')
export class BlogShareController {
  private readonly logger = new Logger(BlogShareController.name);

  constructor(private readonly newsService: NewsService) {}

  // Public HTML endpoint for social media crawlers to read OG/Twitter meta tags
  @Get('share/:id')
  @Get('share/:id/')
  @SetMetadata('isPublic', true)
  async shareHtml(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const news = await this.newsService.findOne(id);

      const siteBase = process.env.FRONTEND_URL || 'https://www.bricolaltd.com';
      const canonicalUrl = new URL(`/blog/${news.id}`, siteBase).href;

      const ensureAbsolute = (url?: string): string | undefined => {
        if (!url) return undefined;
        try {
          return new URL(url, siteBase).href;
        } catch {
          return url;
        }
      };

      const imageUrl =
        ensureAbsolute(news.imageUrl) || `${siteBase}/placeholder-blog.svg`;
      const title = news.title || 'Article Bricola';
      const sanitizeText = (input: string): string => {
        return input
          .replace(/<[^>]+>/g, ' ') // strip HTML tags if any
          .replace(/\s+/g, ' ') // normalize whitespace
          .trim();
      };
      const truncate = (input: string, max = 300): string =>
        input.length > max ? input.slice(0, max - 1) + '…' : input;

      const rawDescription = ((news as any).summary || '') as string;
      const normalizedDescription = sanitizeText(rawDescription || title);
      const description = truncate(normalizedDescription, 300);
      const fbAppId = process.env.FACEBOOK_APP_ID;

      // Detect social crawlers (serve 200 HTML); otherwise redirect users to canonical URL
      const ua = (req.headers['user-agent'] || '').toLowerCase();
      const isCrawler =
        /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|pinterest|embedly|quora|vk\s*share|meta-external|googlebot|bingbot|yandex|duckduckbot|baiduspider|applebot/.test(
          ua,
        );

      // If this is a user click from Facebook, fbclid is typically present → redirect
      const isFacebookClick =
        typeof req.query?.fbclid === 'string' && req.query.fbclid.length > 0;

      if (!isCrawler || isFacebookClick) {
        res.redirect(302, canonicalUrl);
        return;
      }

      const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${canonicalUrl}" />

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:alt" content="${escapeHtml(title)}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Bricola LTD" />
  <meta property="og:locale" content="fr_FR" />
  ${fbAppId ? `<meta property="fb:app_id" content="${fbAppId}" />` : ''}
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${imageUrl}" />
</head>
<body>
  <p>Page de partage pour les réseaux sociaux (crawler). Accédez à l’article ici :
    <a href="${canonicalUrl}">${canonicalUrl}</a>
  </p>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      res.status(200).send(html);
    } catch (err) {
      this.logger.error('Error generating share HTML', err);
      res.status(404).send('<html><body>Article non trouvé</body></html>');
    }
  }
}

// Simple HTML escaping to prevent breaking tags
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
