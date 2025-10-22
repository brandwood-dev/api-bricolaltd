import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { PaymentMethod } from '../enums/payment-method.enum';

@Entity({ name: 'payment_providers' })
export class PaymentProvider {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 50, unique: true })
  name: string;

  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  displayName: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'api_key', type: 'text', nullable: true })
  apiKey: string | null;

  @Column({ name: 'api_secret', type: 'text', nullable: true })
  apiSecret: string | null;

  @Column({ name: 'webhook_url', type: 'text', nullable: true })
  webhookUrl: string | null;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string | null;

  @Column({ name: 'config', type: 'json', nullable: true })
  config: Record<string, any> | null;

  @Column({
    name: 'supported_methods',
    type: 'json',
  })
  supportedMethods: PaymentMethod[];

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
