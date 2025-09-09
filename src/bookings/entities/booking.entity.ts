import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';
import { Tool } from '../../tools/entities/tool.entity';
import { BookingStatus } from '../enums/booking-status.enum';

@Entity('booking')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'The unique identifier of the booking' })
  id: string;

  @Column({ name: 'start_date', type: 'date' })
  @ApiProperty({ description: 'The start date of the booking' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  @ApiProperty({ description: 'The end date of the booking' })
  endDate: Date;

  @Column({ name: 'pickup_hour', type: 'time' })
  @ApiProperty({ description: 'The pickup hour of the booking' })
  pickupHour: Date;

  @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 2 })
  @ApiProperty({
    description: 'The total price of the booking',
    example: 150.0,
  })
  totalPrice: number;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({ description: 'Message from the renter', required: false })
  message?: string;

  @Column({
    name: 'payment_method',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  @ApiProperty({ description: 'The payment method used', required: false })
  paymentMethod?: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  @ApiProperty({ description: 'The status of the booking', example: 'PENDING' })
  status: BookingStatus;

  @ManyToOne(() => Tool, (tool) => tool.bookings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  @ApiProperty({ description: 'The tool that was booked', type: () => Tool })
  tool: Tool;

  @Column({ name: 'tool_id' })
  toolId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'renter_id' })
  @ApiProperty({
    description: 'The user who rented the tool',
    type: () => User,
  })
  renter: User;

  @Column({ name: 'renter_id' })
  renterId: string;

  @CreateDateColumn({ name: 'created_at' })
  @ApiProperty({ description: 'The date when the booking was created' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @ApiProperty({ description: 'The date when the booking was last updated' })
  updatedAt: Date;
}
