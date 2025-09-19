import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { EmailsService } from './emails.service';
import { CreateEmailDto } from './dto/create-email.dto';
import { UpdateEmailDto } from './dto/update-email.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SendGridService } from './sendgrid.service';

@ApiTags('emails')
@Controller('emails')
export class EmailsController {
  private readonly logger = new Logger(EmailsController.name);

  constructor(
    private readonly emailsService: EmailsService,
    private readonly sendGridService: SendGridService
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new email' })
  @ApiResponse({ status: 201, description: 'The email has been successfully created.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  create(@Body() createEmailDto: CreateEmailDto) {
    return this.emailsService.create(createEmailDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all emails' })
  @ApiResponse({ status: 200, description: 'Return all emails.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  findAll() {
    return this.emailsService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get an email by id' })
  @ApiResponse({ status: 200, description: 'Return the email.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  findOne(@Param('id') id: string) {
    return this.emailsService.findOne(id);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get emails by user id' })
  @ApiResponse({ status: 200, description: 'Return the emails.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findByUser(@Param('userId') userId: string) {
    return this.emailsService.findByUser(userId);
  }

  @Get('user/:userId/unread')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unread emails by user id' })
  @ApiResponse({ status: 200, description: 'Return the unread emails.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findUnreadByUser(@Param('userId') userId: string) {
    return this.emailsService.findUnreadByUser(userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an email' })
  @ApiResponse({ status: 200, description: 'The email has been successfully updated.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  update(@Param('id') id: string, @Body() updateEmailDto: UpdateEmailDto) {
    return this.emailsService.update(id, updateEmailDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an email' })
  @ApiResponse({ status: 200, description: 'The email has been successfully deleted.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  remove(@Param('id') id: string) {
    return this.emailsService.remove(id);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark an email as read' })
  @ApiResponse({ status: 200, description: 'The email has been successfully marked as read.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  markAsRead(@Param('id') id: string) {
    return this.emailsService.markAsRead(id);
  }

  @Patch(':id/unread')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark an email as unread' })
  @ApiResponse({ status: 200, description: 'The email has been successfully marked as unread.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  markAsUnread(@Param('id') id: string) {
    return this.emailsService.markAsUnread(id);
  }

  @Post('test-sendgrid')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async testSendGrid(@Body() body: { email: string }) {
    try {
      const result = await this.sendGridService.sendTestEmail(body.email);
      if (result) {
        return {
          success: true,
          message: 'Test email sent successfully',
          data: { email: body.email }
        };
      } else {
        return {
          success: false,
          message: 'Failed to send test email'
        };
      }
    } catch (error) {
      this.logger.error('Error sending test email:', error);
      throw new HttpException(
        'Failed to send test email',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('send-contact-response')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async sendContactResponse(@Body() body: { 
    email: string; 
    name: string; 
    subject: string; 
    response: string; 
  }) {
    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Réponse de Bricola</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #007bff, #0056b3); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px 20px; background: #ffffff; border: 1px solid #e9ecef; }
            .response-box { margin: 20px 0; padding: 20px; background: #f8f9fa; border-left: 4px solid #007bff; border-radius: 0 8px 8px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f8f9fa; border-radius: 0 0 8px 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">🏠 Bricola</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Réponse à votre demande</p>
            </div>
            <div class="content">
              <h2 style="color: #007bff; margin-top: 0;">Bonjour ${body.name},</h2>
              <p>Nous avons bien reçu votre message et nous vous remercions de nous avoir contactés.</p>
              
              <div class="response-box">
                <h3 style="margin-top: 0; color: #007bff;">Notre réponse :</h3>
                <p style="margin-bottom: 0;">${body.response.replace(/\n/g, '<br>')}</p>
              </div>
              
              <p>Si vous avez d'autres questions, n'hésitez pas à nous recontacter.</p>
              <p>Cordialement,<br><strong>L'équipe Bricola</strong></p>
            </div>
            <div class="footer">
              <p>© 2024 Bricola. Tous droits réservés.</p>
              <p>Email : admin@bricola.com | Téléphone : +33 1 23 45 67 89</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const text = `
Réponse de Bricola

Bonjour ${body.name},

Nous avons bien reçu votre message et nous vous remercions de nous avoir contactés.

Notre réponse :
${body.response}

Si vous avez d'autres questions, n'hésitez pas à nous recontacter.

Cordialement,
L'équipe Bricola

© 2024 Bricola. Tous droits réservés.
Email : admin@bricola.com | Téléphone : +33 1 23 45 67 89
      `;

      const result = await this.sendGridService.sendEmail({
        to: body.email,
        subject: `Re: ${body.subject}`,
        html,
        text
      });

      if (result) {
        return {
          success: true,
          message: 'Contact response sent successfully',
          data: { email: body.email, subject: body.subject }
        };
      } else {
        return {
          success: false,
          message: 'Failed to send contact response'
        };
      }
    } catch (error) {
      this.logger.error('Error sending contact response:', error);
      throw new HttpException(
        'Failed to send contact response',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}