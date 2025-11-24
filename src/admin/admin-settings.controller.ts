import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminSettingsService } from './admin-settings.service';
import { CreateSettingDto, UpdateSettingDto } from './dto/settings.dto';
import { SettingCategory } from './entities/setting.entity';

@ApiTags('admin-settings')
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all platform settings' })
  @ApiResponse({ status: 200, description: 'Platform settings' })
  async getAllSettings() {
    return this.adminSettingsService.getAllSettings();
  }

  @Get('category/:category')
  @ApiOperation({ summary: 'Get settings by category' })
  @ApiResponse({ status: 200, description: 'Settings by category' })
  async getSettingsByCategory(@Param('category') category: string) {
    return this.adminSettingsService.getSettingsByCategory(
      category as SettingCategory,
    );
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get specific setting by key' })
  @ApiResponse({ status: 200, description: 'Setting value' })
  async getSetting(@Param('key') key: string) {
    return this.adminSettingsService.getSetting(key);
  }

  @Post()
  @ApiOperation({ summary: 'Create new setting' })
  @ApiResponse({ status: 201, description: 'Setting created successfully' })
  async createSetting(@Body() createSettingDto: CreateSettingDto) {
    return this.adminSettingsService.createSetting(createSettingDto);
  }

  @Put(':key')
  @ApiOperation({ summary: 'Update setting value' })
  @ApiResponse({ status: 200, description: 'Setting updated successfully' })
  async updateSetting(
    @Param('key') key: string,
    @Body() updateSettingDto: UpdateSettingDto,
  ) {
    return this.adminSettingsService.updateSetting(key, updateSettingDto);
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete setting' })
  @ApiResponse({ status: 200, description: 'Setting deleted successfully' })
  async deleteSetting(@Param('key') key: string) {
    return this.adminSettingsService.deleteSetting(key);
  }

  @Post('bulk-update')
  @ApiOperation({ summary: 'Bulk update multiple settings' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  async bulkUpdateSettings(@Body() settings: Record<string, any>) {
    return this.adminSettingsService.bulkUpdateSettings(settings);
  }

  @Post('export')
  @ApiOperation({ summary: 'Export settings configuration' })
  @ApiResponse({ status: 200, description: 'Settings exported successfully' })
  async exportSettings() {
    return this.adminSettingsService.exportSettings();
  }

  @Post('import')
  @ApiOperation({ summary: 'Import settings configuration' })
  @ApiResponse({ status: 200, description: 'Settings imported successfully' })
  async importSettings(@Body() settings: any) {
    return this.adminSettingsService.importSettings(settings);
  }

  @Post('reset/:category')
  @ApiOperation({ summary: 'Reset settings category to defaults' })
  @ApiResponse({ status: 200, description: 'Settings reset successfully' })
  async resetCategoryToDefaults(@Param('category') category: string) {
    return this.adminSettingsService.resetCategoryToDefaults(
      category as SettingCategory,
    );
  }
}
