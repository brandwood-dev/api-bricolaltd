import { Entity, PrimaryColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('countries')
export class Country {
  @PrimaryColumn('char', { length: 2 })
  @ApiProperty({ description: 'ISO Alpha-2 country code', example: 'FR' })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  @ApiProperty({ description: 'The name of the country', example: 'France' })
  name: string;

  @Column({ type: 'varchar', length: 5, unique: true })
  @ApiProperty({
    description: 'The country code',
    example: 'FR',
  })
  code: string;

  @Column({ type: 'varchar', length: 3 })
  @ApiProperty({
    description: 'The currency of the country',
    example: 'EUR',
  })
  currency: string;

  @Column({ type: 'varchar', length: 5 })
  @ApiProperty({
    description: 'The phone prefix of the country',
    example: '+33',
  })
  phonePrefix: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  @ApiProperty({
    description: 'The continent of the country',
    example: 'Europe',
  })
  continent?: string;

  @Column({ type: 'boolean', default: true })
  @ApiProperty({ description: 'Whether the country is active', default: true })
  isActive: boolean;
}
