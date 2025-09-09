import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the wallet' })
  id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  @ApiProperty({ description: 'The balance of the wallet', example: 100.5 })
  balance: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    name: 'pending_balance',
  })
  @ApiProperty({
    description: 'The pending balance of the wallet',
    example: 25.0,
  })
  pendingBalance: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    name: 'reserved_balance',
  })
  @ApiProperty({
    description: 'The reserved balance of the wallet (for security deposits)',
    example: 50.0,
  })
  reservedBalance: number;

  @Column({ default: true, name: 'is_active' })
  @ApiProperty({ description: 'Whether the wallet is active', default: true })
  isActive: boolean;

  @Column({ nullable: true, name: 'last_deposit_date' })
  @ApiProperty({ description: 'The date of the last deposit', required: false })
  lastDepositDate?: Date;

  @Column({ nullable: true, name: 'last_withdrawal_date' })
  @ApiProperty({
    description: 'The date of the last withdrawal',
    required: false,
  })
  lastWithdrawalDate?: Date;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  @ApiProperty({
    description: 'The user who owns the wallet',
    type: () => User,
  })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @OneToMany(() => Transaction, (transaction) => transaction.wallet)
  @ApiProperty({
    description: 'The transactions associated with this wallet',
    type: [Transaction],
  })
  transactions: Transaction[];

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the wallet was created' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty({ description: 'The date when the wallet was last updated' })
  updatedAt: Date;
}
