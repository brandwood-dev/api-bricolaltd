import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { UserPreferenceService } from './user-preference.service';
import { CreateUserPreferenceDto } from './dto/create-user-preference.dto';
import { UpdateUserPreferenceDto } from './dto/update-user-preference.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('user-preferences')
@UseGuards(JwtAuthGuard)
export class UserPreferenceController {
  constructor(private readonly userPreferenceService: UserPreferenceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createUserPreferenceDto: CreateUserPreferenceDto,
    @Request() req,
  ) {
    // Ensure user can only create their own preferences
    createUserPreferenceDto.userId = req.user.id;
    return await this.userPreferenceService.create(createUserPreferenceDto);
  }

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async findAll() {
    return await this.userPreferenceService.findAll();
  }

  @Get('my-preferences')
  async getMyPreferences(@Request() req) {
    return await this.userPreferenceService.findByUserId(req.user.id);
  }

  @Get('my-notifications')
  async getMyNotificationSettings(@Request() req) {
    return await this.userPreferenceService.getNotificationSettings(
      req.user.id,
    );
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async findOne(@Param('id') id: string) {
    return await this.userPreferenceService.findOne(id);
  }

  @Get('user/:userId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async findByUserId(@Param('userId') userId: string) {
    return await this.userPreferenceService.findByUserId(userId);
  }

  @Patch('my-preferences')
  async updateMyPreferences(
    @Body() updateUserPreferenceDto: UpdateUserPreferenceDto,
    @Request() req,
  ) {
    return await this.userPreferenceService.updateByUserId(
      req.user.id,
      updateUserPreferenceDto,
    );
  }

  @Patch('my-notifications')
  async updateMyNotificationSettings(
    @Body()
    settings: {
      emailNotifications?: boolean;
      pushNotifications?: boolean;
      smsNotifications?: boolean;
      marketingEmails?: boolean;
    },
    @Request() req,
  ) {
    return await this.userPreferenceService.updateNotificationSettings(
      req.user.id,
      settings,
    );
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateUserPreferenceDto: UpdateUserPreferenceDto,
  ) {
    return await this.userPreferenceService.update(id, updateUserPreferenceDto);
  }

  @Delete('my-preferences')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMyPreferences(@Request() req) {
    await this.userPreferenceService.removeByUserId(req.user.id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.userPreferenceService.remove(id);
  }
}
