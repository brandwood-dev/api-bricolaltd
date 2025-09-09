import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentProvider } from './entities/payment-provider.entity';
import { CreatePaymentProviderDto } from './dto/create-payment-provider.dto';
import { UpdatePaymentProviderDto } from './dto/update-payment-provider.dto';

@Injectable()
export class PaymentProviderService {
  constructor(
    @InjectRepository(PaymentProvider)
    private paymentProviderRepository: Repository<PaymentProvider>,
  ) {}

  async create(createPaymentProviderDto: CreatePaymentProviderDto): Promise<PaymentProvider> {
    // Check if provider with same name already exists
    const existingProvider = await this.paymentProviderRepository.findOne({
      where: { name: createPaymentProviderDto.name },
    });

    if (existingProvider) {
      throw new ConflictException(`Payment provider with name '${createPaymentProviderDto.name}' already exists`);
    }

    const paymentProvider = this.paymentProviderRepository.create(createPaymentProviderDto);
    return this.paymentProviderRepository.save(paymentProvider);
  }

  async findAll(): Promise<PaymentProvider[]> {
    return this.paymentProviderRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findActive(): Promise<PaymentProvider[]> {
    return this.paymentProviderRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<PaymentProvider> {
    const paymentProvider = await this.paymentProviderRepository.findOne({
      where: { id },
    });

    if (!paymentProvider) {
      throw new NotFoundException(`Payment provider with ID ${id} not found`);
    }

    return paymentProvider;
  }

  async findByName(name: string): Promise<PaymentProvider> {
    const paymentProvider = await this.paymentProviderRepository.findOne({
      where: { name },
    });

    if (!paymentProvider) {
      throw new NotFoundException(`Payment provider with name '${name}' not found`);
    }

    return paymentProvider;
  }

  async update(id: number, updatePaymentProviderDto: UpdatePaymentProviderDto): Promise<PaymentProvider> {
    const paymentProvider = await this.findOne(id);

    // Check if name is being updated and if it conflicts with existing provider
    if (updatePaymentProviderDto.name && updatePaymentProviderDto.name !== paymentProvider.name) {
      const existingProvider = await this.paymentProviderRepository.findOne({
        where: { name: updatePaymentProviderDto.name },
      });

      if (existingProvider) {
        throw new ConflictException(`Payment provider with name '${updatePaymentProviderDto.name}' already exists`);
      }
    }

    Object.assign(paymentProvider, updatePaymentProviderDto);
    return this.paymentProviderRepository.save(paymentProvider);
  }

  async remove(id: number): Promise<void> {
    const paymentProvider = await this.findOne(id);
    await this.paymentProviderRepository.remove(paymentProvider);
  }

  async toggleActive(id: number): Promise<PaymentProvider> {
    const paymentProvider = await this.findOne(id);
    paymentProvider.isActive = !paymentProvider.isActive;
    return this.paymentProviderRepository.save(paymentProvider);
  }
}