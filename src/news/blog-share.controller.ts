import { Controller, Get, Param, Req, Res, SetMetadata, Logger } from '@nestjs/common';
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
  async shareHtml(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    try {
      const news = await this.newsService.findOne(id);

      const siteBase = process.env.FRONTEND_URL || 'https://www.bricolaltd.com';
      const canonicalUrl = new URL(`/blog/${news.id}`, siteBase).href;

      const ensureAbsolute = (url?: string): string | undefined => {
        if (!url) return undefined;
        try {
          return new URL(url, siteBase).href;
        } catch {
          return url as string;
        }
      };

      const imageUrl = ensureAbsolute(news.imageUrl) || `${siteBase}/placeholder-blog.svg`;
      const title = news.title || 'Article Bricola';
      const description = news.summary || title;

      const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="canonical" href="${canonicalUrl}" />

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${imageUrl}" />
</head>
<body>
  <p>Page de partage pour les réseaux sociaux. Accédez à l’article ici :
    <a href="${canonicalUrl}">${canonicalUrl}</a>
  </p>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(html);
    } catch (err) {
      this.logger.error('Error generating share HTML', err as any);
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