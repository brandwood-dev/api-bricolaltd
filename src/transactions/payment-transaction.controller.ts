import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { PaymentTransactionService } from './payment-transaction.service';
import { CreatePaymentTransactionDto } from './dto/create-payment-transaction.dto';
import { UpdatePaymentTransactionDto } from './dto/update-payment-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('payment-transactions')
@Controller('payment-transactions')
export class PaymentTransactionController {
  constructor(private readonly paymentTransactionService: PaymentTransactionService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new payment transaction' })
  @ApiResponse({ status: 201, description: 'The payment transaction has been successfully created.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Transaction or provider not found.' })
  create(@Body() createPaymentTransactionDto: CreatePaymentTransactionDto) {
    return this.paymentTransactionService.create(createPaymentTransactionDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all payment transactions' })
  @ApiResponse({ status: 200, description: 'Return all payment transactions.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  findAll() {
    return this.paymentTransactionService.findAll();
  }

  @Get('by-status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment transactions by status' })
  @ApiQuery({ name: 'status', description: 'Payment transaction status', example: 'pending' })
  @ApiResponse({ status: 200, description: 'Return payment transactions by status.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  findByStatus(@Query('status') status: string) {
    return this.paymentTransactionService.findByStatus(status);
  }

  @Get('provider/:providerId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment transactions by provider ID' })
  @ApiResponse({ status: 200, description: 'Return payment transactions by provider.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  findByProviderId(@Param('providerId') providerId: string) {
    return this.paymentTransactionService.findByProviderId(parseInt(providerId));
  }

  @Get('transaction/:transactionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment transactions by transaction ID' })
  @ApiResponse({ status: 200, description: 'Return payment transactions by transaction.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findByTransactionId(@Param('transactionId') transactionId: string) {
    return this.paymentTransactionService.findByTransactionId(transactionId);
  }

  @Get('provider-transaction/:providerTransactionId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment transaction by provider transaction ID' })
  @ApiResponse({ status: 200, description: 'Return the payment transaction.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  findByProviderTransactionId(@Param('providerTransactionId') providerTransactionId: string) {
    return this.paymentTransactionService.findByProviderTransactionId(providerTransactionId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a payment transaction by id' })
  @ApiResponse({ status: 200, description: 'Return the payment transaction.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  findOne(@Param('id') id: string) {
    return this.paymentTransactionService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a payment transaction' })
  @ApiResponse({ status: 200, description: 'The payment transaction has been successfully updated.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  update(@Param('id') id: string, @Body() updatePaymentTransactionDto: UpdatePaymentTransactionDto) {
    return this.paymentTransactionService.update(id, updatePaymentTransactionDto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update payment transaction status' })
  @ApiResponse({ status: 200, description: 'The payment transaction status has been successfully updated.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  updateStatus(
    @Param('id') id: string,
    @Body() statusUpdate: {
      status: string;
      providerStatus?: string;
      errorCode?: string;
      errorMessage?: string;
    },
  ) {
    return this.paymentTransactionService.updateStatus(
      id,
      statusUpdate.status,
      statusUpdate.providerStatus,
      statusUpdate.errorCode,
      statusUpdate.errorMessage,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a payment transaction' })
  @ApiResponse({ status: 200, description: 'The payment transaction has been successfully deleted.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  remove(@Param('id') id: string) {
    return this.paymentTransactionService.remove(id);
  }
}