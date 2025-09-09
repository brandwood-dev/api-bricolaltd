import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpStatus,
  HttpCode,
  Query,
} from '@nestjs/common';
import { CountryService } from './country.service';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('countries')
@Controller('countries')
export class CountryController {
  constructor(private readonly countryService: CountryService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new country (Admin only)' })
  @ApiResponse({ status: 201, description: 'Country created successfully' })
  async create(@Body() createCountryDto: CreateCountryDto) {
    return await this.countryService.create(createCountryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all countries' })
  @ApiResponse({ status: 200, description: 'List of all countries' })
  async findAll() {
    return await this.countryService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Get all active countries' })
  @ApiResponse({ status: 200, description: 'List of active countries' })
  async findActive() {
    return await this.countryService.findActive();
  }

  @Get('continent/:continent')
  @ApiOperation({ summary: 'Get countries by continent' })
  @ApiResponse({ status: 200, description: 'List of countries in the specified continent' })
  async findByContinent(@Param('continent') continent: string) {
    return await this.countryService.findByContinent(continent);
  }

  @Get('currencies')
  @ApiOperation({ summary: 'Get all currencies with their countries' })
  @ApiResponse({ status: 200, description: 'List of currencies and associated countries' })
  async getCurrencies() {
    return await this.countryService.getCurrencies();
  }

  @Get('phone-prefixes')
  @ApiOperation({ summary: 'Get all phone prefixes with their countries' })
  @ApiResponse({ status: 200, description: 'List of phone prefixes and associated countries' })
  async getPhonePrefixes() {
    return await this.countryService.getPhonePrefixes();
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Get country by code' })
  @ApiResponse({ status: 200, description: 'Country found' })
  @ApiResponse({ status: 404, description: 'Country not found' })
  async findByCode(@Param('code') code: string) {
    return await this.countryService.findByCode(code);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get country by ID' })
  @ApiResponse({ status: 200, description: 'Country found' })
  @ApiResponse({ status: 404, description: 'Country not found' })
  async findOne(@Param('id') id: string) {
    return await this.countryService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update country (Admin only)' })
  @ApiResponse({ status: 200, description: 'Country updated successfully' })
  async update(@Param('id') id: string, @Body() updateCountryDto: UpdateCountryDto) {
    return await this.countryService.update(id, updateCountryDto);
  }

  @Patch(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Activate country (Admin only)' })
  @ApiResponse({ status: 200, description: 'Country activated successfully' })
  async activate(@Param('id') id: string) {
    return await this.countryService.activate(id);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deactivate country (Admin only)' })
  @ApiResponse({ status: 200, description: 'Country deactivated successfully' })
  async deactivate(@Param('id') id: string) {
    return await this.countryService.deactivate(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete country (Admin only)' })
  @ApiResponse({ status: 204, description: 'Country deleted successfully' })
  async remove(@Param('id') id: string) {
    await this.countryService.remove(id);
  }
}