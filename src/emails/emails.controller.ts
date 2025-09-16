import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Test SendGrid email sending' })
  @ApiResponse({ status: 200, description: 'Test email sent successfully.' })
  @ApiResponse({ status: 400, description: 'Failed to send test email.' })
  async testSendGrid(@Query('to') to: string = 'contact@bricolaltd.com') {
    try {
      const success = await this.sendGridService.sendTestEmail(to);
      
      if (success) {
        return {
          data: {
            success: true,
            message: `Test email sent successfully to ${to}`,
            timestamp: new Date().toISOString(),
            service: 'SendGrid'
          },
          message: 'Request successful'
        };
      } else {
        return {
          data: {
            success: false,
            message: `Failed to send test email to ${to}`,
            timestamp: new Date().toISOString(),
            service: 'SendGrid'
          },
          message: 'Email sending failed'
        };
      }
    } catch (error) {
      return {
        data: {
          success: false,
          message: `Error sending test email: ${error.message}`,
          timestamp: new Date().toISOString(),
          service: 'SendGrid',
          error: error.message
        },
        message: 'Request failed'
      };
    }
  }
}