import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { PaymentProviderService } from './payment-provider.service';
import { CreatePaymentProviderDto } from './dto/create-payment-provider.dto';
import { UpdatePaymentProviderDto } from './dto/update-payment-provider.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('payment-providers')
@Controller('payment-providers')
export class PaymentProviderController {
  constructor(private readonly paymentProviderService: PaymentProviderService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new payment provider' })
  @ApiResponse({ status: 201, description: 'The payment provider has been successfully created.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 409, description: 'Payment provider with this name already exists.' })
  create(@Body() createPaymentProviderDto: CreatePaymentProviderDto) {
    return this.paymentProviderService.create(createPaymentProviderDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all payment providers' })
  @ApiResponse({ status: 200, description: 'Return all payment providers.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findAll() {
    return this.paymentProviderService.findAll();
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all active payment providers' })
  @ApiResponse({ status: 200, description: 'Return all active payment providers.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findActive() {
    return this.paymentProviderService.findActive();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a payment provider by id' })
  @ApiResponse({ status: 200, description: 'Return the payment provider.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.paymentProviderService.findOne(id);
  }

  @Get('name/:name')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a payment provider by name' })
  @ApiResponse({ status: 200, description: 'Return the payment provider.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  findByName(@Param('name') name: string) {
    return this.paymentProviderService.findByName(name);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a payment provider' })
  @ApiResponse({ status: 200, description: 'The payment provider has been successfully updated.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  @ApiResponse({ status: 409, description: 'Payment provider with this name already exists.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updatePaymentProviderDto: UpdatePaymentProviderDto) {
    return this.paymentProviderService.update(id, updatePaymentProviderDto);
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle active status of a payment provider' })
  @ApiResponse({ status: 200, description: 'The payment provider status has been successfully toggled.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.paymentProviderService.toggleActive(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a payment provider' })
  @ApiResponse({ status: 200, description: 'The payment provider has been successfully deleted.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.paymentProviderService.remove(id);
  }
}