import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting, SettingCategory, SettingType } from './entities/setting.entity';
import { CreateSettingDto, UpdateSettingDto } from './dto/settings.dto';

@Injectable()
export class AdminSettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {
    this.initializeDefaultSettings();
  }

  private async initializeDefaultSettings() {
    const existingSettings = await this.settingRepository.count();
    if (existingSettings > 0) {
      return; // Settings already initialized
    }

    const defaultSettings = [
      {
        category: SettingCategory.GENERAL,
        key: 'platform_name',
        value: 'Bricola',
        defaultValue: 'Bricola',
        type: SettingType.STRING,
        description: 'Platform name displayed to users',
        isPublic: true,
        isActive: true,
      },
      {
        category: SettingCategory.PAYMENT,
        key: 'commission_rate',
        value: '0.15',
        defaultValue: '0.15',
        type: SettingType.NUMBER,
        description: 'Platform commission rate (15%)',
        isPublic: false,
        isActive: true,
      },
      {
        category: SettingCategory.PAYMENT,
        key: 'stripe_public_key',
        value: '',
        defaultValue: '',
        type: SettingType.STRING,
        description: 'Stripe publishable key',
        isPublic: true,
        isActive: true,
      },
      {
        category: SettingCategory.PAYMENT,
        key: 'stripe_secret_key',
        value: '',
        defaultValue: '',
        type: SettingType.PASSWORD,
        description: 'Stripe secret key',
        isPublic: false,
        isEncrypted: true,
        isActive: true,
      },
      {
        category: SettingCategory.EMAIL,
        key: 'smtp_host',
        value: '',
        defaultValue: '',
        type: SettingType.STRING,
        description: 'SMTP server hostname',
        isPublic: false,
        isActive: true,
      },
      {
        category: SettingCategory.EMAIL,
        key: 'smtp_port',
        value: '587',
        defaultValue: '587',
        type: SettingType.NUMBER,
        description: 'SMTP server port',
        isPublic: false,
        isActive: true,
      },
      {
        category: SettingCategory.SECURITY,
        key: 'session_timeout',
        value: '3600',
        defaultValue: '3600',
        type: SettingType.NUMBER,
        description: 'Session timeout in seconds',
        isPublic: false,
        isActive: true,
      },
      {
        category: SettingCategory.SECURITY,
        key: 'max_login_attempts',
        value: '5',
        defaultValue: '5',
        type: SettingType.NUMBER,
        description: 'Maximum login attempts before account lockout',
        isPublic: false,
        isActive: true,
      },
      {
        category: SettingCategory.NOTIFICATION,
        key: 'email_notifications_enabled',
        value: 'true',
        defaultValue: 'true',
        type: SettingType.BOOLEAN,
        description: 'Enable email notifications',
        isPublic: false,
        isActive: true,
      },
    ];

    await this.settingRepository.save(defaultSettings);
  }

  async getAllSettings(): Promise<Setting[]> {
    return this.settingRepository.find({
      where: { isActive: true },
      order: { category: 'ASC', key: 'ASC' },
    });
  }

  async getSettingsByCategory(category: SettingCategory): Promise<Setting[]> {
    return this.settingRepository.find({
      where: { category, isActive: true },
      order: { key: 'ASC' },
    });
  }

  async getSetting(key: string): Promise<Setting> {
    const setting = await this.settingRepository.findOne({
      where: { key, isActive: true },
    });

    if (!setting) {
      throw new NotFoundException(`Setting with key '${key}' not found`);
    }

    return setting;
  }

  async getSettingValue(key: string): Promise<any> {
    const setting = await this.getSetting(key);
    return this.parseSettingValue(setting);
  }

  async createSetting(createSettingDto: CreateSettingDto): Promise<Setting> {
    const existingSetting = await this.settingRepository.findOne({
      where: { category: createSettingDto.category, key: createSettingDto.key },
    });

    if (existingSetting) {
      throw new Error(`Setting with key '${createSettingDto.key}' already exists in category '${createSettingDto.category}'`);
    }

    const setting = this.settingRepository.create(createSettingDto);
    return this.settingRepository.save(setting);
  }

  async updateSetting(key: string, updateSettingDto: UpdateSettingDto): Promise<Setting> {
    const setting = await this.getSetting(key);
    
    Object.assign(setting, updateSettingDto);
    if (updateSettingDto.updatedBy !== undefined) {
      setting.updatedBy = updateSettingDto.updatedBy;
    }
    
    return this.settingRepository.save(setting);
  }

  async deleteSetting(key: string): Promise<void> {
    const setting = await this.getSetting(key);
    setting.isActive = false;
    await this.settingRepository.save(setting);
  }

  async bulkUpdateSettings(settings: Record<string, any>, updatedBy?: string): Promise<Setting[]> {
    const updatedSettings: Setting[] = [];

    for (const [key, value] of Object.entries(settings)) {
      try {
        const setting = await this.updateSetting(key, { value, updatedBy });
        updatedSettings.push(setting);
      } catch (error) {
        // Log error but continue with other settings
        console.error(`Failed to update setting ${key}:`, error.message);
      }
    }

    return updatedSettings;
  }

  async exportSettings(): Promise<Record<string, any>> {
    const settings = await this.getAllSettings();
    const exportData: Record<string, any> = {};

    for (const setting of settings) {
      if (!setting.isEncrypted) {
        exportData[`${setting.category}.${setting.key}`] = {
          value: this.parseSettingValue(setting),
          type: setting.type,
          description: setting.description,
          isPublic: setting.isPublic,
        };
      }
    }

    return {
      exportedAt: new Date().toISOString(),
      settings: exportData,
    };
  }

  async importSettings(importData: any): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];

    for (const [fullKey, settingData] of Object.entries(importData)) {
      try {
        const [category, key] = fullKey.split('.');
        if (!category || !key) {
          errors.push(`Invalid key format: ${fullKey}`);
          continue;
        }

        const typedSettingData = settingData as { value: string };
        await this.updateSetting(key, {
          value: typedSettingData.value,
          updatedBy: 'import',
        });
        imported++;
      } catch (error) {
        errors.push(`Failed to import ${fullKey}: ${error.message}`);
      }
    }

    return { imported, errors };
  }

  async resetCategoryToDefaults(category: SettingCategory): Promise<Setting[]> {
    const settings = await this.getSettingsByCategory(category);
    const resetSettings: Setting[] = [];

    for (const setting of settings) {
      if (setting.defaultValue !== null) {
        setting.value = setting.defaultValue;
        const updated = await this.settingRepository.save(setting);
        resetSettings.push(updated);
      }
    }

    return resetSettings;
  }

  private parseSettingValue(setting: Setting): any {
    if (setting.value === null) {
      return setting.defaultValue ? this.parseValueByType(setting.defaultValue, setting.type) : null;
    }

    return this.parseValueByType(setting.value, setting.type);
  }

  private parseValueByType(value: string, type: SettingType): any {
    switch (type) {
      case SettingType.BOOLEAN:
        return value === 'true';
      case SettingType.NUMBER:
        return parseFloat(value);
      case SettingType.JSON:
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      default:
        return value;
    }
  }
}